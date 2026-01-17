'use client';

import { useBrowserNotifications } from '@/app/hooks/useBrowserNotifications';
import { useEffect } from 'react';

/**
 * Component that initializes browser notifications
 * 
 * This component doesn't render anything visible, but manages
 * the browser notification system in the background.
 * 
 * Place this component at the root level of your app (in Providers)
 * to enable browser notifications throughout the application.
 */
export default function BrowserNotifications() {
  const { isSupported, permission, isEnabled } = useBrowserNotifications();

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

  // This component doesn't render anything
  return null;
}
