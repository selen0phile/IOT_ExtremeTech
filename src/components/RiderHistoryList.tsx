import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GoogleMap, MarkerF, useLoadScript } from "@react-google-maps/api";
import { doc, getDoc } from "firebase/firestore";

type NotificationItem = {
  id: string;
  requestId: string;
  state:
    | "active"
    | "accepted"
    | "rejected"
    | "timeout"
    | "filled"
    | "riding"
    | "cancelled"
    | "complete";
  createdAt?: any;
  ride?: {
    timestamp?: any;
    location?: { latitude: number; longitude: number };
    destination?: { latitude: number; longitude: number };
  };
  rider?: {
    uid?: string;
    name?: string;
    location?: { latitude: number; longitude: number } | null;
  };
};

const FILTERS = ["all", "complete", "cancelled", "timeout", "rejected", "accepted", "filled", "riding"] as const;
type Filter = (typeof FILTERS)[number];

export default function RiderHistoryList() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [earnedByRequest, setEarnedByRequest] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!currentUser) {
      setItems([]);
      setEarnedByRequest({});
      return;
    }
    const q = query(collection(db, "notifications"), where("riderId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows: NotificationItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as DocumentData;
        rows.push({
          id: d.id,
          requestId: data?.requestId,
          state: data?.state,
          createdAt: data?.createdAt,
          ride: data?.ride,
          rider: data?.rider
            ? {
                uid: data.rider.uid,
                name: data.rider.name,
                location: data.rider.location
                  ? {
                      latitude: data.rider.location.latitude,
                      longitude: data.rider.location.longitude,
                    }
                  : null,
              }
            : undefined,
        });
      });
      rows.sort((a, b) => {
        const at = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      setItems(rows);
    });
    return () => unsub();
  }, [currentUser]);

  // Subscribe to rider_points/{uid}/transactions to read actual earned points per request
  useEffect(() => {
    if (!currentUser) {
      setEarnedByRequest({});
      return;
    }
    const unsub = onSnapshot(collection(db, "rider_points", currentUser.uid, "transactions"), (snap) => {
      const map: Record<string, number> = {};
      snap.forEach((d) => {
        const data = d.data() as any;
        if (data?.type === "earn" && typeof data?.amount === "number" && typeof data?.requestId === "string") {
          map[data.requestId] = data.amount;
        }
      });
      setEarnedByRequest(map);
    });
    return () => unsub();
  }, [currentUser]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.state === filter);
  }, [items, filter]);

  const basePoint = 10; // UI-only hint; actual points are awarded server/client elsewhere
  const pointsFor = (state: NotificationItem["state"]) => {
    if (state === "complete") return +basePoint;
    if (state === "cancelled") return -basePoint;
    return 0;
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "#1e293b",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              display: "inline-block",
            }}
          />
          Ride History
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
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
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            color: "#64748b",
            fontSize: "0.875rem",
            border: "1px solid rgba(0, 0, 0, 0.05)",
          }}
        >
          No ride history found.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((n) => {
            const ts = n.createdAt?.toDate ? n.createdAt.toDate() : null;
            const ptsTxn = earnedByRequest[n.requestId];
            const pts = ptsTxn != null ? ptsTxn : pointsFor(n.state);
            const from = n.ride?.location;
            const to = n.ride?.destination;
            
            const stateColors: Record<string, string> = {
              complete: "#10b981",
              cancelled: "#ef4444",
              timeout: "#f59e0b",
              rejected: "#64748b",
              accepted: "#3b82f6",
              filled: "#8b5cf6",
              riding: "#06b6d4",
            };
            const stateColor = stateColors[n.state] ?? "#64748b";
            
            return (
              <div
                key={n.id}
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(0, 0, 0, 0.05)",
                  borderRadius: 12,
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>
                    #{n.requestId.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: `${stateColor}15`,
                      color: stateColor,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {n.state.toUpperCase()}
                  </div>
                  {pts !== 0 && (
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: pts > 0 ? "#10b98115" : "#ef444415",
                        color: pts > 0 ? "#10b981" : "#ef4444",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {pts > 0 ? `+${pts}` : pts} pts
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5 }}>
                  <div>From: {from ? `${from.latitude?.toFixed?.(5)}, ${from.longitude?.toFixed?.(5)}` : "—"}</div>
                  <div>To: {to ? `${to.latitude?.toFixed?.(5)}, ${to.longitude?.toFixed?.(5)}` : "—"}</div>
                </div>
                <div>
                  <DetailsDialog item={n} earned={earnedByRequest[n.requestId]} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailsDialog({ item, earned }: { item: NotificationItem; earned?: number }) {
  const apiKey =
    (import.meta.env as any).VITE_GOOGLE_MAPS_API_KEY ||
    (import.meta.env as any).GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useLoadScript({ googleMapsApiKey: apiKey ?? "", id: "rixa-history-map" });
  const [metrics, setMetrics] = useState<any | null>(null);
  const [basePoint, setBasePoint] = useState<number>(10);

  useEffect(() => {
    const load = async () => {
      try {
        const rsnap = await getDoc(doc(db, "ride_requests", item.requestId));
        setMetrics((rsnap.data() as any)?.metrics ?? null);
      } catch {}
      try {
        const csnap = await getDoc(doc(db, "admin_config", "global"));
        const c = csnap.data() as any;
        if (typeof c?.basePoint === "number") setBasePoint(c.basePoint);
      } catch {}
    };
    load();
  }, [item.requestId]);

  const points =
    typeof earned === "number"
      ? earned
      : item.state === "complete"
      ? +basePoint
      : item.state === "cancelled"
      ? -basePoint
      : 0;

  const from = item.ride?.location;
  const to = item.ride?.destination;
  const rider = item.rider?.location ?? null;
  const center =
    rider
      ? { lat: rider.latitude, lng: rider.longitude }
      : from
      ? { lat: from.latitude, lng: from.longitude }
      : to
      ? { lat: to.latitude, lng: to.longitude }
      : { lat: 0, lng: 0 };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Ride details</DialogTitle>
        </DialogHeader>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ height: 260, borderRadius: 8, overflow: "hidden" }}>
            {isLoaded ? (
              <GoogleMap
                zoom={14}
                center={center}
                mapContainerStyle={{ width: "100%", height: "100%" }}
                options={{ streetViewControl: false, mapTypeControl: false }}
              >
                {rider ? (
                  <MarkerF
                    position={{ lat: rider.latitude, lng: rider.longitude }}
                    title="Rider at request time"
                    icon={markerIcon("#2563eb")}
                  />
                ) : null}
                {from ? (
                  <MarkerF
                    position={{ lat: from.latitude, lng: from.longitude }}
                    title="Pickup"
                    icon={markerIcon("#16a34a")}
                  />
                ) : null}
                {to ? (
                  <MarkerF
                    position={{ lat: to.latitude, lng: to.longitude }}
                    title="Destination"
                    icon={markerIcon("#dc2626")}
                  />
                ) : null}
              </GoogleMap>
            ) : (
              <div>Loading map…</div>
            )}
          </div>
          <div style={{ color: "gray", fontSize: 12 }}>
            Requested at:{" "}
            {item.ride?.timestamp?.toDate
              ? item.ride.timestamp.toDate().toLocaleString()
              : item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleString()
              : "—"}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div>Status: {item.state}</div>
            {metrics ? (
              <div style={{ fontSize: 12 }}>
                elapsed: {formatDuration(metrics?.total?.timeMs ?? 0)} — distance:{" "}
                {metrics?.total?.distanceMeters ?? "—"} m
              </div>
            ) : null}
            <div>Points: {points > 0 ? `+${points}` : points}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}


