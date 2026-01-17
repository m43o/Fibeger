# Browser Notifications

This document describes the browser (OS-level) notification system implemented in Fibeger.

## Overview

Browser notifications allow users to receive native operating system notifications even when the Fibeger tab is not in focus or minimized. These notifications appear as system toasts on Windows, macOS, and Linux.

## Features

- 🔔 **Native OS notifications** - Shows notifications using the system's native notification API
- 👆 **Click to navigate** - Clicking a notification focuses the app and navigates to the relevant page
- 🔕 **User-controlled** - Users can enable/disable in their profile settings
- 🎨 **Custom content** - Displays notification title, message, and icon
- 🔐 **Permission-based** - Requires user's explicit browser permission
- 📱 **Cross-platform** - Works on Windows, macOS, and Linux
- ⚡ **Real-time** - Integrates with the SSE notification system for instant delivery

## How It Works

### Architecture

1. **Hook (`useBrowserNotifications`)**: Manages browser notification state, permissions, and display
2. **Component (`BrowserNotifications`)**: Initializes the notification system at app level
3. **Integration**: Listens to SSE notification events and shows browser notifications
4. **Database**: Stores user preference in `User.browserNotificationsEnabled`

### Event Flow

```
New Notification → SSE Event → useBrowserNotifications → Browser API → OS Notification
```

When a notification event arrives via Server-Sent Events:
1. The `useBrowserNotifications` hook receives the event
2. Checks if browser notifications are enabled and permission granted
3. Creates a native browser notification using the Notification API
4. When clicked, focuses the window and navigates to the notification link

## User Experience

### First-Time Setup

1. User goes to Profile → Privacy & Preferences
2. Toggles "Browser Notifications" on
3. Browser prompts for permission (one-time)
4. User clicks "Allow"
5. Browser notifications are now active

### Notification Display

When a new notification arrives (e.g., new message):

**Windows Toast Example:**
```
┌─────────────────────────────┐
│ 🔔 Fibeger                  │
│ New Message from @john      │
│ Hey, are you there?         │
└─────────────────────────────┘
```

**macOS Notification Example:**
```
┌─────────────────────────────┐
│ Fibeger                      │
│ New Message from @john       │
│ Hey, are you there?          │
└─────────────────────────────┘
```

### Click Behavior

Clicking a notification:
- Brings the Fibeger tab into focus
- Navigates to the relevant page (e.g., `/messages?conversation=123`)
- Closes the notification automatically

## Implementation

### Hook: `useBrowserNotifications`

Located at `app/hooks/useBrowserNotifications.ts`

**Usage:**
```typescript
const {
  isSupported,           // Whether browser supports notifications
  permission,            // Current permission status
  isEnabled,             // Whether user has enabled notifications
  isLoading,             // Whether preference is loading
  requestPermission,     // Function to request permission
  showNotification,      // Manually show a notification
  toggleEnabled,         // Toggle on/off
  closeAll,              // Close all active notifications
} = useBrowserNotifications();
```

**Features:**
- Automatically requests permission when user enables
- Syncs preference with database
- Listens to real-time notification events
- Handles click actions for navigation
- Auto-closes notifications after 10 seconds
- Prevents duplicate notifications

### Component: `BrowserNotifications`

Located at `app/components/BrowserNotifications.tsx`

This component doesn't render anything visible but initializes the browser notification system. It's placed in the `Providers` component to run globally.

### Database Schema

```prisma
model User {
  // ... other fields
  browserNotificationsEnabled Boolean @default(false)
}
```

### API Integration

The profile API (`/api/profile`) supports the `browserNotificationsEnabled` field:

**GET /api/profile**
Returns user's browser notification preference.

**PUT/PATCH /api/profile**
Updates the preference:
```json
{
  "browserNotificationsEnabled": true
}
```

## User Settings

Located in Profile → Privacy & Preferences

### Toggle States

1. **Disabled (Default)**
   - Gray toggle
   - No notifications shown

2. **Enabled with Permission Granted**
   - Colored toggle (theme color)
   - Notifications active

3. **Browser Not Supported**
   - Toggle disabled
   - Shows "Not supported in your browser"

4. **Permission Denied**
   - Toggle disabled
   - Shows "Permission denied. Please enable in your browser settings."
   - User must manually enable in browser settings

### How to Re-enable After Denying

If a user accidentally denies permission:

**Chrome/Edge:**
1. Click the lock icon in address bar
2. Find "Notifications" permission
3. Change to "Allow"
4. Refresh the page

**Firefox:**
1. Click the lock icon in address bar
2. Click "More information"
3. Go to Permissions tab
4. Find Notifications and change to "Allow"
5. Refresh the page

**Safari:**
1. Safari → Settings → Websites → Notifications
2. Find your site
3. Change to "Allow"
4. Refresh the page

## Notification Types

