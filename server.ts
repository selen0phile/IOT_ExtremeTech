import { WebSocketServer } from "ws";
import admin from "firebase-admin";
import serviceAccount from "./firebase-creds.json";

// Configuration
const PORT = Number(process.env.WS_PORT || 8080);

const PER_RIDER_TIMEOUT_MS = 10_000;
const TOTAL_ASSIGNMENT_WINDOW_MS = 60_000;
const ACTIVE_RIDER_WINDOW_MS = 2 * 60_000;
const PROCESS_POLL_INTERVAL_MS = 3_000; // background poll cadence
const WS_READY_OPEN = 1;
const HEARTBEAT_INTERVAL_MS = 5_000;

// Initialize Firebase Admin using Application Default Credentials.
// Make sure you have GOOGLE_APPLICATION_CREDENTIALS pointing to your service account JSON
// or are authenticated via gcloud on your machine.
if (admin.apps.length === 0) {
  // Initialize the DEFAULT app (no custom name) so admin.firestore() works
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}
const db = admin.firestore();

type LatLng = { lat: number; lng: number };
type RideRequestIncoming = {
  timestamp: number | string; // ignored; server time is used instead
  location: LatLng;
  destination: LatLng;
  // optional metadata fields are allowed and will be stored if present
  [key: string]: unknown;
};

type RiderCandidate = {
  uid: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
};

