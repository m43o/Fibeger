'use client';

import { useBrowserNotifications } from '@/app/hooks/useBrowserNotifications';
import { useNotificationSound } from '@/app/hooks/useNotificationSound';
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

/**
 * Component that initializes browser notifications and sounds
 * 
 * This component doesn't render anything visible, but manages
 * the browser notification system and notification sounds in the background.
 * 
 * Place this component at the root level of your app (in Providers)
 * to enable browser notifications throughout the application.
 */
function BrowserNotificationsContent() {
  const { isSupported, permission, isEnabled } = useBrowserNotifications();
  const { playSound } = useNotificationSound();
  const { on } = useRealtimeEvents();
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Log status for debugging (optional, can remove in production)
  useEffect(() => {
    if (isSupported) {
      console.log('[Browser Notifications] Status:', {
        permission,
        isEnabled,
      });
    } else {
      console.warn('[Browser Notifications] Not supported in this browser');
    }
  }, [isSupported, permission, isEnabled]);

  // Global message sound handler - plays when NOT viewing the chat
  useEffect(() => {
    if (!session?.user?.id) {
      console.log('[Sound] No session, skipping sound subscription');
      return;
    }

    const currentUserId = parseInt((session.user as any).id || '0');
    console.log('[Sound] Setting up sound subscription for user:', currentUserId);
    
    const handleMessage = (event: any) => {
      console.log('[Sound] Received message event:', {
        conversationId: event.data.conversationId,
        groupChatId: event.data.groupChatId,
        senderId: event.data.message?.sender?.id,
        currentUserId,
      });

      const messageConvId = event.data.conversationId;
      const messageGroupId = event.data.groupChatId;
      const newMessage = event.data.message;

      // Don't play for own messages
      if (newMessage?.sender?.id === currentUserId) {
        console.log('[Sound] Skipping sound - own message');
        return;
      }

      // Check if we're currently viewing the chat that this message is from
      const isOnMessagesPage = pathname === '/messages';
      console.log('[Sound] Current page:', pathname, 'isOnMessagesPage:', isOnMessagesPage);
      
      if (!isOnMessagesPage) {
        // Not on messages page, always play sound
        console.log('[Sound] Playing sound - not on messages page');
        playSound();
        return;
      }

      // On messages page - check if viewing the specific chat
      const currentDmId = searchParams?.get('dm');
      const currentGroupId = searchParams?.get('group');
      console.log('[Sound] Current chat params:', { currentDmId, currentGroupId, messageConvId, messageGroupId });

      const isViewingThisChat = 
        (currentDmId && messageConvId && messageConvId === parseInt(currentDmId)) ||
        (currentGroupId && messageGroupId && messageGroupId === parseInt(currentGroupId));

      console.log('[Sound] isViewingThisChat:', isViewingThisChat);

      // Only play sound if we're NOT viewing this specific chat
      if (!isViewingThisChat) {
        console.log('[Sound] Playing sound - not viewing this chat');
        playSound();
      } else {
        console.log('[Sound] Skipping sound - already viewing this chat');
      }
    };

    const unsubscribe = on('message', handleMessage);
    console.log('[Sound] Subscribed to message events');
    
    return () => {
      console.log('[Sound] Unsubscribing from message events');
      unsubscribe();
    };
  }, [on, playSound, session?.user?.id, pathname, searchParams]);

  // This component doesn't render anything
  return null;
}

export default function BrowserNotifications() {
  return (
    <Suspense fallback={null}>
      <BrowserNotificationsContent />
    </Suspense>
  );
}
