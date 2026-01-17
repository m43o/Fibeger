# Message Notification Sound Feature

## Overview

Added audio notification functionality that plays a sound when users receive messages in real-time.

## Implementation

### Files Created

1. **`app/hooks/useNotificationSound.ts`**
   - Custom React hook for managing notification sound playback
   - Includes Web Audio API fallback for generating a simple beep
   - Automatically falls back to beep if `notification.mp3` is not found
   - Manages audio lifecycle with proper cleanup

2. **`public/NOTIFICATION_SOUND.md`**
   - Documentation for adding custom notification sounds
   - Links to free sound effect resources

3. **`docs/message-notification-sound.md`** (this file)
   - Technical documentation of the feature

### Files Modified

1. **`app/messages/page.tsx`**
   - Imported and integrated `useNotificationSound` hook
   - Added sound playback in message event handler
   - Sound plays only when:
     - Message is from another user (not self)
     - User is currently viewing the conversation/group
     - Message is new (not a duplicate)

## How It Works

### Sound Playback Logic

```typescript
// In the message event handler
if (newMessage.sender.id !== currentUserId) {
  playSound();
}
```

The sound notification:
- ✅ Plays when receiving messages from others
- ✅ Works for both DM and group chats
- ✅ Only plays when viewing the active conversation
- ✅ Doesn't play for your own messages
- ✅ Has a Web Audio API fallback (works without any files)
- ✅ Handles browser autoplay restrictions gracefully

### Fallback System

1. **Primary**: Attempts to load `/notification.mp3` from public directory
2. **Fallback**: Generates a 800Hz sine wave beep using Web Audio API if file not found
3. **Graceful Degradation**: Logs warnings but doesn't break the app if audio fails

## Browser Compatibility

- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Handles autoplay restrictions (may require initial user interaction)
- Falls back to Web Audio API if file loading fails

## User Experience

- **Volume**: Default 50% (can be adjusted via `setVolume()`)
- **Duration**: 
  - Custom MP3: Depends on file
  - Web Audio beep: 150ms
- **Non-intrusive**: Short, pleasant notification sound

## Testing

To test the feature:

1. Open the app in two different browser windows
2. Log in as two different users
3. Start a conversation or group chat
4. Send a message from one user
5. The other user should hear a notification sound

## Future Enhancements

Potential improvements:
- User settings to enable/disable notification sounds
- Volume control in user preferences
- Different sounds for DMs vs group messages
- Different sounds for mentions
- Notification sound for messages in background conversations
- Visual notification for users who disable sounds

## Troubleshooting

**No sound playing?**
- Check browser console for errors
- Ensure browser allows audio playback (may need user interaction first)
- Check browser volume and system volume
- Verify the Web Audio API fallback is working (should see console log)

**Sound too loud/quiet?**
- If using custom MP3: Adjust the file's volume before uploading
- Code default: 50% volume (can be changed in `useNotificationSound.ts`)

## Technical Details

### Web Audio API Beep Specifications
- Frequency: 800 Hz
- Waveform: Sine wave
- Envelope: 10ms fade-in, 140ms fade-out
- Total duration: 150ms
- Volume: 0.3 (30% of max)

### Audio Element Specifications
- Format: MP3
- Default volume: 0.5 (50% of max)
- Preloaded on component mount
- Cleaned up on component unmount
