# Real-Time Event System

This document describes the real-time event system that replaced polling with Server-Sent Events (SSE).

## Overview

The application now uses **Server-Sent Events (SSE)** for real-time updates instead of polling. This provides:

- ✅ **Instant updates** - No waiting for the next poll interval
- ✅ **Lower server load** - No constant API requests
- ✅ **Better UX** - Messages and notifications appear immediately
- ✅ **Automatic reconnection** - Connection recovers from network issues
- ✅ **Efficient** - Only sends data when there are actual changes

## Architecture

### Before: Polling System ❌

```
Client → API Request (every 1-3 seconds) → Database Query
Client ← API Response ← Database Result

Problems:
- Constant database queries even with no new data
- Delayed updates (up to 3 seconds)
- High server load with multiple users
- Wasted bandwidth
```

### After: Event-Based System ✅

```
Client → EventSource connection → SSE Endpoint
         ↓ (stays open)
Server → Event Manager → Client (only when data changes)

Benefits:
- Single persistent connection
- Instant updates
- Events only sent when needed
- Lower database load
```

## Components

### 1. Event Manager (`app/lib/events.ts`)

Central hub for managing real-time events. Maintains in-memory subscriptions for active users.

```typescript
import { eventManager } from '@/app/lib/events';

// Emit event to a single user
eventManager.emit(userId, 'notification', notificationData);

// Emit event to multiple users
eventManager.emitToMany([userId1, userId2], 'message', messageData);
```

**Event Types:**
- `notification` - New notifications
- `message` - New messages in conversations/groups
- `conversation_update` - Conversation list updates (for sidebar)
- `group_update` - Group list updates (for sidebar)

### 2. SSE Endpoint (`app/api/events/route.ts`)

REST API endpoint that clients connect to for receiving real-time events.

**Endpoint:** `GET /api/events`

**Features:**
- Authentication required (uses NextAuth session)
- Automatic heartbeat every 30 seconds to keep connection alive
- Graceful cleanup on disconnect
- Sends events as JSON in SSE format

**Response Format:**
```
data: {"userId": 1, "type": "notification", "data": {...}}

data: {"userId": 1, "type": "message", "data": {...}}
```

### 3. React Hook (`app/hooks/useRealtimeEvents.ts`)

Client-side hook for subscribing to real-time events.

```typescript
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';

function MyComponent() {
  const { on, off, isConnected } = useRealtimeEvents({
    onConnect: () => console.log('Connected to real-time server'),
    onDisconnect: () => console.log('Disconnected'),
  });

  useEffect(() => {
    const handleMessage = (event) => {
      console.log('New message:', event.data);
    };

    on('message', handleMessage);
    return () => off('message', handleMessage);
  }, [on, off]);

  return <div>{isConnected ? 'Live' : 'Connecting...'}</div>;
}
```

**Options:**
- `onConnect` - Called when connection is established
- `onDisconnect` - Called when connection is lost
- `onError` - Called on connection errors
- `autoReconnect` - Auto-reconnect on disconnect (default: true)
- `reconnectDelay` - Delay before reconnecting in ms (default: 3000)

## Updated Components

### NotificationBell (`app/components/NotificationBell.tsx`)

**Before:** Polled `/api/notifications` every 30 seconds

**After:** 
- Fetches notifications once on mount
- Subscribes to `notification` events
- Updates instantly when new notifications arrive

### Sidebar (`app/components/Sidebar.tsx`)

**Before:** Polled conversations and groups every 3 seconds

**After:**
- Fetches data once on mount
- Subscribes to `conversation_update` and `group_update` events
- Updates sidebar immediately when conversations change

### Messages Page (`app/messages/page.tsx`)

**Before:** Polled messages every 1.5 seconds

**After:**
- Fetches messages once when opening a conversation
- Subscribes to `message` events
- Shows new messages instantly (including from other users)

## API Integration

To emit events when data changes, import the event manager and call `emit`:

### Example: Creating a Message

```typescript
import { eventManager } from '@/app/lib/events';

// After creating a message in the database
const message = await prisma.message.create({...});

// Notify all conversation members
members.forEach((member) => {
  eventManager.emit(member.userId, 'message', {
    conversationId,
    message,
  });
});
```

### Example: Creating a Notification

```typescript
import { eventManager } from '@/app/lib/events';

// After creating notification in database
const notification = await prisma.notification.create({...});

// Send real-time event
eventManager.emit(notification.userId, 'notification', notification);
```

## Updated API Routes

