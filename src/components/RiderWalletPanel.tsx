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

  // const redeemAll = async () => {
  //   const pts = Number(points ?? 0);
  //   if (!Number.isFinite(pts) || pts <= 0) return;
  //   await redeemPoints(pts);
  // };

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
    <div className="bg-white/95 p-4 border border-black/5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
      <div className="text-xl font-bold text-gray-700 flex items-center gap-2">
        💰 Wallet
      </div>
      <div className="mb-4"></div>
      <div className="flex items-center gap-4">
        <div className="border text- flex-1 from-blue-500/90 to-purple-500/90  rounded-lg p-4 flex flex-col justify-between h-32">
          <div className="text-sm opacity-90 mb-2">Points</div>
          <div className="text-2xl font-bold">{points ?? 0}</div>
          <div className="text-sm opacity-90 mt-2">
            Earned: {totalEarned ?? 0}
          </div>
        </div>
        <div className="flex-1 border from-green-500/90 to-green-400/90 rounded-lg p-4 flex flex-col  h-32 justify-between">
          <div className="text-sm opacity-90 mb-2">Balance</div>
          <div className="text-2xl font-bold">{balanceTk ?? 0} ৳</div>
        </div>
        {/* 💡 1 point = {POINT_TO_TK} ৳ */}
      </div>
      <div className="mb-4"></div>
      <div className="flex flex-col gap-4">
        <div className="font-semibold text-gray-700">💫 Redeem Points</div>
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
          // className="bg-gradient-to-br from-blue-500/90 to-purple-500/90 text-white"
        >
          Redeem
        </Button>
        {redeemInput && Number(redeemInput) > 0 && (
          <div className="text-sm text-green-500 font-semibold text-center">
            You'll receive {previewTk} ৳
          </div>
        )}

        {/* <Button
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
        </Button> */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-500 font-semibold text-center">
            ⚠️ {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
