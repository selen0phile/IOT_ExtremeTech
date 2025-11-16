## Rixa Project Summary

### Overview
- Rixa is a real-time ride assignment system built with React (Vite + TypeScript) on the client and a Node.js WebSocket server for back-end orchestration. Firebase is used for authentication (Google), Firestore as the primary data store, and Google Maps JavaScript API for mapping.
- Core flow: A requester sends a ride request via WebSocket → the server persists it to Firestore → a background processor assigns nearby idle riders in distance order using Firestore data → riders accept/reject in the app → upon acceptance, the server streams realtime rider-to-pickup distance to the requesting client.

### Key Technologies
- Frontend: React, Vite, TypeScript, Google Maps JavaScript API
- Auth/Data: Firebase Auth (Google), Firestore
- Backend: Node.js, ws, Firebase Admin SDK

### Data Model (Firestore)
- `ride_requests/{requestId}`
  - `state`: 'active' | 'accepted' | 'riding' | 'drop-off' | 'timeout'
  - `timestamp`, `receivedAt`: Timestamp
  - `location`: GeoPoint, `destination`: GeoPoint
  - `acceptedBy`?, `acceptedAt`?
  - `timedOutAt`?, `timeoutReason`?
  - `rider`?: { uid, name, location: GeoPoint, assignedAt }
  - `metrics`?: pickup/riding/total { timeMs, distanceMeters }
- `notifications/{id}`
  - `requestId`, `riderId`, `state`: 'active' | 'accepted' | 'rejected' | 'timeout' | 'filled' | 'riding' | 'cancelled' | 'complete'
  - `createdAt`, `acceptedAt`?, `resolvedAt`?
  - `ride`: { timestamp, location, destination }, `rider`? { uid, name, location? }
- `riders/{uid}`
  - `uid`, `name`
  - `location`: { latitude, longitude, accuracy?, heading?, speed?, updatedAt }
- `rider_state/{uid}`
  - `state`: 'idle' | 'requested' | 'pickup' | 'riding'
  - `requestId`?, `rideRequest`? (embedded snapshot), `updatedAt`
- `rider_points/{uid}`
  - `balance`, `totalEarned`?, `lastUpdated`
  - Subcollection `transactions/{id}`: type 'earn' | 'redeem' | 'admin_redeem'; fields such as `requestId`, `amount` (points), `amountTk` (cash), `at`
- `rider_balance/{uid}`
  - `balanceTk`, `totalRedeemedTk`?, `lastUpdated`
  - Subcollection `transactions/{id}`: `type: 'credit'`, `reason: 'redeem_points' | 'admin_redeem'`, `points`, `amountTk`, `at`
- `admin_config/global`
  - `basePoint` (default points per completed ride)

### Backend Server (`server.ts`)
- WebSocket server on `ws://localhost:8080`.
- On `message`:
  - Parses payload `{ location, destination }`.
  - Persists a new `ride_requests/{requestId}` with `state: 'active'` (server timestamp).
  - Registers the WS client under the `requestId` to push future updates (e.g., distance, “No rider found”).
  - Immediate reply: `{"message":"Request received"}`.
- Background Processing (Polling):
  - A loop runs every 3 seconds (`processActiveRequestsTick`) to fetch all `ride_requests` where `state == 'active'`.
  - If a request is older than 60s, it is marked `timeout` and the requester receives `{"message":"No rider found"}`.
  - For each new active request not in-flight, calls `assignRideToNearestRiders`.
- Assignment (`assignRideToNearestRiders`):
  - Computes nearest idle riders via `getNearestIdleRiders(origin)` (haversine distance from Firestore `riders` + `rider_state`).
  - Excludes riders who previously `rejected` or `cancelled` this same request (do-not-resend rule).
  - Sends notifications sequentially with a 3-second delay between candidates (distance order). Each notification:
    - Creates `notifications/{id}` with state `active`, embeds ride snapshot, and sets `rider_state/{uid} = requested`.
    - Sets a per-notification timeout of 10s → if still `active`, marks the notification `timeout` and rider_state back to `idle`.
  - Listens for the first `accepted` notification within a 60s window:
    - Transactionally marks `ride_requests/{requestId}` as `accepted` with `acceptedBy` and `acceptedAt`.
    - Marks other active notifications as `filled`; resets their `rider_state` to `idle`.
    - Sets the winner’s `rider_state` to `pickup` with an embedded `rideRequest` snapshot.
    - Starts distance streaming to the original WS client(s) that created the request.
  - If no acceptance within 60s → `ride_requests` marked `timeout`, WS gets `{"message":"No rider found"}`; any leftover `active` notifications marked `timeout` and riders reset to `idle`.
