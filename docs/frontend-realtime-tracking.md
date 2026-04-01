# Frontend Guide: Real-Time Shipment Tracking

This guide explains how to implement continuous location tracking in the frontend app using the backend already available in this repository.

## 1. Backend Contract You Must Follow

### 1.1 REST base URL

- Base URL: `http://<BACKEND_HOST>:3000/api/v1`

### 1.2 WebSocket connection

- Socket.IO host: `http://<BACKEND_HOST>:3000`
- Socket.IO namespace: `/ws`
- Socket.IO path: default (`/socket.io`)

Use this in client:

- `io('http://<BACKEND_HOST>:3000/ws')`

Do not use:

- `http://<BACKEND_HOST>:3000/ws/socket.io` (wrong)
- `http://<BACKEND_HOST>:3000/api/v1` for websocket (that is REST only)

### 1.3 WebSocket events used for tracking

Client emits:

- `shipment.subscribe` with `{ shipmentId }`
- `shipment.location.update` with:
  - `shipmentId: number`
  - `lat: number`
  - `lng: number`
  - `speed?: number`
  - `heading?: number`
  - `recordedAt?: string` (ISO)

Server emits:

- `system.joined`
- `system.error`
- `shipment.location.snapshot` (last known location after subscribe)
- `shipment.location.changed` (broadcast update)
- `shipment.location.ack` (acknowledges your own location update)

### 1.4 REST endpoints for location

- `GET /logistics/shipments/:id/location/latest`
- `GET /logistics/shipments/:id/location/history?limit=100&before=2026-03-09T00:00:00.000Z`

### 1.5 Authorization rules

Shipment tracking rooms are restricted.

- Organizer: allowed
- Assigned volunteer: allowed
- Others: denied

If denied, backend emits `system.error`.

## 2. Recommended Frontend Architecture

Create one tracking module/service in frontend:

- `trackingSocket.ts`: socket lifecycle, reconnect, subscribe, send updates
- `trackingLocation.ts`: device GPS watch and throttling
- `trackingApi.ts`: latest/history fallback via REST

Keep one source of truth in state:

- `connectionStatus`
- `lastLocation`
- `trackHistory`
- `lastAckAt`

## 3. Socket Client Setup (With Auto-Reconnect)

```ts
import { io, Socket } from 'socket.io-client';

type TrackingSocketOptions = {
  backendHost: string;
  token?: string;
};

export function createTrackingSocket({
  backendHost,
  token,
}: TrackingSocketOptions): Socket {
  const socket = io(`${backendHost}/ws`, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 20000,
    auth: token ? { token } : undefined,
  });

  return socket;
}
```

Important:

- On reconnect you must subscribe again (`shipment.subscribe`), because room membership is socket-session based.

## 4. Tracking Flow (End-to-End)

1. User opens shipment tracking screen.
2. Frontend connects socket.
3. Frontend emits `shipment.subscribe`.
4. Backend responds with `system.joined` and, if available, `shipment.location.snapshot`.
5. Frontend starts GPS watcher.
6. Frontend emits `shipment.location.update` periodically.
7. Backend broadcasts `shipment.location.changed` to room listeners.
8. Frontend updates map in real time.

## 5. React Native / Expo Location Capture

Example using `expo-location`:

```ts
import * as Location from 'expo-location';

export async function startLocationWatch(
  onPoint: (p: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    recordedAt: string;
  }) => void,
) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,
      distanceInterval: 10,
    },
    (loc) => {
      onPoint({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        speed:
          typeof loc.coords.speed === 'number' ? loc.coords.speed : undefined,
        heading:
          typeof loc.coords.heading === 'number'
            ? loc.coords.heading
            : undefined,
        recordedAt: new Date(loc.timestamp).toISOString(),
      });
    },
  );
}
```

## 6. Emit Location Updates Safely

Backend currently rate-limits `shipment.location.update` to 1 event every 2000 ms per socket.

Recommended frontend behavior:

- Send every 2-5 seconds.
- Skip duplicated points (same lat/lng with minimal movement).
- Queue when offline and flush small batch when reconnected.

```ts
function emitLocationUpdate(
  socket: Socket,
  shipmentId: number,
  point: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    recordedAt: string;
  },
) {
  socket.emit('shipment.location.update', {
    shipmentId,
    lat: point.lat,
    lng: point.lng,
    speed: point.speed,
    heading: point.heading,
    recordedAt: point.recordedAt,
  });
}
```

## 7. Reconnection and Room Rejoin

```ts
export function wireTrackingSocket(
  socket: Socket,
  shipmentId: number,
  onLocationChanged: (payload: any) => void,
  onError: (message: string) => void,
) {
  const subscribe = () => {
    socket.emit('shipment.subscribe', { shipmentId });
  };

  socket.on('connect', () => {
    subscribe();
  });

  socket.on('system.joined', (payload) => {
    // optional: update UI status
    console.log('Joined room', payload?.room);
  });

  socket.on('shipment.location.snapshot', onLocationChanged);
  socket.on('shipment.location.changed', onLocationChanged);

  socket.on('system.error', (e) => {
    onError(e?.message ?? 'Unknown websocket error');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected', reason);
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log('Reconnect attempt', attempt);
  });

  socket.io.on('reconnect', () => {
    // connect already fired; keep this only for logging
    console.log('Socket reconnected');
  });
}
```

## 8. REST Fallback Strategy

When entering tracking screen:

1. Call `GET /logistics/shipments/:id/location/latest` to paint initial marker fast.
2. Connect websocket and subscribe.
3. If websocket is unstable, poll latest endpoint every 10-15s as fallback.

For timeline view:

- Call `GET /logistics/shipments/:id/location/history?limit=100`
- For pagination/backfill use `before=<oldestRecordedAtISO>`.

## 9. Environment Configuration Examples

### 9.1 Web app (same machine)

- REST: `http://localhost:3000/api/v1`
- WS: `http://localhost:3000/ws`

### 9.2 Android Emulator

- REST: `http://10.0.2.2:3000/api/v1`
- WS: `http://10.0.2.2:3000/ws`

### 9.3 Physical device on same network

- REST: `http://<LAN_IP>:3000/api/v1`
- WS: `http://<LAN_IP>:3000/ws`

## 10. Testing Checklist

- App connects to websocket successfully.
- `shipment.subscribe` receives `system.joined`.
- If there is existing location, `shipment.location.snapshot` arrives.
- Moving device emits `shipment.location.update` and receives `shipment.location.ack`.
- Other subscribed clients receive `shipment.location.changed` in near real time.
- Disconnect network, then restore it and verify auto-reconnect + re-subscribe.
- Verify no flood/rate-limit errors in normal movement.

## 11. Common Errors and Fixes

- Error: cannot connect to websocket
  - Check using `/ws` namespace and not `/ws/socket.io` URL.
- Error: room forbidden
  - User is not organizer or assigned volunteer for shipment.
- Error: rate limit exceeded
  - Send location less frequently (>= 2 seconds).
- No updates after reconnect
  - Ensure `shipment.subscribe` is emitted again on `connect`.

## 12. Minimal Integration Order

1. Configure env for REST and WS URLs.
2. Add socket service with reconnect enabled.
3. Add `shipment.subscribe` and listener wiring.
4. Add GPS watcher and throttled `shipment.location.update` emits.
5. Add REST latest/history integration for fallback and timeline.
6. Add QA checks for reconnect and role authorization.
