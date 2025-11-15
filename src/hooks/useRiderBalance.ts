import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useRiderBalance(userId: string | undefined | null) {
  const [balanceTk, setBalanceTk] = useState<number | null>(null)
  useEffect(() => {
    if (!userId) {
      setBalanceTk(null)
      return
    }
    const ref = doc(db, 'rider_balance', userId)
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any
      setBalanceTk(typeof data?.balanceTk === 'number' ? data.balanceTk : 0)
    })
    return () => unsub()
  }, [userId])
  return { balanceTk }
}