The following routes now emit real-time events:

1. **`POST /api/conversations/[id]/messages`**
   - Emits `message` event to other conversation members
   - Emits `notification` event for notifications
   - Emits `conversation_update` to all members

2. **`POST /api/groupchats/[id]/messages`**
   - Emits `message` event to other group members
   - Emits `notification` event for notifications
   - Emits `group_update` to all members

3. **`POST /api/friends/request`**
   - Emits `notification` event to friend request receiver

4. **`PUT /api/friends/request/[id]`** (accept request)
   - Emits `notification` event to friend request sender

## Browser Compatibility

Server-Sent Events are supported in all modern browsers:

- ✅ Chrome 6+
- ✅ Firefox 6+
- ✅ Safari 5+
- ✅ Edge 79+
- ❌ Internet Explorer (use polyfill if needed)

## Production Considerations

### 1. Scaling

For production with multiple server instances, you'll need to add a message broker:

```
Option A: Redis Pub/Sub
Option B: RabbitMQ
Option C: AWS SNS/SQS
Option D: Pusher/Ably (managed service)
```

**Example with Redis:**

```typescript
// app/lib/events.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const pub = redis.duplicate();

class EventManager {
  // ... existing code ...

  emit(userId: number, type: EventType, data: any): void {
    // Emit locally
    const event: EventData = { userId, type, data };
    const userListeners = this.listeners.get(userId);
    
    if (userListeners) {
      userListeners.forEach(listener => listener(event));
    }

    // Publish to Redis for other instances
    pub.publish('events', JSON.stringify(event));
  }
}

// Subscribe to events from other instances
redis.subscribe('events', (err) => {
  if (err) console.error('Redis subscribe error:', err);
});

redis.on('message', (channel, message) => {
  const event = JSON.parse(message);
  eventManager.emit(event.userId, event.type, event.data);
});
```

### 2. Connection Limits

SSE uses one connection per client. Consider:

- Load balancer sticky sessions (if using multiple servers)
- Connection limits on your hosting platform
- Database connection pooling

### 3. Monitoring

Monitor these metrics:

```typescript
// Get active connections
const connections = eventManager.getActiveConnections();
console.log(`Active SSE connections: ${connections}`);

// Get listeners for a specific user
const userListeners = eventManager.getUserListenerCount(userId);
```

### 4. Security

- ✅ Authentication required (NextAuth session)
- ✅ Users only receive their own events
- ✅ No cross-user data leakage
- ⚠️ Consider rate limiting for production

## Troubleshooting

### Connection Not Establishing

```typescript
// Check browser console
const { isConnected } = useRealtimeEvents({
  onError: (error) => console.error('SSE Error:', error),
});
```

### Events Not Being Received

1. Check that events are being emitted on the server:
   ```typescript
   console.log('Emitting event to user:', userId);
   eventManager.emit(userId, 'notification', data);
   ```

2. Verify the client is subscribed:
   ```typescript
   useEffect(() => {
     console.log('Subscribing to notifications');
     on('notification', handler);
     return () => off('notification', handler);
   }, [on, off]);
   ```

3. Check network tab for `/api/events` connection

### Connection Keeps Disconnecting

- Check server logs for errors
- Verify proxy/load balancer settings (some proxies buffer SSE)
- Increase heartbeat frequency if needed

## Migration Checklist

- [x] Created event manager system
- [x] Created SSE endpoint
- [x] Created React hook for SSE
- [x] Updated NotificationBell to use SSE
- [x] Updated Sidebar to use SSE
- [x] Updated Messages page to use SSE
- [x] Updated API routes to emit events
- [ ] Add Redis for multi-server support (if needed)
- [ ] Add monitoring/logging
- [ ] Load test with multiple users

## Performance Impact

### Before (Polling)

- **Network requests**: 3-4 requests per second per user
- **Database queries**: 3-4 queries per second per user
- **Update latency**: 1-3 seconds
- **Server load**: High with many users

### After (SSE)

- **Network requests**: 1 persistent connection + events only when needed
- **Database queries**: Only when data changes
- **Update latency**: <100ms (near-instant)
- **Server load**: Significantly lower

## Future Enhancements

Potential improvements:

1. **WebSockets** - For bi-directional communication if needed
2. **Event batching** - Combine multiple events into one message
3. **Offline queue** - Queue events when client is offline
4. **Selective subscriptions** - Subscribe to specific conversations only
5. **Compression** - Compress event data for large payloads
6. **Analytics** - Track event delivery and latency

## Resources

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
