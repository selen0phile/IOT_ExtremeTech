import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type ActiveNotification = {
  id: string
  requestId: string
  createdAt?: any
  ride?: {
    timestamp?: any
    location?: { latitude: number; longitude: number }
    destination?: { latitude: number; longitude: number }
  }
}

export function useActiveNotification(userId: string | undefined | null) {
  const [latest, setLatest] = useState<ActiveNotification | null>(null)

  useEffect(() => {
    if (!userId) {
      setLatest(null)
      return
    }
    // Query active notifications for this rider
    const q = query(
      collection(db, 'notifications'),
      where('riderId', '==', userId),
      where('state', '==', 'active')
    )
    const unsub = onSnapshot(q, (snap) => {
      const rows: ActiveNotification[] = []
      snap.forEach((d) => {
        const data = d.data() as DocumentData
        rows.push({
          id: d.id,
          requestId: data?.requestId,
          createdAt: data?.createdAt,
          ride: data?.ride,
        })
      })
      rows.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
        return bt - at
      })
      setLatest(rows[0] ?? null)
    })
    return () => unsub()
  }, [userId])

  return { activeNotification: latest }
}


