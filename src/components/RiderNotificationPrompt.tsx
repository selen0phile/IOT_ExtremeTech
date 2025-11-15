import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type NotificationDoc = {
  id: string;
  requestId: string;
  riderId: string;
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
};

const PER_RIDER_TIMEOUT_MS = 10_000;

export default function RiderNotificationPrompt() {
  const { currentUser } = useAuth();
  const [notifs, setNotifs] = useState<NotificationDoc[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [lastActiveIds, setLastActiveIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifs([]);
      return;
    }
    const qSimple = query(
      collection(db, "notifications"),
      where("riderId", "==", currentUser.uid)
    );
    const unsub = onSnapshot(qSimple, (snap: any) => {
      const rows: NotificationDoc[] = [];
      snap.forEach((d: any) => {
        const data = d.data() as DocumentData;
        rows.push({
          id: d.id,
          requestId: data?.requestId,
          riderId: data?.riderId,
          state: data?.state,
          createdAt: data?.createdAt,
          ride: data?.ride,
        });
      });
      rows.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      // Detect newly active notifications to play bell
      try {
        const nextActive = new Set<string>();
        let shouldRing = false;
        for (const n of rows) {
          if (n.state === "active") {
            nextActive.add(n.id);
            if (!lastActiveIds.has(n.id)) {
              shouldRing = true;
            }
          }
        }
        if (shouldRing) {
          const audio = new Audio("/bell.mp3");
          // best-effort play; may be blocked until user gesture on some browsers
          audio.play().catch(() => {});
        }
        setLastActiveIds(nextActive);
      } catch {}
      setNotifs(rows);
    });
    return () => unsub();
  }, [currentUser]);

  if (!currentUser) return null;

  const onAccept = async (n: NotificationDoc, remainingMs: number) => {
    if (n.state !== "active" || remainingMs <= 0) return;
    await Promise.all([
      setDoc(
        doc(db, "notifications", n.id),
        { state: "accepted" },
        { merge: true }
      ),
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        {
          state: "pickup",
          requestId: n.requestId,
          updatedAt: new Date(),
        },
        { merge: true }
      ),
    ]);
  };

  const onReject = async (n: NotificationDoc) => {
    if (n.state !== "active") return;
    await Promise.all([
      setDoc(
        doc(db, "notifications", n.id),
        { state: "rejected" },
        { merge: true }
      ),
      setDoc(
        doc(db, "rider_state", currentUser.uid),
        {
          state: "idle",
          requestId: null,
          updatedAt: new Date(),
        },
        { merge: true }
      ),
    ]);
  };

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      {notifs.length === 0 ? null : (
        <div style={{ fontWeight: 700 }}>Ride notifications</div>
      )}
      {notifs.map((n) => {
        const created = n.createdAt?.toMillis ? n.createdAt.toMillis() : now;
        const expires = created + PER_RIDER_TIMEOUT_MS;
        const remainingMs = Math.max(0, expires - now);
        const secs = Math.ceil(remainingMs / 1000);
        const from = n.ride?.location;
        const to = n.ride?.destination;
        const canAct = n.state === "active" && remainingMs > 0;
        return (
          <div
            key={n.id}
            style={{
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 8,
              padding: 12,
              display: "grid",
              gap: 8,
              background: "var(--color-card)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontWeight: 700 }}>Request {n.requestId}</div>
              <div style={{ color: "gray" }}>
                {canAct ? `${secs}s` : n.state}
              </div>
            </div>
            <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
              <div>
                From:{" "}
                {from
                  ? `${from.latitude.toFixed(5)}, ${from.longitude.toFixed(5)}`
                  : "—"}
              </div>
              <div>
                To:{" "}
                {to
                  ? `${to.latitude.toFixed(5)}, ${to.longitude.toFixed(5)}`
                  : "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="default"
                disabled={!canAct}
                onClick={() => onAccept(n, remainingMs)}
              >
                Accept
              </Button>
              <Button
                variant="destructive"
                disabled={!canAct}
                onClick={() => onReject(n)}
              >
                Reject
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