- Realtime Distance Streaming:
  - After acceptance, subscribes to `riders/{riderId}` location changes and computes distance to pickup.
  - Pushes messages like `{"message":"Distance: 123 m"}` to the WS client(s) for that `requestId`.
  - Stops streaming when no clients remain or rider leaves `pickup` (on entering `riding`, sends `{"message":"Arrived"}` and stops).
- Heartbeats:
  - (Optional) Per-connection heartbeat can send `{"message":"heartbeat"}`; commented where appropriate.

### Frontend (Key Components)
- `src/components/RiderNotificationPrompt.tsx`
  - Subscribes to `notifications` for the current rider.
  - Sorts latest first, shows 10s countdown for `active` notifications.
  - Plays `public/bell.mp3` once for newly active notifications.
  - Accept → sets notification `accepted`, `rider_state = pickup` with embedded request.
  - Reject → sets notification `rejected`, `rider_state = idle`.
- `src/components/PickupRideView.tsx`
  - Uses Google Maps to display user, pickup, and destination markers.
  - Stable map camera: initial fit happens once; further movement does not recenter or zoom.
  - Tracks distances and durations during pickup and riding states; cancel reverts ride request to `active` and deducts base points; complete awards points, writes `metrics`, and marks request `drop-off`.
- `src/components/RiderHistoryList.tsx`
  - Shows rider’s ride history from `notifications`; displays date+time.
  - Subscribes to `rider_points/{uid}/transactions` to display actual earned points per request (e.g., 15 vs fixed base).
  - “Details” dialog shows a mini-map, timestamps, and totals.
- `src/components/RiderWalletPanel.tsx`
  - Shows points (`rider_points.balance`) and cash (`rider_balance.balanceTk`) in realtime.
  - Redeem points → transactionally decrement points, credit cash (1 point = 10 tk), and create transaction entries in both collections.
- `src/pages/Admin.tsx`
  - Realtime counters for active requests and active rides.
  - Online pullers list (within last 10s), sorted by distance to booth; live map for their locations.
  - Ride history panel with comprehensive ride details + tiny maps.
  - Analytics: average wait/completion time, average distance, top destinations (with per-destination maps), puller leaderboard (rides + points + tk).
  - Points settings and admin redeem (transactionally moves rider points to cash).
- `src/components/ActiveRidersList.tsx`
  - Realtime `riders` subscription; filters by `updatedAt` window (e.g., 2 minutes, or customized usage).

### WebSocket Client (`client.ts`)
- CLI utility to send a ride request and observe all messages:
  - `npx tsx client.ts --from "lat,lng" --to "lat,lng" --url ws://localhost:8080`
  - Keeps the connection open; logs all messages (e.g., “Request received”, heartbeats, “Distance: N m”, “No rider found”).

### Notable Rules & Behaviors
- Sequential rider notifications with a 3-second gap (distance order).
- Per-rider 10s response timer; after 60s overall, the request times out.
- Once a rider cancels or rejects a specific request, they will not be notified again for that request.
- When a rider cancels before pickup:
  - `rider_state`: pickup → idle, `requestId` cleared, points deducted
  - `notifications`: accepted → cancelled
  - `ride_requests`: accepted → active (re-queued)
  - Distance streaming stops
- Only while `pickup`, the server streams distance; when the rider transitions to `riding`, a final “Arrived” message is sent and streaming is stopped.

### Configuration & Keys
- Firebase web config is loaded from `src/lib/firebase.ts` (project: `rixa2-8042b`).
- Google Maps JavaScript API key is required:
  - Set `VITE_GOOGLE_MAPS_API_KEY` (or `GOOGLE_MAPS_API_KEY`) in `.env.local`.
  - Components use `useLoadScript` to load Maps.
- Server uses Firebase Admin SDK credentials (`firebase-creds.json`). Ensure correct service account for the project.

### Developer Notes
- The server logs helpful traces: processing ticks, accepted events, stream start/stop, and messages pushed to clients.
- Admin dashboard uses Firestore listeners heavily; be mindful of index requirements for complex queries.

### High-Level Flow
1) Client sends request (WS) → Firestore `ride_requests (active)`
2) Background poller assigns nearest eligible idle riders → sequential notifications
3) First acceptance within 60s wins → `ride_requests (accepted)` + stream distance
4) Rider confirms pickup → `rider_state (riding)` and later completes → `ride_requests (drop-off)` with `metrics`; points awarded
5) If no acceptance by 60s → `ride_requests (timeout)` and WS receives “No rider found”


