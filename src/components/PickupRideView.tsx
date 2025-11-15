import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRiderLocation } from "@/hooks/useRiderLocation";
import { useRiderState } from "@/hooks/useRiderState";
import { haversineDistanceMeters } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  deleteField,
} from "firebase/firestore";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { useActiveNotification } from "@/hooks/useActiveNotification";

export default function PickupRideView() {
  const { currentUser } = useAuth();
  const { riderState } = useRiderState(currentUser?.uid);
  const { coords } = useRiderLocation(currentUser ?? null);
  const { activeNotification } = useActiveNotification(currentUser?.uid);
  const pickupStartAtRef = useRef<number | null>(null);
  const ridingStartAtRef = useRef<number | null>(null);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const pickupDistanceRef = useRef<number>(0);
  const ridingDistanceRef = useRef<number>(0);
  const mapRef = useRef<google.maps.Map | null>(null);
  const didInitialFitRef = useRef<boolean>(false);
  const [, forceTick] = useState(0);

  const apiKey =
    (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY ||
    (import.meta.env as any).GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey ?? "",
    id: "rixa-google-maps",
  });

  const MAP_STYLE: React.CSSProperties = {
    width: "100%",
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
    border: "1px solid rgba(0, 0, 0, 0.05)",
  };

  // heartbeat for timers
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const currentRide = useMemo(() => {
    // Prefer the fresh notification payload when present; fallback to riderState
    return activeNotification?.ride ?? riderState?.rideRequest ?? null;
  }, [activeNotification, riderState?.rideRequest]);
  const pickupLatLng = useMemo(() => {
    const p = currentRide?.location;
    return p ? { lat: p.latitude, lng: p.longitude } : null;
  }, [currentRide]);
  const destLatLng = useMemo(() => {
    const d = currentRide?.destination;
    return d ? { lat: d.latitude, lng: d.longitude } : null;
  }, [currentRide]);

  // Start timers on state entry
  useEffect(() => {
    if (riderState?.state === "pickup" && pickupStartAtRef.current == null) {
      pickupStartAtRef.current = Date.now();
    }
    if (riderState?.state === "riding" && ridingStartAtRef.current == null) {
      ridingStartAtRef.current = Date.now();
    }
  }, [riderState?.state]);

  // Accumulate distance travelled based on state
  useEffect(() => {
    if (!coords) return;
    const previous = lastCoordsRef.current;
    if (previous) {
      const delta = haversineDistanceMeters(
        previous.lat,
        previous.lng,
        coords.lat,
        coords.lng
      );
      if (Number.isFinite(delta) && delta >= 0) {
        if (riderState?.state === "pickup") {
          pickupDistanceRef.current += delta;
        } else if (riderState?.state === "riding") {
          ridingDistanceRef.current += delta;
        }
      }
    }
    lastCoordsRef.current = coords;
  }, [coords, riderState?.state]);

  // Keep all important markers in view
  useEffect(() => {
    if (!isLoaded || !mapRef.current || didInitialFitRef.current) return;
    const m = mapRef.current;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    if (coords) {
      bounds.extend({ lat: coords.lat, lng: coords.lng });
      count++;
    }
    if (pickupLatLng) {
      bounds.extend({ lat: pickupLatLng.lat, lng: pickupLatLng.lng });
      count++;
    }
    if (destLatLng) {
      bounds.extend({ lat: destLatLng.lat, lng: destLatLng.lng });
      count++;
    }
    if (count >= 2) {
      m.fitBounds(bounds, 48);
      didInitialFitRef.current = true;
    } else if (count === 1) {
      m.setCenter(bounds.getCenter());
      m.setZoom(15);
      didInitialFitRef.current = true;
    }
  }, [
    isLoaded,
    coords?.lat,
    coords?.lng,
    pickupLatLng?.lat,
    pickupLatLng?.lng,
    destLatLng?.lat,
    destLatLng?.lng,
  ]);

  // Previously auto-completed at <10m. Now completion is manual via button.

  if (
    !currentUser ||
    !riderState ||
    !(
      riderState.state === "pickup" ||
      riderState.state === "riding" ||
      riderState.state === "requested" ||
      !!activeNotification
    )
  ) {
    return null;
  }

  const handleConfirm = async () => {
    const requestId =
      riderState.requestId ?? riderState.rideRequest?.requestId ?? null;
    if (!requestId) return;
    const notifId = await findNotificationId(currentUser.uid, requestId);
    await Promise.all([
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        {
          state: "riding",
          requestId,
          // keep the embedded ride request so downstream views always have it
          ...(riderState.rideRequest
            ? { rideRequest: riderState.rideRequest }
            : {}),
        },
        { merge: true }
      ),
      setDoc(
        doc(db, "ride_requests", requestId),
        { state: "riding" },
        { merge: true }
      ),
      notifId
        ? setDoc(
            doc(db, "notifications", notifId),
            { state: "riding" },
            { merge: true }
          )
        : Promise.resolve(),
    ]);
  };

  const handleCancel = async () => {
    const requestId =
      riderState.requestId ?? riderState.rideRequest?.requestId ?? null;
    if (!requestId) return;
    const notifId = await findNotificationId(currentUser.uid, requestId);
    await Promise.all([
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        { state: "idle", requestId: null, rideRequest: deleteField() },
        { merge: true }
      ),
      setDoc(
        doc(db, "ride_requests", requestId),
        { state: "active" },
        { merge: true }
      ),
      notifId
        ? setDoc(
            doc(db, "notifications", notifId),
            { state: "cancelled" },
            { merge: true }
          )
        : Promise.resolve(),
    ]);
    // Subtract base points on cancelled pickup
    try {
      const mod = await import("firebase/firestore");
      const confSnap = await (
        await import("firebase/firestore")
      ).getDoc(
        (await import("firebase/firestore")).doc(db, "admin_config", "global")
      );
      const conf = confSnap.data() as any;
      const points = typeof conf?.basePoint === "number" ? conf.basePoint : 10;
      await (
        await import("firebase/firestore")
      ).setDoc(
        (
          await import("firebase/firestore")
        ).doc(db, "rider_points", currentUser.uid),
        {
          balance: mod.increment(-points),
          lastUpdated: mod.serverTimestamp(),
        } as any,
        { merge: true }
      );
    } catch (e) {
      console.error("points deduction failed", e);
    }
  };

  async function completeRide() {
    if (!currentUser) return;
    const requestId =
      riderState?.requestId ?? riderState?.rideRequest?.requestId ?? null;
    if (!requestId) return;
    const notifId = await findNotificationId(currentUser.uid, requestId);

    const pickupTimeMs =
      pickupStartAtRef.current && ridingStartAtRef.current
        ? Math.max(0, ridingStartAtRef.current - pickupStartAtRef.current)
        : 0;
    const ridingTimeMs = ridingStartAtRef.current
      ? Math.max(0, Date.now() - ridingStartAtRef.current)
      : 0;

    const pickupDistanceMeters = Math.round(pickupDistanceRef.current);
    const ridingDistanceMeters = Math.round(ridingDistanceRef.current);
    const totalDistanceMeters = pickupDistanceMeters + ridingDistanceMeters;
    const totalTimeMs = pickupTimeMs + ridingTimeMs;

    // Read basePoint (default 10) and award points
    let points = 10;
    try {
      const mod = await import("firebase/firestore");
      const confSnap = await (
        await import("firebase/firestore")
      ).getDoc(
        (await import("firebase/firestore")).doc(db, "admin_config", "global")
      );
      const conf = confSnap.data() as any;
      points = typeof conf?.basePoint === "number" ? conf.basePoint : 10;
      await (
        await import("firebase/firestore")
      ).setDoc(
        (
          await import("firebase/firestore")
        ).doc(db, "rider_points", currentUser.uid),
        {
          balance: mod.increment(points),
          totalEarned: mod.increment(points),
          lastUpdated: mod.serverTimestamp(),
        } as any,
        { merge: true }
      );
      // Optionally, log transaction
      await (
        await import("firebase/firestore")
      ).addDoc(
        (
          await import("firebase/firestore")
        ).collection(db, "rider_points", currentUser.uid, "transactions"),
        {
          type: "earn",
          requestId,
          amount: points,
          at: mod.serverTimestamp(),
        } as any
      );
    } catch (e) {
      console.error("points award failed", e);
    }

    await Promise.all([
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        { state: "idle", requestId: null, rideRequest: deleteField() },
        { merge: true }
      ),
      setDoc(
        doc(db, "ride_requests", requestId),
        {
          state: "drop-off",
          completedAt: new Date(),
          metrics: {
            pickup: {
              timeMs: pickupTimeMs,
              distanceMeters: pickupDistanceMeters,
            },
            riding: {
              timeMs: ridingTimeMs,
              distanceMeters: ridingDistanceMeters,
            },
            total: {
              timeMs: totalTimeMs,
              distanceMeters: totalDistanceMeters,
            },
          },
        },
        { merge: true }
      ),
      notifId
        ? setDoc(
            doc(db, "notifications", notifId),
            { state: "complete" },
            { merge: true }
          )
        : Promise.resolve(),
    ]);
  }

  const distanceToPickup =
    coords && pickupLatLng
      ? haversineDistanceMeters(
          coords.lat,
          coords.lng,
          pickupLatLng.lat,
          pickupLatLng.lng
        )
      : null;
  const distanceToDestination =
    coords && destLatLng
      ? haversineDistanceMeters(
          coords.lat,
          coords.lng,
          destLatLng.lat,
          destLatLng.lng
        )
      : null;

  const pickupElapsedMs =
    riderState.state === "pickup" && pickupStartAtRef.current
      ? Date.now() - pickupStartAtRef.current
      : 0;
  const ridingElapsedMs =
    riderState.state === "riding" && ridingStartAtRef.current
      ? Date.now() - ridingStartAtRef.current
      : 0;

  // When there is an active notification and rider is requested, render accept/reject with a 10s timer
  const isRequested =
    riderState.state === "requested" ||
    (!!activeNotification && !riderState.requestId);
  const createdAtMs = activeNotification?.createdAt?.toMillis
    ? activeNotification.createdAt.toMillis()
    : undefined;
  const remainingMsRequested =
    isRequested && createdAtMs != null
      ? Math.max(0, createdAtMs + 10_000 - Date.now())
      : 0;
  const remainingSecsRequested = Math.ceil(remainingMsRequested / 1000);

  const onAcceptRequest = async () => {
    if (!activeNotification || !currentUser) return;
    const requestId = activeNotification.requestId;
    await Promise.all([
      setDoc(
        doc(db, "notifications", activeNotification.id),
        { state: "accepted" },
        { merge: true }
      ),
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        {
          state: "pickup",
          requestId,
          rideRequest: {
            requestId,
            timestamp: activeNotification.ride?.timestamp,
            location: activeNotification.ride?.location,
            destination: activeNotification.ride?.destination,
          },
        },
        { merge: true }
      ),
    ]);
  };

  const onRejectRequest = async () => {
    if (!activeNotification || !currentUser) return;
    await Promise.all([
      setDoc(
        doc(db, "notifications", activeNotification.id),
        { state: "rejected" },
        { merge: true }
      ),
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        { state: "idle", requestId: null, rideRequest: deleteField() },
        { merge: true }
      ),
    ]);
  };

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 0, width: "100%" }}>
      <div
        style={{
          background: isRequested
            ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            : riderState.state === "pickup"
            ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
            : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          borderRadius: 16,
          padding: 20,
          color: "white",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}>
          {isRequested
            ? "🔔 Incoming Request"
            : riderState.state === "pickup"
            ? "📍 Proceed to Pickup"
            : "🚀 Heading to Destination"}
        </div>
        {isRequested && (
          <div
            style={{
              fontSize: "0.875rem",
              opacity: 0.95,
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: 8,
              padding: "8px 12px",
              display: "inline-block",
            }}
          >
            ⏱️ Respond within {remainingSecsRequested}s
          </div>
        )}
      </div>

      <div style={MAP_STYLE}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            options={{ streetViewControl: false, mapTypeControl: false }}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            onUnmount={() => {
              mapRef.current = null;
            }}
          >
            {coords ? (
              <MarkerF
                position={coords}
                title="You"
                icon={markerIcon("#2563eb")}
              />
            ) : null}
            {pickupLatLng ? (
              <MarkerF
                position={pickupLatLng}
                title="Pickup"
                icon={markerIcon("#16a34a")}
              />
            ) : null}
            {destLatLng ? (
              <MarkerF
                position={destLatLng}
                title="Destination"
                icon={markerIcon("#dc2626")}
              />
            ) : null}
          </GoogleMap>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#64748b",
            }}
          >
            Loading map…
          </div>
        )}
      </div>

      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid rgba(0,0,0,0.05)",
          borderRadius: 16,
          padding: 20,
          display: "grid",
          gap: 16,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        }}
      >
        {isRequested ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                size="lg"
                onClick={onAcceptRequest}
                disabled={remainingMsRequested <= 0}
                style={{
                  flex: 1,
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "1rem",
                  padding: "16px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                }}
              >
                ✓ Accept
              </Button>
              <Button
                size="lg"
                onClick={onRejectRequest}
                disabled={remainingMsRequested <= 0}
                style={{
                  flex: 1,
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "1rem",
                  padding: "16px",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                }}
              >
                ✗ Reject
              </Button>
            </div>
          </div>
        ) : null}
        <div
          style={{
            background: "rgba(37, 99, 235, 0.05)",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#2563eb",
                display: "inline-block",
                border: "2px solid white",
                boxShadow: "0 0 0 2px #2563eb",
              }}
            />
            Your Location
          </div>
          <div
            style={{ fontSize: "0.8125rem", color: "#64748b", marginLeft: 20 }}
          >
            {coords
              ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`
              : "🔍 Acquiring GPS…"}
          </div>
        </div>

        <div
          style={{
            background: "rgba(16, 163, 74, 0.05)",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#16a34a",
                display: "inline-block",
                border: "2px solid white",
                boxShadow: "0 0 0 2px #16a34a",
              }}
            />
            Pickup Location
          </div>
          <div
            style={{ fontSize: "0.8125rem", color: "#64748b", marginLeft: 20 }}
          >
            {pickupLatLng
              ? `${pickupLatLng.lat.toFixed(6)}, ${pickupLatLng.lng.toFixed(6)}`
              : "—"}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#10b981",
              marginLeft: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📏 {formatDistance(distanceToPickup)}</span>
            {riderState.state === "pickup" && (
              <span>⏱️ {formatDuration(pickupElapsedMs)}</span>
            )}
          </div>
          {riderState.state === "pickup" ? (
            <Button
              size="default"
              onClick={handleConfirm}
              disabled={!distanceToPickup || distanceToPickup >= 10}
              style={{
                marginTop: 8,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "white",
                fontWeight: 600,
                border: "none",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
              }}
            >
              ✓ Confirm Pickup
            </Button>
          ) : null}
        </div>

        <div
          style={{
            background: "rgba(220, 38, 38, 0.05)",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "#1e293b",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#dc2626",
                display: "inline-block",
                border: "2px solid white",
                boxShadow: "0 0 0 2px #dc2626",
              }}
            />
            Destination
          </div>
          <div
            style={{ fontSize: "0.8125rem", color: "#64748b", marginLeft: 20 }}
          >
            {destLatLng
              ? `${destLatLng.lat.toFixed(6)}, ${destLatLng.lng.toFixed(6)}`
              : "—"}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ef4444",
              marginLeft: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📏 {formatDistance(distanceToDestination)}</span>
            {riderState.state === "riding" && (
              <span>⏱️ {formatDuration(ridingElapsedMs)}</span>
            )}
          </div>
          {riderState.state === "riding" ? (
            <Button
              size="default"
              onClick={() => completeRide()}
              disabled={!distanceToDestination || distanceToDestination >= 10}
              style={{
                marginTop: 8,
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "white",
                fontWeight: 600,
                border: "none",
                boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
              }}
            >
              ✓ Confirm Drop-off
            </Button>
          ) : null}
        </div>
      </div>

      {riderState.state === "pickup" ? (
        <Button
          size="lg"
          onClick={handleCancel}
          style={{
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
            fontWeight: 700,
            fontSize: "1rem",
            padding: "16px",
            border: "none",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
          }}
        >
          ✗ Cancel Ride
        </Button>
      ) : null}
    </div>
  );
}

async function findNotificationId(
  riderId: string,
  requestId: string
): Promise<string | null> {
  const qNoOrder = query(
    collection(db, "notifications"),
    where("riderId", "==", riderId),
    where("requestId", "==", requestId)
  );
  const snap = await getDocs(qNoOrder);
  if (snap.empty) return null;
  const sorted = [...snap.docs].sort((a, b) => {
    const at = (a.data() as any)?.createdAt?.toMillis?.() ?? 0;
    const bt = (b.data() as any)?.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  return sorted[0]?.id ?? null;
}

function formatDistance(meters: number | null): string {
  if (meters == null || Number.isNaN(meters)) return "—";
  return `${Math.round(meters)} m`;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function markerIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 6,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#111827",
    strokeWeight: 1,
  };
}
