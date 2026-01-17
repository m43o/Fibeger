# Notification System

This document describes the notification system implemented in the application.

## Overview

The notification system allows users to receive real-time updates about important events such as:
- Friend requests (sent and accepted)
- New messages in conversations
- New messages in group chats
- Group invitations

## Database Schema

### Notification Model

```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int
  type      String   // friend_request, message, group_invite, etc.
  title     String
  message   String
  link      String?  // Optional link to navigate to
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read])
}
```

## API Endpoints

### GET `/api/notifications`
Fetch all notifications for the current user.

**Query Parameters:**
- `unreadOnly` (optional): Set to "true" to fetch only unread notifications

**Response:**
```json
[
  {
    "id": 1,
    "userId": 1,
    "type": "friend_request",
    "title": "New Friend Request",
    "message": "John sent you a friend request",
    "link": "/friends",
    "read": false,
    "createdAt": "2026-01-17T13:50:00.000Z"
  }
]
```

### POST `/api/notifications`
Create a new notification (internal use).

**Request Body:**
```json
{
  "userId": 1,
  "type": "friend_request",
  "title": "New Friend Request",
  "message": "John sent you a friend request",
  "link": "/friends"
}
```

### PATCH `/api/notifications/[id]`
Mark a notification as read or unread.

**Request Body:**
```json
{
  "read": true
}
```

### DELETE `/api/notifications/[id]`
Delete a notification.

### PATCH `/api/notifications/mark-all-read`
Mark all notifications as read for the current user.

## UI Component

### NotificationBell Component

Located at `app/components/NotificationBell.tsx`, this component:
- Displays a bell icon with an unread count badge
- Opens a dropdown showing all notifications
- **Receives real-time updates via Server-Sent Events (SSE)** - no polling!
- Allows marking individual notifications as read
- Allows marking all notifications as read
- Allows deleting individual notifications
- Navigates to the relevant page when clicking a notification

**Usage:**
```tsx
import NotificationBell from './NotificationBell';

<NotificationBell />
```

## Notification Types

| Type | Icon | Description |
|------|------|-------------|
| `friend_request` | 👥 | Friend request sent or accepted |
| `message` | 💬 | New message in conversation or group |
| `group_invite` | 🎉 | Invitation to join a group |
| `system` | 🔔 | System notifications |

## Automatic Notification Generation

Notifications are automatically created in the following scenarios:

### Friend Requests
- **When sent**: Receiver gets a notification
  - Title: "New Friend Request"
  - Message: "[Username] sent you a friend request"
  - Link: `/friends`

- **When accepted**: Sender gets a notification
  - Title: "Friend Request Accepted"
  - Message: "[Username] accepted your friend request"
  - Link: `/friends`

### Messages
- **Conversation messages**: All members except sender get notified
  - Title: "New Message"
  - Message: "[Username]: [Message preview]"
  - Link: `/messages?conversation=[id]`

- **Group chat messages**: All members except sender get notified
  - Title: "New Message in [Group Name]"
  - Message: "[Username]: [Message preview]"
  - Link: `/groups?groupchat=[id]`

## Helper Functions

The `app/lib/notifications.ts` file provides utility functions:

### `createNotification(params)`
Create a single notification.

```typescript
await createNotification({
  userId: 1,
  type: "friend_request",
  title: "New Friend Request",
  message: "John sent you a friend request",
  link: "/friends",
});
```

### `createNotifications(userIds, notification)`
Create notifications for multiple users.

```typescript
await createNotifications([1, 2, 3], {
  type: "group_invite",
  title: "Group Invitation",
  message: "You've been invited to join a group",
  link: "/groups",
});
```

### `markNotificationAsRead(notificationId)`
Mark a notification as read.

### `markAllNotificationsAsRead(userId)`
Mark all notifications as read for a user.

### `deleteNotification(notificationId)`
Delete a notification.

### `getUnreadNotificationCount(userId)`
Get the count of unread notifications for a user.

## Real-Time Updates

✅ **Now Implemented!** The notification system uses **Server-Sent Events (SSE)** for instant real-time updates.

See [REALTIME.md](./REALTIME.md) for complete documentation on the real-time event system.

## Future Enhancements

Potential improvements to consider:
- Push notifications for mobile devices (PWA)
- Email notifications for important events
- Notification preferences/settings
- Notification grouping (e.g., "5 new messages")
- Notification sound effects
- Notification history/archive
