# Account Deletion Feature

## Overview
Users can permanently delete their accounts through the profile page. This action is irreversible and removes all user data from the system.

## Implementation

### API Endpoint
- **Route**: `/api/profile/delete`
- **Method**: `DELETE`
- **Authentication**: Required (session-based)

### What Gets Deleted

When a user deletes their account, the following data is permanently removed:

1. **User Profile**
   - Username, email, password
   - Nickname, bio, avatar
   - Username history

2. **Relationships**
   - All friend connections (both directions)
   - All friend requests (sent and received)
   - Group chat memberships

3. **Content**
   - All messages sent by the user
   - Message reactions
   - Notifications

4. **Files**
   - User avatar image
   - Message attachments

### Database Cascade Behavior

The Prisma schema uses `onDelete: Cascade` for all user relations, ensuring that when a user is deleted:
- All related records are automatically removed
- No orphaned data remains in the database

### User Interface

#### Location
Profile page (`/profile`) - "Danger Zone" section at the bottom

#### Confirmation Flow
1. User clicks "Delete My Account" button
2. Modal appears with warning message
3. User must type their exact username to confirm
4. "Delete Account" button becomes enabled
5. Upon confirmation:
   - Account is deleted
   - User is signed out
   - Redirected to login page

#### Safety Features
- Requires exact username match for confirmation
- Clear warning about permanent deletion
- Disabled state while deletion is in progress
- Separate "Danger Zone" section with red styling

## Security Considerations

1. **Authentication**: Only authenticated users can delete their own account
2. **Authorization**: Users can only delete their own account (enforced via session)
3. **Confirmation**: Username verification prevents accidental deletion
4. **Session Management**: User is automatically signed out after deletion

## File Cleanup

The deletion process includes cleanup of uploaded files:
- User avatar from `/public/uploads/avatars/`
- Message attachments from `/public/uploads/messages/`

File cleanup errors are logged but don't prevent account deletion to ensure the user can always delete their account.

## Testing

To test account deletion:
1. Create a test account
2. Add some data (friends, messages, avatar)
3. Navigate to profile page
4. Scroll to "Danger Zone"
5. Click "Delete My Account"
6. Type username to confirm
7. Verify deletion and redirect to login

## Future Enhancements

Potential improvements:
- Grace period (soft delete with recovery option)
- Export user data before deletion
- Email confirmation requirement
- Detailed deletion report
- Account deactivation (temporary) option