function isLatLng(v: any): v is LatLng {
  return (
    v &&
    typeof v.lat === "number" &&
    typeof v.lng === "number" &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}

function normalizeTimestamp(ts: number | string): number | null {
  if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;
  if (typeof ts === "string") {
    // allow ISO string or millis string
    const millis = Number(ts);
    if (!Number.isNaN(millis)) return millis;
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }
  return null;
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function persistRideRequest(msg: RideRequestIncoming) {
  // Use server time for timestamp regardless of client-provided value
  const tsMs = Date.now();
  if (!isLatLng(msg.location)) throw new Error("Invalid location");
  if (!isLatLng(msg.destination)) throw new Error("Invalid destination");

  // Pre-create id so we can reference it in notifications
  const docRef = db.collection("ride_requests").doc();
  const payload = {
    requestId: docRef.id,
    state: "active" as const,
    type: "ride_request" as const,
    timestamp: admin.firestore.Timestamp.fromMillis(tsMs),
    location: new admin.firestore.GeoPoint(msg.location.lat, msg.location.lng),
    destination: new admin.firestore.GeoPoint(
      msg.destination.lat,
      msg.destination.lng
    ),
    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Store any extra fields provided by the sender
    meta: Object.fromEntries(
      Object.entries(msg).filter(
        ([k]) => !["timestamp", "location", "destination"].includes(k)
      )
    ),
  };

  await docRef.set(payload);
  return docRef.id;
}

// Track requests currently being processed to avoid duplicate concurrent runs
const inFlightRequests = new Set<string>();

// Track which websocket initiated which request so we can push live distance updates
const requestIdToClients = new Map<string, Set<any>>();
const wsToRequestIds = new Map<any, Set<string>>();
const activeDistanceStreams = new Map<
  string,
  { stop: () => void; riderId: string }
>();

function registerClientForRequest(requestId: string, ws: any) {
  if (!requestIdToClients.has(requestId)) {
    requestIdToClients.set(requestId, new Set());
  }
  requestIdToClients.get(requestId)!.add(ws);
  if (!wsToRequestIds.has(ws)) wsToRequestIds.set(ws, new Set());
  wsToRequestIds.get(ws)!.add(requestId);
}

function unregisterWs(ws: any) {
  const reqs = wsToRequestIds.get(ws);
  if (reqs) {
    for (const rid of reqs) {
      const set = requestIdToClients.get(rid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          requestIdToClients.delete(rid);
          // If no more clients for this request, stop streaming distance
          const active = activeDistanceStreams.get(rid);
          if (active) {
            active.stop();
            activeDistanceStreams.delete(rid);
          }
        }
      }
    }
    wsToRequestIds.delete(ws);
  }
}

function sendDistanceToClients(requestId: string, distanceMeters: number) {
  const clients = requestIdToClients.get(requestId);
  if (!clients || clients.size === 0) return;
  const payload = JSON.stringify({
    message: "Distance: " + Math.round(distanceMeters) + " m",
  });
  try {
    console.log("[ws] sending distance", {
      requestId,
      meters: Math.round(distanceMeters),
      clients: clients.size,
    });
  } catch {}
  for (const ws of clients) {
    try {
      if (ws.readyState === WS_READY_OPEN) {
        ws.send(payload);
      } else {
        unregisterWs(ws);
      }
    } catch {
      unregisterWs(ws);
    }
  }
}

function beginDistanceStreaming(
  requestId: string,
  riderId: string,
  pickup: { lat: number; lng: number }
) {
  if (activeDistanceStreams.has(requestId)) return; // already streaming for this request
  // If no clients are waiting for this request, skip
  if (!requestIdToClients.has(requestId)) return;

  const riderRef = db.collection("riders").doc(riderId);
  const stateRef = db.collection("rider_state").doc(riderId);

  const unsubRider = riderRef.onSnapshot((snap) => {
    const data = snap.data() as any;
    const loc = data?.location;
    const lat = typeof loc?.latitude === "number" ? loc.latitude : undefined;
    const lng = typeof loc?.longitude === "number" ? loc.longitude : undefined;
    if (typeof lat === "number" && typeof lng === "number") {
      const d = haversineMeters(lat, lng, pickup.lat, pickup.lng);
      sendDistanceToClients(requestId, d);
    }
    // If all clients detached, stop streaming
    const clients = requestIdToClients.get(requestId);
    if (!clients || clients.size === 0) {
      cleanup();
    }
  });

  const unsubState = stateRef.onSnapshot((snap) => {
    const st = snap.data() as any;
    // Stop streaming if rider is no longer in pickup for this request
    if (!st || st.state !== "pickup" || st.requestId !== requestId) {
      // If rider moved to "riding", send "Arrived" message to clients
      if (st?.state === "riding" && st?.requestId === requestId) {
        const clients = requestIdToClients.get(requestId);
        if (clients && clients.size > 0) {
          const payload = JSON.stringify({ message: "Arrived" });
          for (const ws of clients) {
            try {
              if (ws.readyState === WS_READY_OPEN) {
                ws.send(payload);
              }
            } catch {}
          }
        }
      }
      cleanup();
    }
  });

  function cleanup() {
    try {
      unsubRider();
    } catch {}
    try {
      unsubState();
    } catch {}
    try {
      console.log("[stream] stop", { requestId, riderId });
    } catch {}
    activeDistanceStreams.delete(requestId);
  }

  activeDistanceStreams.set(requestId, { stop: cleanup, riderId });
  try {
    console.log("[stream] begin", { requestId, riderId });
  } catch {}
}

async function processActiveRequestsTick() {
  const now = Date.now();
  const snap = await db
    .collection("ride_requests")
    .where("state", "==", "active")
    .get();
  try {
    console.log("[process] active requests:", snap.size);
  } catch {}
  const ops: Promise<any>[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const requestId: string = data?.requestId ?? docSnap.id;
    // Timeout stale requests (> 1 minute old)
    const tsMs: number =
      data?.timestamp?.toMillis?.() ??
      (data?.timestamp?.seconds ? data.timestamp.seconds * 1000 : now);
    if (Number.isFinite(tsMs) && now - tsMs > 60_000) {
      try {
        console.log("[process] timeout request", {
          requestId,
          ageMs: now - tsMs,
        });
      } catch {}
      ops.push(
        docSnap.ref.set(
          {
            state: "timeout",
            timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      );
      return;
    }

    // Start processing if not already in-flight
    if (!inFlightRequests.has(requestId)) {
      inFlightRequests.add(requestId);
      try {
        console.log("[process] start processing", { requestId });
      } catch {}
      const loc = data?.location;
      const dest = data?.destination;
      const ride = {
        location: {
          lat: loc?.latitude ?? 0,
          lng: loc?.longitude ?? 0,
        },
        destination: {
          lat: dest?.latitude ?? 0,
          lng: dest?.longitude ?? 0,
        },
        timestampMs: tsMs || now,
      };
      // Fire-and-forget; ensure cleanup of inFlight flag
      assignRideToNearestRiders(requestId, ride).catch((err) => {
        console.error("[process] error for", requestId, err);
        try {
          inFlightRequests.delete(requestId);
        } catch {}
      });
    }
  });
  if (ops.length) {
    await Promise.allSettled(ops);
  }
}

function startProcessingLoop() {
  // Kick off background polling loop; keep ticks independent
  setInterval(() => {
    processActiveRequestsTick().catch((err) => {
      console.error("[process] tick error:", err);
    });
  }, PROCESS_POLL_INTERVAL_MS);
}

async function getNearestIdleRiders(origin: LatLng): Promise<RiderCandidate[]> {
  const [ridersSnap, statesSnap] = await Promise.all([
    db.collection("riders").get(),
    db.collection("rider_state").get(),
  ]);

  const riderIdToState: Record<string, string> = {};
  statesSnap.forEach((doc) => {
    const data = doc.data() as any;
    riderIdToState[doc.id] = data?.state ?? "idle";
  });

  const candidates: RiderCandidate[] = [];
  ridersSnap.forEach((doc) => {
    const data = doc.data() as any;
    const uid = data?.uid ?? doc.id;
    const state = riderIdToState[uid] ?? "idle";
    if (state !== "idle") return;

    const loc = data?.location;
    let lat = loc?.latitude as number | undefined;
    let lng = loc?.longitude as number | undefined;

    // If rider has no location yet, still include them but place at the end.
    let distance = Number.POSITIVE_INFINITY;
    if (typeof lat === "number" && typeof lng === "number") {
      distance = haversineMeters(origin.lat, origin.lng, lat, lng);
    } else {
      lat = 0;
      lng = 0;
    }

    candidates.push({
      uid,
      name: data?.name ?? "",
      lat,
      lng,
      distance,
    });
  });

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

async function markRideAccepted(requestId: string, riderId: string) {
  // Try to mark the most recent notification as accepted (if exists)
  const notifSnap = await db
    .collection("notifications")
    .where("requestId", "==", requestId)
    .where("riderId", "==", riderId)
    .get();
  const notifDoc = notifSnap.docs[0];

  await Promise.all([
    db.collection("ride_requests").doc(requestId).set(
      {
        state: "accepted",
        acceptedBy: riderId,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    notifDoc
      ? notifDoc.ref.set(
          {
            state: "accepted",
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      : Promise.resolve(),
    db.collection("rider_state").doc(riderId).set(
      {
        state: "pickup",
        requestId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

async function sendNotificationAndAwaitResponse(
  requestId: string,
  riderId: string,
  rideSummary: { location: LatLng; destination: LatLng; timestampMs: number }
): Promise<"accepted" | "rejected" | "timeout"> {
  const notifRef = db.collection("notifications").doc();
  await Promise.all([
    notifRef.set({
      id: notifRef.id,
      requestId,
      riderId,
      state: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ride: {
        timestamp: admin.firestore.Timestamp.fromMillis(
          rideSummary.timestampMs
        ),
        location: new admin.firestore.GeoPoint(
          rideSummary.location.lat,
          rideSummary.location.lng
        ),
        destination: new admin.firestore.GeoPoint(
          rideSummary.destination.lat,
          rideSummary.destination.lng
        ),
      },
    }),
    db.collection("rider_state").doc(riderId).set(
      {
        state: "requested",
        requestId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);

  return await new Promise<"accepted" | "rejected" | "timeout">((resolve) => {
    let settled = false;

    const riderStateRef = db.collection("rider_state").doc(riderId);
    const notifUnsub = notifRef.onSnapshot((snap) => {
      const st = (snap.data() as any)?.state;
      if (st === "accepted") {
        finish("accepted");
      } else if (st === "rejected") {
        finish("rejected");
      }
    });
    const riderUnsub = riderStateRef.onSnapshot((snap) => {
      const data = snap.data() as any;
      if (data?.state === "pickup" && data?.requestId === requestId) {
        finish("accepted");
      }
    });
    const timer = setTimeout(() => finish("timeout"), PER_RIDER_TIMEOUT_MS);

    async function finish(status: "accepted" | "rejected" | "timeout") {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      notifUnsub();
      riderUnsub();

      if (status !== "accepted") {
        await Promise.all([
          db.collection("notifications").doc(notifRef.id).set(
            {
              state: status,
              resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),
          riderStateRef.set(
            {
              state: "idle",
              requestId: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      }
      resolve(status);
    }
  });
}

async function assignRideToNearestRiders(
  requestId: string,
  ride: { location: LatLng; destination: LatLng; timestampMs: number }
) {
  // New logic: broadcast to all idle riders (sorted by distance),
  // wait up to 60s for the first acceptance. Non-accepted riders' notifications
  // are marked "timeout" after 10s, and once accepted, all remaining "active"
  // notifications become "filled".
  const start = Date.now();
  const candidates = await getNearestIdleRiders(ride.location);
  if (candidates.length === 0) {
    await db.collection("ride_requests").doc(requestId).set(
      {
        state: "timeout",
        timeoutReason: "no_idle_riders",
        timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  // 1) Create notifications for all candidates (distance-sorted) and set rider_state=requested
  const notifRefs: { id: string; riderId: string }[] = [];
  for (const c of candidates) {
    const notifRef = db.collection("notifications").doc();
    notifRefs.push({ id: notifRef.id, riderId: c.uid });
    await Promise.all([
      notifRef.set({
        id: notifRef.id,
        requestId,
        riderId: c.uid,
        rider: {
          uid: c.uid,
          name: c.name,
          location: new admin.firestore.GeoPoint(c.lat, c.lng),
        },
        state: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ride: {
          timestamp: admin.firestore.Timestamp.fromMillis(ride.timestampMs),
          location: new admin.firestore.GeoPoint(
            ride.location.lat,
            ride.location.lng
          ),
          destination: new admin.firestore.GeoPoint(
            ride.destination.lat,
            ride.destination.lng
          ),
        },
      }),
      db.collection("rider_state").doc(c.uid).set(
        {
          state: "requested",
          requestId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);
  }

  // 2) Schedule per-notification timeout (10s) to mark non-responded as "timeout"
  const timeoutTimers: NodeJS.Timeout[] = [];
  for (const { id, riderId } of notifRefs) {
    const t = setTimeout(async () => {
      // If still active after 10s, mark timeout and reset rider to idle
      const ref = db.collection("notifications").doc(id);
      const snap = await ref.get();
      const st = (snap.data() as any)?.state;
      if (st === "active") {
        await Promise.all([
          ref.set(
            {
              state: "timeout",
              resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),
          db.collection("rider_state").doc(riderId).set(
            {
              state: "idle",
              requestId: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      }
    }, PER_RIDER_TIMEOUT_MS);
    timeoutTimers.push(t);
  }

  // 3) Watch for first acceptance within 60s
  let settled = false;
  const cleanup = () => {
    if (settled) return;
    settled = true;
    timeoutTimers.forEach(clearTimeout);
    notifUnsub();
    try {
      inFlightRequests.delete(requestId);
    } catch {}
  };

  const notifQuery = db
    .collection("notifications")
    .where("requestId", "==", requestId);
  const notifUnsub = notifQuery.onSnapshot(async (snap) => {
    if (settled) return;
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const accepted = docs.find((d: any) => d.state === "accepted");
    if (!accepted) return;
    try {
      console.log("[assign] accepted", {
        requestId,
        riderId: accepted.riderId,
      });
    } catch {}

    // Transaction: ensure request still active, then mark accepted
    const ok = await db.runTransaction(async (tx) => {
      const reqRef = db.collection("ride_requests").doc(requestId);
      const reqSnap = await tx.get(reqRef);
      const data = reqSnap.data() as any;
      if (!data || data.state !== "active") return false;
      tx.set(
        reqRef,
        {
          state: "accepted",
          acceptedBy: accepted.riderId,
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    });

    if (!ok) return; // some other acceptance already finalized

    // Attach rider details to the accepted ride_request
    const winner = candidates.find((c) => c.uid === accepted.riderId);
    if (winner) {
      await db
        .collection("ride_requests")
        .doc(requestId)
        .set(
          {
            rider: {
              uid: winner.uid,
              name: winner.name,
              location: new admin.firestore.GeoPoint(winner.lat, winner.lng),
              assignedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );
    }

    // Mark other active notifications as filled, reset their rider_state to idle.
    const batch = db.batch();
    for (const d of docs) {
      const nref = db.collection("notifications").doc(d.id);
      if (d.id === accepted.id) {
        batch.set(
          nref,
          {
            state: "accepted",
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else if (d.state === "active") {
        batch.set(nref, { state: "filled" }, { merge: true });
      } else if (d.state === "accepted" && d.riderId !== accepted.riderId) {
        // handle race: downgrade non-winning accepted to filled
        batch.set(nref, { state: "filled" }, { merge: true });
      }
    }
    await batch.commit();

    // Update rider states
    await Promise.all(
      docs.map((d: any) => {
        const rref = db.collection("rider_state").doc(d.riderId);
        if (d.riderId === accepted.riderId) {
          return rref.set(
            {
              state: "pickup",
              requestId,
              rideRequest: {
                requestId,
                timestamp: admin.firestore.Timestamp.fromMillis(
                  ride.timestampMs
                ),
                location: new admin.firestore.GeoPoint(
                  ride.location.lat,
                  ride.location.lng
                ),
                destination: new admin.firestore.GeoPoint(
                  ride.destination.lat,
                  ride.destination.lng
                ),
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
        return rref.set(
          {
            state: "idle",
            requestId: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      })
    );

    // Begin streaming real-time distance from rider to pickup to the client(s) who initiated the request
    beginDistanceStreaming(requestId, accepted.riderId, {
      lat: ride.location.lat,
      lng: ride.location.lng,
    });

    cleanup();
  });

  // 4) Total window timeout (60s): mark ride request timeout if not accepted
  setTimeout(async () => {
    if (settled) return;
    settled = true;
    timeoutTimers.forEach(clearTimeout);
    notifUnsub();

    await db.collection("ride_requests").doc(requestId).set(
      {
        state: "timeout",
        timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Send "No rider found" message to clients
    const clients = requestIdToClients.get(requestId);
    if (clients && clients.size > 0) {
      const payload = JSON.stringify({ message: "No rider found" });
      for (const ws of clients) {
        try {
          if (ws.readyState === WS_READY_OPEN) {
            ws.send(payload);
          }
        } catch {}
      }
    }

    // Any notifications still active => mark timeout, reset rider state
    const nsnap = await db
      .collection("notifications")
      .where("requestId", "==", requestId)
      .get();
    const ops: Promise<any>[] = [];
    nsnap.forEach((d) => {
      const data = d.data() as any;
      if (data.state === "active") {
        ops.push(
          d.ref.set(
            {
              state: "timeout",
              resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        );
        ops.push(
          db.collection("rider_state").doc(data.riderId).set(
            {
              state: "idle",
              requestId: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        );
      }
    });
    await Promise.all(ops);
  }, TOTAL_ASSIGNMENT_WINDOW_MS - (Date.now() - start));
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[ws] Server listening on ws://localhost:${PORT}`);

wss.on("connection", (ws, req) => {
  const remote = req.socket.remoteAddress;
  console.log(`[ws] client connected ${remote}`);

  // Per-connection heartbeat
  // const heartbeatId = setInterval(() => {
  //   try {
  //     if (ws.readyState === WS_READY_OPEN) {
  //       ws.send(JSON.stringify({ message: "heartbeat" }));
  //     } else {
  //       clearInterval(heartbeatId);
  //     }
  //   } catch {
  //     clearInterval(heartbeatId);
  //   }
  // }, HEARTBEAT_INTERVAL_MS);

  ws.on("message", async (data) => {
    try {
      const text = typeof data === "string" ? data : data.toString("utf8");
      console.log("[ws] message received", text);
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON payload");
      }
      const msg = parsed as RideRequestIncoming;
      const serverNowMs = Date.now();
      const requestId = await persistRideRequest(msg);
      console.log("[ride] new ride request", {
        requestId,
        location: msg.location,
        destination: msg.destination,
        timestampMs: serverNowMs,
      });
      ws.send(JSON.stringify({ message: "Request received" }));

      // Assignment is handled by background processor; no immediate processing here.
      // Remember who initiated this request so we can push live distance updates after acceptance
      registerClientForRequest(requestId, ws);
    } catch (err: any) {
      console.error("[ws] message error:", err?.message ?? err);
      ws.send(
        JSON.stringify({
          status: "error",
          error: String(err?.message ?? err),
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("[ws] client disconnected");
    // clearInterval(heartbeatId);
    unregisterWs(ws);
  });
});

// Start background processing loop once server is up
startProcessingLoop();
