# Notification Sound

## Default Behavior

The application uses a **Web Audio API-generated beep** by default for message notifications. This works out of the box without any additional files.

## Adding a Custom Notification Sound

To use a custom notification sound instead of the default beep:

1. Add your notification sound file as `notification.mp3` to the `public/` directory
2. The file should be:
   - Format: MP3
   - Duration: 0.5-2 seconds recommended (short and pleasant)
   - Volume: Pre-normalized to a comfortable level

## Where to Find Free Notification Sounds

You can download free notification sounds from:
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/search/notification/) - Free, no attribution required
- [Freesound.org](https://freesound.org/search/?q=notification) - Free with Creative Commons licenses
- [Zapsplat](https://www.zapsplat.com/sound-effect-category/notifications-and-alarms/) - Free sound effects

## Testing

The notification sound will play when:
- You receive a new message from another user
- You are currently viewing the conversation/group where the message was sent
- The browser allows audio playback (some browsers require user interaction first)
