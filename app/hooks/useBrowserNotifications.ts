'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtimeEvents, RealtimeEvent } from './useRealtimeEvents';
import { useRouter } from 'next/navigation';

/**
 * Hook for managing browser (OS-level) notifications
 * 
 * Integrates with the real-time SSE notification system to show
 * native OS notifications even when the tab is in the background.
 * 
 * Features:
 * - Requests browser notification permission
 * - Shows native OS notifications for new events
 * - Handles click actions to focus tab and navigate
 * - Respects user's preference settings
 * - Works with Windows/Mac/Linux notification systems
 * 
 * @example
 * ```tsx
 * const {
 *   permission,
 *   requestPermission,
 *   isEnabled,
 *   setIsEnabled,
 * } = useBrowserNotifications();
 * ```
 */
export function useBrowserNotifications() {
  const { data: session } = useSession();
  const router = useRouter();
  const { on, off } = useRealtimeEvents();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track active notifications to prevent duplicates
  const activeNotificationsRef = useRef<Map<string, Notification>>(new Map());

  // Check if browser supports notifications
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  /**
   * Request permission to show browser notifications
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn('Browser notifications are not supported in this browser');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        // Update user preference in database
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ browserNotificationsEnabled: true }),
        });
        setIsEnabled(true);
      }
      
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, [isSupported]);

  /**
   * Show a browser notification
   */
  const showNotification = useCallback((
    title: string,
    options?: NotificationOptions & { link?: string }
  ) => {
    if (!isSupported || permission !== 'granted' || !isEnabled) {
      return null;
    }

    // Don't show notification if the app is already visible/focused
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      return null;
    }

    try {
      const { link, ...notificationOptions } = options || {};
      
      // Create unique key for this notification
      const notificationKey = `${title}-${Date.now()}`;
      
      // Default options
      const defaultOptions: NotificationOptions = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: false,
        silent: false, // Let the notification system handle sound
        ...notificationOptions,
      };

      const notification = new Notification(title, defaultOptions);
      
      // Store reference
      activeNotificationsRef.current.set(notificationKey, notification);

      // Handle click - focus window and navigate if link provided
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        
        if (link) {
          router.push(link);
        }
        
        notification.close();
      };

      // Cleanup when notification closes
      notification.onclose = () => {
        activeNotificationsRef.current.delete(notificationKey);
      };

      // Auto-close after 10 seconds (unless requireInteraction is true)
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isSupported, permission, isEnabled, router]);

  /**
   * Toggle browser notifications on/off
   */
  const toggleEnabled = useCallback(async (enabled: boolean) => {
    if (!isSupported) return;

    // If enabling and we don't have permission, request it
    if (enabled && permission !== 'granted') {
      const result = await requestPermission();
      if (result !== 'granted') {
        return; // Don't enable if permission denied
      }
    }

    try {
      // Update in database
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browserNotificationsEnabled: enabled }),
      });
      
      setIsEnabled(enabled);
    } catch (error) {
      console.error('Error updating browser notification preference:', error);
    }
  }, [isSupported, permission, requestPermission]);

  /**
   * Close all active notifications
   */
  const closeAll = useCallback(() => {
    activeNotificationsRef.current.forEach((notification) => {
      notification.close();
    });
    activeNotificationsRef.current.clear();
  }, []);

  // Initialize: Check permission status and user preference
  useEffect(() => {
    if (!isSupported || !session?.user?.id) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      // Check browser permission
      const currentPermission = Notification.permission;
      setPermission(currentPermission);

      // Fetch user preference from database
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          const enabled = data.browserNotificationsEnabled ?? false;
          
          // Only enable if we have permission AND user wants it enabled
          setIsEnabled(currentPermission === 'granted' && enabled);
        }
      } catch (error) {
        console.error('Failed to fetch browser notification preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [isSupported, session?.user?.id]);

  // Subscribe to real-time notification events
  useEffect(() => {
    if (!isSupported || !isEnabled || permission !== 'granted') {
      return;
    }

    const handleNotificationEvent = (event: RealtimeEvent) => {
      if (event.type !== 'notification') return;

      const { title, message, link, type } = event.data || {};
      
      if (!title || !message) return;

      // Get emoji based on notification type
      const getEmoji = (notificationType: string) => {
        switch (notificationType) {
          case 'friend_request':
            return '👥';
          case 'message':
            return '💬';
          case 'group_invite':
            return '🎉';
          default:
            return '🔔';
        }
      };

      // Show browser notification
      showNotification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: type || 'notification', // Group similar notifications
        link: link,
        // Add emoji to make it more visually appealing
        data: {
          emoji: getEmoji(type),
          link: link,
        },
      });
    };

    const unsubscribe = on('notification', handleNotificationEvent);
    
    return () => {
      unsubscribe();
    };
  }, [isSupported, isEnabled, permission, on, showNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAll();
    };
  }, [closeAll]);

  return {
    /** Whether browser notifications are supported */
    isSupported,
    /** Current browser permission status */
    permission,
    /** Whether user has enabled browser notifications */
    isEnabled,
    /** Whether preference is still loading */
    isLoading,
    /** Request permission from the browser */
    requestPermission,
    /** Show a browser notification manually */
    showNotification,
    /** Toggle browser notifications on/off */
    toggleEnabled,
    /** Close all active notifications */
    closeAll,
  };
}
