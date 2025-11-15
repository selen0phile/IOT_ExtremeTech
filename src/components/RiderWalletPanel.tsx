import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useRiderBalance } from "@/hooks/useRiderBalance";
import { Button } from "@/components/ui/button";

const POINT_TO_TK = 10;

export default function RiderWalletPanel() {
  const { currentUser } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const { balanceTk } = useRiderBalance(currentUser?.uid);
  const [redeemInput, setRedeemInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!currentUser) return null;

  // Realtime subscribe to rider_points/{uid}
  useEffect(() => {
    if (!currentUser?.uid) {
      setPoints(0);
      setTotalEarned(0);
      return;
    }
    const ref = doc(db, "rider_points", currentUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      const bal = typeof data?.balance === "number" ? data.balance : 0;
      const earned =
        typeof data?.totalEarned === "number" ? data.totalEarned : 0;
      setPoints(bal);
      setTotalEarned(earned);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const redeemAll = async () => {
    const pts = Number(points ?? 0);
    if (!Number.isFinite(pts) || pts <= 0) return;
    await redeemPoints(pts);
  };

  const redeemPoints = async (pts: number) => {
    if (!currentUser) return;
    setError(null);
    if (!Number.isFinite(pts) || pts <= 0) {
      setError("Enter a valid positive number of points");
      return;
    }
    if ((points ?? 0) < pts) {
      setError("Not enough points to redeem");
      return;
    }
    setIsSubmitting(true);
    try {
      const uid = currentUser.uid;
      await runTransaction(db, async (tx) => {
        const pRef = doc(db, "rider_points", uid);
        const bRef = doc(db, "rider_balance", uid);
        const pSnap = await tx.get(pRef);
        const curPts = (pSnap.data() as any)?.balance ?? 0;
        if (typeof curPts !== "number" || curPts < pts) {
          throw new Error("Insufficient points");
        }
        const amountTk = pts * POINT_TO_TK;
        tx.set(
          pRef,
          {
            balance: increment(-pts),
            lastUpdated: serverTimestamp(),
          } as any,
          { merge: true }
        );
        tx.set(
          bRef,
          {
            balanceTk: increment(amountTk),
            totalRedeemedTk: increment(amountTk),
            lastUpdated: serverTimestamp(),
          } as any,
          { merge: true }
        );
        const pTxnRef = doc(
          collection(db, "rider_points", uid, "transactions")
        );
        tx.set(pTxnRef, {
          id: pTxnRef.id,
          type: "redeem",
          points: pts,
          amountTk,
          at: serverTimestamp(),
        } as any);
        const bTxnRef = doc(
          collection(db, "rider_balance", uid, "transactions")
        );
        tx.set(bTxnRef, {
          id: bTxnRef.id,
          type: "credit",
          reason: "redeem_points",
          points: pts,
          amountTk,
          at: serverTimestamp(),
        } as any);
      });
      setRedeemInput("");
    } catch (e: any) {
      setError(e?.message ?? "Redeem failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRedeemClick = async () => {
    const pts = Number(redeemInput);
    if (!Number.isFinite(pts)) {
      setError("Enter a number");
      return;
    }
    await redeemPoints(Math.floor(pts));
  };

  const previewTk = Number.isFinite(Number(redeemInput))
    ? Number(redeemInput) * POINT_TO_TK
    : 0;

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.95)",
        border: "1px solid rgba(0, 0, 0, 0.05)",
        borderRadius: 16,
        padding: 20,
        display: "grid",
        gap: 16,
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
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
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            display: "inline-block",
          }}
        />
        Wallet
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: 12,
            padding: 16,
            color: "white",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: 4 }}>
            Points
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            {points ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginTop: 4 }}>
            Earned total: {totalEarned ?? 0}
          </div>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            borderRadius: 12,
            padding: 16,
            color: "white",
          }}
        >
          <div style={{ fontSize: "0.75rem", opacity: 0.9, marginBottom: 4 }}>
            Balance
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            {balanceTk ?? 0} ৳
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(102, 126, 234, 0.05)",
          borderRadius: 10,
          padding: 12,
          fontSize: "0.8125rem",
          color: "#667eea",
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        💡 1 point = {POINT_TO_TK} ৳
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}
        >
          Redeem Points
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            type="number"
            min={1}
            placeholder="Points"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0, 0, 0, 0.1)",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
          <Button
            size="default"
            onClick={onRedeemClick}
            disabled={isSubmitting}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              fontWeight: 600,
              border: "none",
              padding: "10px 20px",
            }}
          >
            Redeem
          </Button>
        </div>
        {redeemInput && Number(redeemInput) > 0 && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#10b981",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            You'll receive {previewTk} ৳
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={redeemAll}
          disabled={isSubmitting || (points ?? 0) <= 0}
          style={{
            borderColor: "rgba(102, 126, 234, 0.3)",
            color: "#667eea",
            fontWeight: 600,
          }}
        >
          Redeem All ({points ?? 0} pts → {(points ?? 0) * POINT_TO_TK} ৳)
        </Button>
      </div>

      {error ? (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 8,
            padding: 10,
            color: "#dc2626",
            fontSize: "0.8125rem",
            fontWeight: 500,
          }}
        >
          ⚠️ {error}
        </div>
      ) : null}
    </div>
  );
}
