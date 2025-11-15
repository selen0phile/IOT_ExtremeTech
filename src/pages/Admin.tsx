import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { haversineDistanceMeters } from "@/lib/geo";

function StatCard({
  label,
  value,
  gradient,
}: {
  label: string;
  value: string | number;
  gradient: string;
}) {
  return (
    <div
      style={{
        background: gradient,
        borderRadius: 16,
        padding: 24,
        color: "white",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
        transition: "transform 0.2s ease",
      }}
      onMouseOver={(e) =>
        (e.currentTarget.style.transform = "translateY(-4px)")
      }
      onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div
        style={{
          fontSize: "0.875rem",
          opacity: 0.9,
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        {label}
    </div>
      <div
        style={{
          fontSize: "2.5rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function AdminPage() {
  // Booth/stand coordinate
  const booth = { lat: 23.725133, lng: 90.392916 };
  const apiKey =
    (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY ||
    (import.meta.env as any).GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey ?? "",
    id: "rixa-admin-map",
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<
    "Dashboard" | "Live Pullers" | "Ride History" | "Analytics" | "Settings"
  >("Dashboard");

  // Dashboard counts
  const [activeRequests, setActiveRequests] = useState(0);
  const [onlinePullers, setOnlinePullers] = useState(0);
  const [activeRides, setActiveRides] = useState(0);
  const [basePoint, setBasePoint] = useState<number | null>(null);

  // History
  const [rides, setRides] = useState<any[]>([]);
  const [rideFilter, setRideFilter] = useState<
    | "all"
    | "active"
    | "accepted"
    | "riding"
    | "drop-off"
    | "timeout"
    | "cancelled"
    | "rejected"
    | "filled"
  >("all");
  const filteredRides = useMemo(() => {
    if (rideFilter === "all") return rides;
    return rides.filter((r) => (r?.state ?? "") === rideFilter);
  }, [rides, rideFilter]);

  // Riders + states
  const [ridersMap, setRidersMap] = useState<
    Record<
    string,
      {
        uid: string;
        name: string;
        lat?: number;
        lng?: number;
        updatedAt?: Date | null;
      }
    >
  >({});
  const [riderStates, setRiderStates] = useState<Record<string, string>>({});
  const [ridePointsByRequest, setRidePointsByRequest] = useState<
    Record<string, number>
  >({});
  const pointsFetchingRef = useRef<Set<string>>(new Set());

  // Leaderboard / analytics
  const [completedByRider, setCompletedByRider] = useState<
    Record<string, number>
  >({});
  const [avgWaitMs, setAvgWaitMs] = useState<number>(0);
  const [avgCompletionMs, setAvgCompletionMs] = useState<number>(0);
  const [avgDistanceMeters, setAvgDistanceMeters] = useState<number>(0);
  const [topDestinations, setTopDestinations] = useState<
    { key: string; count: number; lat: number; lng: number }[]
  >([]);
  const [riderPoints, setRiderPoints] = useState<Record<string, number>>({});

  // Points admin
  const [adjustRiderId, setAdjustRiderId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState<number>(0);

  // Real-time: active ride requests
  useEffect(() => {
    const q = query(
      collection(db, "ride_requests"),
      where("state", "==", "active")
    );
    const unsub = onSnapshot(q, (snap) => setActiveRequests(snap.size));
    return () => unsub();
  }, []);

  // Rider points (balances)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rider_points"), (snap) => {
      const map: Record<string, number> = {};
      snap.forEach((d) => {
        const data = d.data() as any;
        if (typeof data?.balance === "number") map[d.id] = data.balance;
      });
      setRiderPoints(map);
    });
    return () => unsub();
  }, []);

  // Real-time: active rider states (non-idle)
  useEffect(() => {
    const q = query(
      collection(db, "rider_state"),
      where("state", "in", ["requested", "pickup", "riding"])
    );
    const unsub = onSnapshot(q, (snap) => setActiveRides(snap.size));
    return () => unsub();
  }, []);

  // Online pullers: realtime riders (location + updatedAt)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "riders"), (rSnap) => {
        const rmap: Record<
          string,
        {
          uid: string;
          name: string;
          lat?: number;
          lng?: number;
          updatedAt?: Date | null;
        }
      > = {};
        rSnap.forEach((d) => {
        const data = d.data() as any;
          rmap[d.id] = {
            uid: data?.uid ?? d.id,
          name: data?.name ?? "Unnamed",
          lat:
            typeof data?.location?.latitude === "number"
              ? data.location.latitude
              : undefined,
          lng:
            typeof data?.location?.longitude === "number"
              ? data.location.longitude
              : undefined,
            updatedAt: data?.location?.updatedAt?.toDate?.() ?? null,
        };
      });
      setRidersMap(rmap);
    });
    return () => unsub();
  }, []);

  // Online pullers: realtime rider_state (for status label)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "rider_state"), (sSnap) => {
      const smap: Record<string, string> = {};
        sSnap.forEach((d) => {
        const data = d.data() as any;
        smap[d.id] = data?.state ?? "idle";
      });
      setRiderStates(smap);
    });
    return () => unsub();
  }, []);

  // Ticker to enforce <10s active window even without new snapshots
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derived online puller list and counts
  const onlinePullersList = useMemo(() => {
    const now = nowMs;
    const rows: Array<{
      uid: string;
      name: string;
      state: string;
      lat?: number;
      lng?: number;
      updatedAt?: Date | null;
      distanceMeters?: number;
    }> = [];
    for (const uid of Object.keys(ridersMap)) {
      const r = ridersMap[uid];
      if (!r.updatedAt || now - r.updatedAt.getTime() >= 10_000) continue;
      const state = riderStates[uid] ?? "idle";
      const distanceMeters =
        typeof r.lat === "number" && typeof r.lng === "number"
          ? haversineDistanceMeters(r.lat, r.lng, booth.lat, booth.lng)
          : undefined;
      rows.push({
        uid: r.uid,
        name: r.name,
        state,
        lat: r.lat,
        lng: r.lng,
        updatedAt: r.updatedAt,
        distanceMeters,
      });
    }
    rows.sort(
      (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
    );
    setOnlinePullers(rows.length);
    return rows;
  }, [ridersMap, riderStates, nowMs]);

  // Load basePoint from admin_config/global
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "admin_config", "global"), (snap) => {
      const data = snap.data() as any;
      setBasePoint(data?.basePoint ?? 10);
    });
    return () => unsub();
  }, []);

  // Resolve points earned per completed ride by looking up rider_points/{uid}/transactions (type: earn)
  useEffect(() => {
    let cancelled = false;
    const fetchPoints = async () => {
      const recent = rides.slice(0, 50);
      const tasks: Promise<void>[] = [];
      for (const r of recent) {
        const requestId = r?.requestId ?? r?.id;
        const riderUid = r?.rider?.uid ?? r?.acceptedBy;
        if (!requestId || !riderUid) continue;
        if (ridePointsByRequest[requestId] != null) continue;
        const key = `${riderUid}:${requestId}`;
        if (pointsFetchingRef.current.has(key)) continue;
        pointsFetchingRef.current.add(key);
        tasks.push(
          (async () => {
            try {
              const txQ = query(
                collection(db, "rider_points", riderUid, "transactions"),
                where("requestId", "==", requestId)
              );
              const snap = await getDocs(txQ);
              let amount: number | undefined;
              snap.forEach((d) => {
                const data = d.data() as any;
                if (data?.type === "earn" && typeof data?.amount === "number") {
                  amount = data.amount;
                }
              });
              if (!cancelled && amount != null) {
                setRidePointsByRequest((prev) => ({
                  ...prev,
                  [requestId]: amount as number,
                }));
              }
            } catch (e) {
              // ignore per-entry failure
            } finally {
              pointsFetchingRef.current.delete(key);
            }
          })()
        );
      }
      if (tasks.length) await Promise.allSettled(tasks);
    };
    fetchPoints();
    return () => {
      cancelled = true;
    };
  }, [rides, ridePointsByRequest]);

  // Ride history (recent)
  useEffect(() => {
    const q = query(
      collection(db, "ride_requests"),
      orderBy("timestamp", "desc"),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: any[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          rows.push({ id: d.id, ...data });
        });
        setRides(rows);
      },
      // Fallback without orderBy if index missing
      async () => {
        const snap = await getDocs(collection(db, "ride_requests"));
        const rows: any[] = [];
        snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as any) }));
        rows.sort((a, b) => {
          const at = a?.timestamp?.toMillis?.() ?? 0;
          const bt = b?.timestamp?.toMillis?.() ?? 0;
          return bt - at;
        });
        setRides(rows.slice(0, 200));
      }
    );
    return () => unsub();
  }, []);

  // Analytics derived from rides
  useEffect(() => {
    // Destinations grouped by 3 decimal places (keep lat/lng)
    const destCounts: Record<
      string,
      { count: number; lat: number; lng: number }
    > = {};
    let waitTotal = 0;
    let waitCount = 0;
    let completeTotal = 0;
    let completeCount = 0;
    let distanceTotal = 0;
    let distanceCount = 0;
    const completedPerRider: Record<string, number> = {};

    for (const r of rides) {
      const d = r.destination;
      if (d?.latitude != null && d?.longitude != null) {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (!destCounts[key]) destCounts[key] = { count: 0, lat, lng };
        destCounts[key].count += 1;
      }
      const ts = r?.timestamp?.toMillis?.();
      const acc = r?.acceptedAt?.toMillis?.();
      const comp = r?.completedAt?.toMillis?.();
      if (ts && acc && acc >= ts) {
        waitTotal += acc - ts;
        waitCount++;
      }
      if (acc && comp && comp >= acc) {
        completeTotal += comp - acc;
        completeCount++;
      }
      const dist = r?.metrics?.total?.distanceMeters;
      if (typeof dist === "number") {
        distanceTotal += dist;
        distanceCount++;
      }
      const riderUid = r?.acceptedBy ?? r?.rider?.uid;
      if (r?.state === "drop-off" && riderUid) {
        completedPerRider[riderUid] = (completedPerRider[riderUid] ?? 0) + 1;
      }
    }

    const destArray = Object.entries(destCounts)
      .map(([key, v]) => ({ key, count: v.count, lat: v.lat, lng: v.lng }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setTopDestinations(destArray);
    setAvgWaitMs(waitCount ? Math.round(waitTotal / waitCount) : 0);
    setAvgCompletionMs(
      completeCount ? Math.round(completeTotal / completeCount) : 0
    );
    setAvgDistanceMeters(
      distanceCount ? Math.round(distanceTotal / distanceCount) : 0
    );
    setCompletedByRider(completedPerRider);
  }, [rides]);

  const leaderboard = useMemo(() => {
    return Object.entries(completedByRider)
      .map(([uid, count]) => ({ uid, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [completedByRider]);

  const saveBasePoint = async () => {
    const value = Number(basePoint ?? 10);
    await setDoc(
      doc(db, "admin_config", "global"),
      { basePoint: value },
      { merge: true }
    );
  };

  const redeemPoints = async () => {
    const uid = adjustRiderId.trim();
    const amt = Number(adjustAmount);
    if (!uid || !Number.isFinite(amt) || amt <= 0) return;
    const mod = await import("firebase/firestore");
    const amountTk = amt * 10;
    await mod.runTransaction(db as any, async (tx: any) => {
      const pRef = doc(db, "rider_points", uid);
      const bRef = doc(db, "rider_balance", uid);
      const pSnap = await tx.get(pRef as any);
      const curPts = (pSnap.data() as any)?.balance ?? 0;
      if (typeof curPts !== "number" || curPts < amt) {
        throw new Error("Insufficient points");
      }
      tx.set(
        pRef as any,
        {
          balance: mod.increment(-amt),
          lastUpdated: mod.serverTimestamp(),
        } as any,
      { merge: true }
      );
      tx.set(
        bRef as any,
        {
          balanceTk: mod.increment(amountTk),
          totalRedeemedTk: mod.increment(amountTk),
          lastUpdated: mod.serverTimestamp(),
        } as any,
        { merge: true }
      );
      const pTxnRef = doc(collection(db, "rider_points", uid, "transactions"));
      tx.set(
        pTxnRef as any,
        {
          id: (pTxnRef as any).id,
          type: "admin_redeem",
          points: amt,
          amountTk,
          at: mod.serverTimestamp(),
        } as any
      );
      const bTxnRef = doc(collection(db, "rider_balance", uid, "transactions"));
      tx.set(
        bTxnRef as any,
        {
          id: (bTxnRef as any).id,
          type: "credit",
          reason: "admin_redeem",
          points: amt,
          amountTk,
          at: mod.serverTimestamp(),
        } as any
      );
    });
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        // background: "linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "24px 32px",
          boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
          marginBottom: 32,
        }}
      >
        <div style={{ padding: "0 32px" }}>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              color: "white",
              marginBottom: 4,
              letterSpacing: "-0.02em",
            }}
          >
            Rixa Admin
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            Central dashboard for ride management & analytics
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          background: "white",
          borderBottom: "2px solid rgba(0, 0, 0, 0.05)",
          padding: "0 32px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          {(
            [
              "Dashboard",
              "Live Pullers",
              "Ride History",
              "Analytics",
              "Settings",
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background:
                  tab === activeTab
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "transparent",
                color: tab === activeTab ? "white" : "#64748b",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px 8px 0 0",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          padding: "32px",
          display: "grid",
          gap: 24,
        }}
      >
        {/* Dashboard Tab */}
        {activeTab === "Dashboard" && (
          <>
            {/* Overview Stats */}
            <div>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: 16,
                }}
              >
                📊 Real-time Overview
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                }}
              >
                <StatCard
                  label="Active Ride Requests"
                  value={activeRequests}
                  gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                />
                <StatCard
                  label="Online Pullers"
                  value={onlinePullers}
                  gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                />
                <StatCard
                  label="Active Rides"
                  value={activeRides}
                  gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                />
              </div>
            </div>
          </>
        )}

        {/* Live Pullers Tab */}
        {activeTab === "Live Pullers" && (
          <div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 16,
              }}
            >
              🚴 Live Pullers
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  borderRadius: 16,
                  padding: 20,
                  overflow: "auto",
                  maxHeight: 500,
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 12,
                    fontSize: "1rem",
                    color: "#1e293b",
                  }}
                >
                  Online Pullers ({onlinePullersList.length})
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr .8fr 1.4fr .8fr",
                    gap: 8,
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    color: "#64748b",
                    paddingBottom: 8,
                    borderBottom: "2px solid rgba(0, 0, 0, 0.05)",
                  }}
                >
            <div>Name</div>
            <div>Status</div>
            <div>Coordinates</div>
            <div>Distance</div>
          </div>
                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {onlinePullersList.map((r) => (
              <div
                key={r.uid}
                style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr .8fr 1.4fr .8fr",
                  gap: 8,
                        fontSize: "0.875rem",
                        padding: "10px 0",
                        borderBottom: "1px solid rgba(0, 0, 0, 0.03)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontWeight: 600,
                          color: "#1e293b",
                        }}
                      >
                      <span
                        style={{
                            width: 12,
                            height: 12,
                          borderRadius: 999,
                          background: nameToColor(r.name),
                            display: "inline-block",
                            border: "2px solid white",
                            boxShadow: `0 0 0 2px ${nameToColor(r.name)}`,
                        }}
                      />
                      {r.name}
                    </div>
                <div>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background:
                              r.state === "idle"
                                ? "#e8f5e9"
                                : r.state === "pickup"
                                ? "#fff3e0"
                                : "#e3f2fd",
                            color:
                              r.state === "idle"
                                ? "#2e7d32"
                                : r.state === "pickup"
                                ? "#e65100"
                                : "#1565c0",
                          }}
                        >
                          {r.state}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {typeof r.lat === "number" && typeof r.lng === "number"
                    ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`
                          : "—"}
                </div>
                      <div style={{ fontWeight: 600, color: "#667eea" }}>
                        {r.distanceMeters != null
                          ? `${Math.round(r.distanceMeters)} m`
                          : "—"}
                      </div>
              </div>
            ))}
          </div>
        </div>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  borderRadius: 16,
                  padding: 0,
                  overflow: "hidden",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
                }}
              >
                <div
                  style={{
                    padding: 20,
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "#1e293b",
                    borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
                  }}
                >
                  Live Map (Booth-centered)
                </div>
          <div style={{ height: 420 }}>
            {isLoaded ? (
              <GoogleMap
                zoom={14}
                center={booth}
                      mapContainerStyle={{ width: "100%", height: "100%" }}
                      options={{
                        streetViewControl: false,
                        mapTypeControl: false,
                      }}
              >
                {/* Booth marker */}
                <MarkerF position={booth} title="Booth" />
                {/* Pullers */}
                    {onlinePullersList.map((r) =>
                        typeof r.lat === "number" &&
                        typeof r.lng === "number" ? (
                    <MarkerF
                      key={r.uid}
                      position={{ lat: r.lat, lng: r.lng }}
                          title={`${r.name} (${r.state})`}
                          icon={markerIcon(nameToColor(r.name))}
                    />
                  ) : null
                )}
              </GoogleMap>
            ) : (
              <div style={{ padding: 12 }}>Loading map…</div>
            )}
          </div>
        </div>
      </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "Analytics" && (
          <div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 16,
              }}
            >
              📈 Analytics & Insights
            </div>

            {/* Average Metrics */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  borderRadius: 16,
                  padding: 24,
                  color: "white",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  transition: "transform 0.2s ease",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "translateY(-4px)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    opacity: 0.9,
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  Avg Wait Time
                </div>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatDuration(avgWaitMs)}
                </div>
              </div>
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  borderRadius: 16,
                  padding: 24,
                  color: "white",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  transition: "transform 0.2s ease",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "translateY(-4px)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    opacity: 0.9,
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  Avg Completion
                </div>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatDuration(avgCompletionMs)}
                </div>
              </div>
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  borderRadius: 16,
                  padding: 24,
                  color: "white",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  transition: "transform 0.2s ease",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "translateY(-4px)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    opacity: 0.9,
                    marginBottom: 8,
                    fontWeight: 500,
                  }}
                >
                  Avg Distance
                </div>
                <div
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatMeters(avgDistanceMeters)}
                </div>
              </div>
            </div>

            {/* Most Requested Destinations */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: 20,
                marginBottom: 20,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "#1e293b",
                  marginBottom: 16,
                }}
              >
                🗺️ Most Requested Destinations
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                }}
              >
                {topDestinations.map((d) => (
                  <div
                    key={d.key}
                    style={{
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                      background: "white",
                    }}
                  >
                    <div
                      style={{
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background:
                          "linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          color: "#1e293b",
                        }}
                      >
                        {d.key}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background:
                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {d.count} reqs
                      </div>
                    </div>
                    <div style={{ height: 180 }}>
                      {isLoaded ? (
                        <GoogleMap
                          zoom={15}
                          center={{ lat: d.lat, lng: d.lng }}
                          mapContainerStyle={{ width: "100%", height: "100%" }}
                          options={{
                            streetViewControl: false,
                            mapTypeControl: false,
                          }}
                        >
                          <MarkerF
                            position={{ lat: d.lat, lng: d.lng }}
                            title={d.key}
                            icon={markerIcon("#667eea")}
                          />
                        </GoogleMap>
                      ) : (
                        <div
                          style={{
                            padding: 12,
                            fontSize: "0.875rem",
                            color: "#64748b",
                          }}
                        >
                          Loading map…
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Puller Leaderboard */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "#1e293b",
                  marginBottom: 16,
                }}
              >
                🏆 Puller Leaderboard
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {leaderboard.map((r, idx) => (
                  <div
                    key={r.uid}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderRadius: 10,
                      background:
                        idx < 3
                          ? `linear-gradient(135deg, ${
                              idx === 0
                                ? "#fbbf24"
                                : idx === 1
                                ? "#94a3b8"
                                : "#fb923c"
                            }15, ${
                              idx === 0
                                ? "#f59e0b"
                                : idx === 1
                                ? "#64748b"
                                : "#f97316"
                            }15)`
                          : "rgba(0, 0, 0, 0.02)",
                      border: "1px solid rgba(0, 0, 0, 0.03)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background:
                            idx === 0
                              ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
                              : idx === 1
                              ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"
                              : idx === 2
                              ? "linear-gradient(135deg, #fb923c 0%, #f97316 100%)"
                              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 800,
                          fontSize: "0.875rem",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.9375rem",
                          color: "#1e293b",
                        }}
                      >
                        {ridersMap[r.uid]?.name ?? r.uid}
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 16, alignItems: "center" }}
                    >
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#667eea",
                        }}
                      >
                        {r.count} rides
                      </span>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#10b981",
                        }}
                      >
                        {riderPoints[r.uid] ?? 0} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ride History Tab */}
        {activeTab === "Ride History" && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                📜 Recent Ride History
              </div>
              <select
                value={rideFilter}
                onChange={(e) => setRideFilter(e.target.value as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#1e293b",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                {[
                  "all",
                  "active",
                  "accepted",
                  "riding",
                  "drop-off",
                  "cancelled",
                  "timeout",
                  "rejected",
                  "filled",
                ].map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div style={{ display: "grid", gap: 16 }}>
                {filteredRides.slice(0, 50).map((r) => {
                  const ts = r?.timestamp?.toDate?.();
                  const riderUid = r?.rider?.uid ?? r?.acceptedBy ?? undefined;
                  const riderName =
                    r?.rider?.name ??
                    (riderUid ? ridersMap[riderUid]?.name : undefined) ??
                    "—";
                  const metrics = r?.metrics || {};
                  const pickupMetrics = metrics?.pickup || {};
                  const ridingMetrics = metrics?.riding || {};
                  const totalMetrics = metrics?.total || {};
                  const totalDist = totalMetrics?.distanceMeters;
                  const totalTime = totalMetrics?.timeMs;
                  const pickup = r?.location;
                  const dest = r?.destination;
                  const center =
                    pickup?.latitude != null && pickup?.longitude != null
                      ? {
                          lat: Number(pickup.latitude),
                          lng: Number(pickup.longitude),
                        }
                      : dest?.latitude != null && dest?.longitude != null
                      ? {
                          lat: Number(dest.latitude),
                          lng: Number(dest.longitude),
                        }
                      : null;

                  const waitMs =
                    (r?.acceptedAt?.toMillis?.() ?? 0) &&
                    (r?.timestamp?.toMillis?.() ?? 0)
                      ? Math.max(
                          0,
                          r.acceptedAt.toMillis() - r.timestamp.toMillis()
                        )
                      : null;
                  const completionMs =
                    (r?.completedAt?.toMillis?.() ?? 0) &&
                    (r?.acceptedAt?.toMillis?.() ?? 0)
                      ? Math.max(
                          0,
                          r.completedAt.toMillis() - r.acceptedAt.toMillis()
                        )
                      : null;

                  const stateColors: Record<string, string> = {
                    "drop-off": "#10b981",
                    active: "#f59e0b",
                    riding: "#3b82f6",
                    timeout: "#64748b",
                    cancelled: "#ef4444",
                  };
                  const stateColor = stateColors[r.state] ?? "#64748b";

                  return (
                    <div
                      key={r.id}
                      style={{
                        border: "1px solid rgba(0,0,0,0.05)",
                        borderRadius: 12,
                        padding: 20,
                        display: "grid",
                        gap: 16,
                        background: "white",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.boxShadow =
                          "0 4px 16px rgba(0, 0, 0, 0.08)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.boxShadow =
                          "0 2px 8px rgba(0, 0, 0, 0.04)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      {/* Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingBottom: 12,
                          borderBottom: "1px solid rgba(0,0,0,0.05)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "1rem",
                              color: "#1e293b",
                            }}
                          >
                            #{r.requestId ?? r.id.slice(0, 8)}
                          </div>
                          <div
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: `${stateColor}15`,
                              color: stateColor,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {r.state}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "#64748b",
                            fontWeight: 500,
                          }}
                        >
                          {ts ? ts.toLocaleString() : "—"}
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div
                        style={{
                          display: "grid",
                          gap: 16,
                          gridTemplateColumns: "1fr 1fr 1fr",
                        }}
                      >
                        {/* Rider Info */}
                        <div
                          style={{
                            background: "rgba(102, 126, 234, 0.05)",
                            borderRadius: 10,
                            padding: 14,
                            display: "grid",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: nameToColor(riderName),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontSize: "0.875rem",
                                fontWeight: 700,
                              }}
                            >
                              {riderName?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  color: "#1e293b",
                                }}
                              >
                                {riderName}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#64748b",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {riderUid ? riderUid.slice(0, 8) : "—"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Locations */}
                        <div
                          style={{
                            background: "rgba(16, 185, 129, 0.05)",
                            borderRadius: 10,
                            padding: 14,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                color: "#10b981",
                                marginBottom: 4,
                              }}
                            >
                              📍 Pickup
                            </div>
                            <div
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              {pickup
                                ? `${Number(pickup.latitude).toFixed(
                                    4
                                  )}, ${Number(pickup.longitude).toFixed(4)}`
                                : "—"}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                color: "#ef4444",
                                marginBottom: 4,
                              }}
                            >
                              🎯 Destination
                            </div>
                            <div
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              {dest
                                ? `${Number(dest.latitude).toFixed(
                                    4
                                  )}, ${Number(dest.longitude).toFixed(4)}`
                                : "—"}
                            </div>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div
                          style={{
                            background: "rgba(59, 130, 246, 0.05)",
                            borderRadius: 10,
                            padding: 14,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                color: "#3b82f6",
                                marginBottom: 4,
                              }}
                            >
                              ⏱️ Wait Time
                            </div>
                            <div
                              style={{
                                fontSize: "0.875rem",
                                color: "#1e293b",
                                fontWeight: 600,
                              }}
                            >
                              {waitMs != null ? formatDuration(waitMs) : "—"}
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                color: "#3b82f6",
                                marginBottom: 4,
                              }}
                            >
                              🚗 Ride Time
                            </div>
                            <div
                              style={{
                                fontSize: "0.875rem",
                                color: "#1e293b",
                                fontWeight: 600,
                              }}
                            >
                              {completionMs != null
                                ? formatDuration(completionMs)
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Metrics */}
                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "1fr 1fr 1fr",
                          paddingTop: 12,
                          borderTop: "1px solid rgba(0,0,0,0.05)",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.8125rem",
                              color: "#10b981",
                            }}
                          >
                            Pickup Phase
                          </div>
                          <div
                            style={{ fontSize: "0.75rem", color: "#64748b" }}
                          >
                            {formatMeters(pickupMetrics?.distanceMeters)} •{" "}
                            {formatDuration(pickupMetrics?.timeMs ?? 0)}
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.8125rem",
                              color: "#3b82f6",
                            }}
                          >
                            Riding Phase
                          </div>
                          <div
                            style={{ fontSize: "0.75rem", color: "#64748b" }}
                          >
                            {formatMeters(ridingMetrics?.distanceMeters)} •{" "}
                            {formatDuration(ridingMetrics?.timeMs ?? 0)}
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.8125rem",
                              color: "#667eea",
                            }}
                          >
                            Total • Points
                          </div>
                          <div
                            style={{ fontSize: "0.75rem", color: "#64748b" }}
                          >
                            {formatMeters(totalDist)} •{" "}
                            {formatDuration(totalTime ?? 0)} •{" "}
                            <span style={{ color: "#667eea", fontWeight: 600 }}>
                              {(() => {
                                const rid = r?.requestId ?? r?.id;
                                const pts = rid
                                  ? ridePointsByRequest[rid]
                                  : undefined;
                                return pts != null ? `${pts} pts` : "—";
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Map */}
                      <div
                        style={{
                          height: 240,
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        {isLoaded && center ? (
                          <GoogleMap
                            zoom={14}
                            center={center}
                            mapContainerStyle={{
                              width: "100%",
                              height: "100%",
                              borderRadius: 8,
                            }}
                            options={{
                              streetViewControl: false,
                              mapTypeControl: false,
                            }}
                          >
                            {pickup?.latitude != null &&
                            pickup?.longitude != null ? (
                              <MarkerF
                                position={{
                                  lat: Number(pickup.latitude),
                                  lng: Number(pickup.longitude),
                                }}
                                title="Pickup"
                                icon={markerIcon("#16a34a")}
                              />
                            ) : null}
                            {dest?.latitude != null &&
                            dest?.longitude != null ? (
                              <MarkerF
                                position={{
                                  lat: Number(dest.latitude),
                                  lng: Number(dest.longitude),
                                }}
                                title="Destination"
                                icon={markerIcon("#dc2626")}
                              />
                            ) : null}
                          </GoogleMap>
                        ) : (
                          <div style={{ fontSize: 12, color: "gray" }}>
                            Map unavailable
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "Settings" && (
          <div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 16,
              }}
            >
              💰 Point Settings
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: 20,
                display: "grid",
                gap: 16,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    color: "#1e293b",
                  }}
                >
                  Base point per completed ride:
                </span>
          <input
            type="number"
                  value={basePoint ?? ""}
            onChange={(e) => setBasePoint(Number(e.target.value))}
                  style={{
                    width: 100,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    fontSize: "0.875rem",
                  }}
                />
                <Button
                  onClick={saveBasePoint}
                  style={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    fontWeight: 600,
                    border: "none",
                  }}
                >
                  💾 Save
                </Button>
        </div>
              <div style={{ height: 1, background: "rgba(0, 0, 0, 0.05)" }} />
              <div
                style={{
                  display: "none",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    color: "#1e293b",
                  }}
                >
                  Redeem points for rider:
                </span>
                <input
                  placeholder="Rider ID"
                  value={adjustRiderId}
                  onChange={(e) => setAdjustRiderId(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 200,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    fontSize: "0.875rem",
                  }}
                />
          <input
            type="number"
                  placeholder="Points"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  style={{
                    width: 120,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    fontSize: "0.875rem",
                  }}
                />
                <Button
                  onClick={redeemPoints}
                  style={{
                    background:
                      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "white",
                    fontWeight: 600,
                    border: "none",
                  }}
                >
                  💸 Redeem
          </Button>
        </div>
      </div>
          </div>
        )}

        {/* REMOVE THIS DUPLICATE Analytics SECTION - Analytics moved to Analytics Tab */}
        {false && (
          <div>
            <div
                style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 16,
              }}
            >
              📈 Analytics & Insights
                </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: 20,
                display: "grid",
                gap: 20,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    borderRadius: 12,
                    padding: 16,
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      opacity: 0.9,
                      marginBottom: 4,
                    }}
                  >
                    Avg Wait Time
                </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {formatDuration(avgWaitMs)}
                </div>
                  </div>
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    borderRadius: 12,
                    padding: 16,
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      opacity: 0.9,
                      marginBottom: 4,
                    }}
                  >
                    Avg Completion
              </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {formatDuration(avgCompletionMs)}
                  </div>
                </div>
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    borderRadius: 12,
                    padding: 16,
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      opacity: 0.9,
                      marginBottom: 4,
                    }}
                  >
                    Avg Distance
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                    {formatMeters(avgDistanceMeters)}
                  </div>
        </div>
      </div>

              <div style={{ height: 1, background: "rgba(0, 0, 0, 0.05)" }} />

              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "#1e293b",
                  }}
                >
                  🗺️ Most Requested Destinations
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                  }}
                >
          {topDestinations.map((d) => (
                    <div
                      key={d.key}
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 12,
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                        background: "white",
                      }}
                    >
                      <div
                        style={{
                          padding: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background:
                            "linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "#1e293b",
                          }}
                        >
                          {d.key}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background:
                              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {d.count} reqs
                        </div>
                      </div>
                      <div style={{ height: 180 }}>
                        {isLoaded ? (
                          <GoogleMap
                            zoom={15}
                            center={{ lat: d.lat, lng: d.lng }}
                            mapContainerStyle={{
                              width: "100%",
                              height: "100%",
                            }}
                            options={{
                              streetViewControl: false,
                              mapTypeControl: false,
                            }}
                          >
                            <MarkerF
                              position={{ lat: d.lat, lng: d.lng }}
                              title={d.key}
                              icon={markerIcon("#667eea")}
                            />
                          </GoogleMap>
                        ) : (
                          <div
                            style={{
                              padding: 12,
                              fontSize: "0.875rem",
                              color: "#64748b",
                            }}
                          >
                            Loading map…
                          </div>
                        )}
                      </div>
            </div>
          ))}
        </div>
              </div>

              <div style={{ height: 1, background: "rgba(0, 0, 0, 0.05)" }} />

              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "#1e293b",
                  }}
                >
                  🏆 Puller Leaderboard
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {leaderboard.map((r, idx) => (
                    <div
                      key={r.uid}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: 10,
                        background:
                          idx < 3
                            ? `linear-gradient(135deg, ${
                                idx === 0
                                  ? "#fbbf24"
                                  : idx === 1
                                  ? "#94a3b8"
                                  : "#fb923c"
                              }15, ${
                                idx === 0
                                  ? "#f59e0b"
                                  : idx === 1
                                  ? "#64748b"
                                  : "#f97316"
                              }15)`
                            : "rgba(0, 0, 0, 0.02)",
                        border: "1px solid rgba(0, 0, 0, 0.03)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background:
                              idx === 0
                                ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
                                : idx === 1
                                ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"
                                : idx === 2
                                ? "linear-gradient(135deg, #fb923c 0%, #f97316 100%)"
                                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 800,
                            fontSize: "0.875rem",
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.9375rem",
                            color: "#1e293b",
                          }}
                        >
                          {ridersMap[r.uid]?.name ?? r.uid}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "#667eea",
                          }}
                        >
                          {r.count} rides
                        </span>
                        <span
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "#10b981",
                          }}
                        >
                          {riderPoints[r.uid] ?? 0} pts
                        </span>
                      </div>
            </div>
          ))}
        </div>
      </div>
    </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatMeters(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(Number(meters))) return "—";
  const m = Number(meters);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

// Utility: stable color per rider name using a fixed palette
const COLOR_PALETTE = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
];
function nameToColor(name: string): string {
  const key = name || "unknown";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[idx];
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
