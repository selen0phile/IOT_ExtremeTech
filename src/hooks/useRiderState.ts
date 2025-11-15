import { useEffect, useState } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import type { DocumentData } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type RiderStateDoc = {
  state: 'idle' | 'requested' | 'pickup' | 'riding'
  requestId?: string | null
  rideRequest?: {
    requestId: string
    timestamp?: any
    location?: { latitude: number; longitude: number }
    destination?: { latitude: number; longitude: number }
  }
}

export function useRiderState(userId: string | undefined | null) {
  const [data, setData] = useState<RiderStateDoc | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!userId) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const ref = doc(db, 'rider_state', userId)
    const unsub = onSnapshot(ref, async (snap) => {
      const d = snap.data() as DocumentData | undefined
      let base: RiderStateDoc | null = d
        ? {
            state: d.state ?? 'idle',
            requestId: d.requestId ?? null,
            rideRequest: d.rideRequest,
          }
        : { state: 'idle', requestId: null, rideRequest: undefined }

      // If we have only requestId but no embedded rideRequest, fetch it
      if (base?.requestId && !base.rideRequest) {
        const rref = doc(db, 'ride_requests', base.requestId)
        const rsnap = await getDoc(rref)
        const rdata = rsnap.data() as DocumentData | undefined
        if (rdata) {
          base = {
            ...base,
            rideRequest: {
              requestId: base.requestId,
              timestamp: rdata.timestamp,
              location: rdata.location
                ? {
                    latitude: rdata.location.latitude,
                    longitude: rdata.location.longitude,
                  }
                : undefined,
              destination: rdata.destination
                ? {
                    latitude: rdata.destination.latitude,
                    longitude: rdata.destination.longitude,
                  }
                : undefined,
            },
          }
        }
      }
      setData(base)
      setLoading(false)
    })
    return () => unsub()
  }, [userId])

  return { riderState: data, loading }
}


