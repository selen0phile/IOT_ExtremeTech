import { useEffect, useRef, useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '@/lib/firebase'

export type RiderCoords = {
  lat: number
  lng: number
  accuracy?: number
  heading?: number | null
  speed?: number | null
}

export function useRiderLocation(user: User | null) {
  const [coords, setCoords] = useState<RiderCoords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!user) {
      // cleanup any active watcher if user logs out
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setCoords(null)
      return
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.')
      return
    }

    const onSuccess = async (pos: GeolocationPosition) => {
      const next: RiderCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      }
      setCoords(next)

      // upsert rider doc
      try {
        await setDoc(
          doc(db, 'riders', user.uid),
          {
            uid: user.uid,
            name: user.displayName ?? '',
            location: {
              latitude: next.lat,
              longitude: next.lng,
              accuracy: next.accuracy ?? null,
              heading: next.heading ?? null,
              speed: next.speed ?? null,
              updatedAt: serverTimestamp(),
            },
          },
          { merge: true }
        )
      } catch (e) {
        // capture, but don't break UI updates
        console.error('Failed to update rider location:', e)
      }
    }

    const onError = (err: GeolocationPositionError) => {
      setError(err.message)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 20_000,
    })

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [user])

  return { coords, error }
}