All notification types from the SSE system are supported:

| Type | Emoji | Example |
|------|-------|---------|
| `friend_request` | 👥 | "John sent you a friend request" |
| `message` | 💬 | "New message from @jane" |
| `group_invite` | 🎉 | "You've been invited to join Study Group" |
| `system` | 🔔 | System notifications |

## Browser Support

### Fully Supported
- ✅ Chrome/Chromium (desktop)
- ✅ Firefox (desktop)
- ✅ Edge (desktop)
- ✅ Safari (macOS)
- ✅ Opera (desktop)

### Limited/Not Supported
- ❌ Safari (iOS) - iOS doesn't support Web Notifications API
- ❌ Chrome (iOS) - Uses Safari engine, same limitation
- ⚠️ Mobile browsers - Generally limited support

### Detection

The hook automatically detects support:
```typescript
const isSupported = typeof window !== 'undefined' && 'Notification' in window;
```

## Privacy & Security

### User Control
- Users must explicitly enable browser notifications
- Users can disable at any time
- Browser permission can be revoked

### Permission Model
- Follows browser's standard permission API
- One-time permission prompt per origin
- User can deny or revoke at any time

### Data
- No notification data is stored locally beyond what the browser manages
- Notifications auto-close after 10 seconds
- No tracking or analytics

## Technical Details

### Auto-Close Behavior
Notifications automatically close after 10 seconds unless `requireInteraction` is set to true.

### Notification Grouping
Notifications use a `tag` based on notification type, which groups similar notifications on some platforms.

### Icon & Badge
Uses `/favicon.ico` as both icon and badge for consistent branding.

### Memory Management
Active notifications are tracked and properly cleaned up:
- On unmount
- When user manually closes
- After auto-close timeout

## Troubleshooting

### Notifications Not Showing

1. **Check if enabled**: Profile → Browser Notifications toggle
2. **Check permission**: Look for browser permission prompt
3. **Check browser settings**: Ensure site has notification permission
4. **Check OS settings**: Some OSes have global notification settings
5. **Check focus**: Browser notifications only show when the app is not visible/focused (by design)
   - If the Fibeger tab is currently visible, browser notifications are suppressed
   - This prevents notification spam while you're actively using the app

### Permission Already Denied

If permission was previously denied:
1. Click the lock/info icon in browser address bar
2. Find Notifications setting
3. Change to "Allow"
4. Refresh the page
5. Toggle off and on in profile settings

### Notifications Show Briefly Then Disappear

This is expected behavior - notifications auto-close after 10 seconds.

## Future Enhancements

Potential improvements to consider:

- 📱 Service Worker for persistent notifications
- 🎨 Custom notification actions (Quick reply, Mark as read)
- 🔢 Notification badges showing unread count
- ⏰ Do Not Disturb mode with scheduled quiet hours
- 📊 Notification history/log
- 🎯 Granular notification preferences (per type)
- 📱 PWA support for mobile notifications

## Related Documentation

- [NOTIFICATIONS.md](./NOTIFICATIONS.md) - In-app notification system
- [sse-architecture.md](./sse-architecture.md) - Real-time event system
- [message-notification-sound.md](./message-notification-sound.md) - Notification sounds

## API Reference

### `useBrowserNotifications()`

Returns an object with:

- **`isSupported: boolean`** - Whether the browser supports the Notification API
- **`permission: NotificationPermission`** - Current permission status (`'default'`, `'granted'`, or `'denied'`)
- **`isEnabled: boolean`** - Whether the user has enabled browser notifications in their settings
- **`isLoading: boolean`** - Whether the user preference is still loading from the database
- **`requestPermission: () => Promise<NotificationPermission>`** - Request browser notification permission
- **`showNotification: (title: string, options?: NotificationOptions & { link?: string }) => Notification | null`** - Manually show a notification
- **`toggleEnabled: (enabled: boolean) => Promise<void>`** - Toggle browser notifications on/off
- **`closeAll: () => void`** - Close all active notifications

### Example Usage

```typescript
import { useBrowserNotifications } from '@/app/hooks/useBrowserNotifications';

function MyComponent() {
  const { 
    isSupported, 
    permission, 
    isEnabled, 
    requestPermission,
    showNotification 
  } = useBrowserNotifications();

  const handleEnable = async () => {
    if (permission !== 'granted') {
      await requestPermission();
    }
  };

  const sendTestNotification = () => {
    showNotification('Test Notification', {
      body: 'This is a test!',
      link: '/messages',
    });
  };

  return (
    <div>
      <p>Supported: {isSupported ? 'Yes' : 'No'}</p>
      <p>Permission: {permission}</p>
      <p>Enabled: {isEnabled ? 'Yes' : 'No'}</p>
      <button onClick={handleEnable}>Enable</button>
      <button onClick={sendTestNotification}>Test</button>
    </div>
  );
}
```
