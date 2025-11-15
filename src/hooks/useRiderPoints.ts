import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useRiderPoints(userId: string | undefined | null) {
  const [balance, setBalance] = useState<number | null>(null)
  useEffect(() => {
    if (!userId) {
      setBalance(null)
      return
    }
    const ref = doc(db, 'rider_points', userId)
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any
      setBalance(typeof data?.balance === 'number' ? data.balance : 0)
    })
    return () => unsub()
  }, [userId])
  return { balance }
}


