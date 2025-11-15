import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import type { RiderCoords } from '@/hooks/useRiderLocation'
import { haversineDistanceMeters } from '@/lib/geo'

type RiderRow = {
  uid: string
  name: string
  lat: number
  lng: number
  updatedAt: Date | null
}

function formatDistance(meters: number | null): string {
  if (meters == null || Number.isNaN(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export default function ActiveRidersList({
  currentCoords,
  activeMs = 2 * 60 * 1000, // 2 minutes active window
}: {
  currentCoords: RiderCoords | null
  activeMs?: number
}) {
  const { currentUser } = useAuth()
  const [riders, setRiders] = useState<RiderRow[]>([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'riders'), (snap) => {
      const rows: RiderRow[] = []
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any
        const updatedAtTs = data?.location?.updatedAt
        const updatedAt: Date | null =
          updatedAtTs?.toDate ? updatedAtTs.toDate() : null
        const lat = data?.location?.latitude
        const lng = data?.location?.longitude
        const name = data?.name ?? ''
        const uid = data?.uid ?? docSnap.id
        if (typeof lat === 'number' && typeof lng === 'number') {
          rows.push({ uid, name, lat, lng, updatedAt })
        }
      })
      setRiders(rows)
    })
    return () => unsub()
  }, [])

  const { activeRidersSorted, now } = useMemo(() => {
    const now = Date.now()
    const cutoff = now - activeMs
    const filtered = riders.filter((r) => {
      if (!r.updatedAt) return false
      return r.updatedAt.getTime() >= cutoff
    })
    const withDistance = filtered
      .filter((r) => r.uid !== currentUser?.uid)
      .map((r) => {
        const distance =
          currentCoords != null
            ? haversineDistanceMeters(
                currentCoords.lat,
                currentCoords.lng,
                r.lat,
                r.lng
              )
            : null
        return { ...r, distance }
      })
    withDistance.sort((a, b) => {
      if (a.distance == null && b.distance == null) return 0
      if (a.distance == null) return 1
      if (b.distance == null) return -1
      return a.distance - b.distance
    })
    return { activeRidersSorted: withDistance, now }
  }, [riders, currentCoords, currentUser?.uid, activeMs])

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'inline-block',
          }}
        />
        Active Pullers Nearby
      </div>
      {activeRidersSorted.length === 0 ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.875rem',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          }}
        >
          No active pullers found nearby.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {activeRidersSorted.map((r) => {
            const ago =
              r.updatedAt != null
                ? Math.max(0, Math.round((now - r.updatedAt.getTime()) / 1000))
                : null
            return (
              <div
                key={r.uid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  padding: '14px 16px',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                    }}
                  >
                    {r.name?.charAt(0)?.toUpperCase() ?? 'R'}
                  </div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1e293b' }}>
                      {r.name || 'Unnamed puller'}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      {ago != null ? `${ago}s ago` : 'Recently active'}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9375rem',
                    color: '#667eea',
                  }}
                >
                  {formatDistance(r.distance ?? null)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


