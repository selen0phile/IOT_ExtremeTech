import { useMemo } from 'react'
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api'
import type { RiderCoords } from '@/hooks/useRiderLocation'

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '320px',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
  border: '1px solid rgba(0, 0, 0, 0.05)',
  marginBottom: 20,
}

export function RiderMap({
  coords,
}: {
  coords: RiderCoords | null
}) {
  const apiKey =
    (import.meta.env as unknown as Record<string, string | undefined>)
      .VITE_GOOGLE_MAPS_API_KEY ||
    (import.meta.env as unknown as Record<string, string | undefined>)
      .GOOGLE_MAPS_API_KEY

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey ?? '',
    id: 'rixa-google-maps',
  })

  const center = useMemo(() => {
    if (coords) {
      return { lat: coords.lat, lng: coords.lng }
    }
    // Default to a neutral center if coords unavailable
    return { lat: 20, lng: 0 }
  }, [coords])

  if (!apiKey) {
    return <div>Missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY in .env.</div>
  }

  if (loadError) {
    return <div>Failed to load Google Maps.</div>
  }

  if (!isLoaded) {
    return <div>Loading map…</div>
  }

  return (
    <div style={containerStyle}>
      <GoogleMap
        zoom={coords ? 16 : 2}
        center={center}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {coords ? (
          <MarkerF
            position={{ lat: coords.lat, lng: coords.lng }}
            title="Your current location"
          />
        ) : null}
      </GoogleMap>
    </div>
  )
}

export default RiderMap


