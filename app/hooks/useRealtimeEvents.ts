'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EventType } from '@/app/lib/events';
import { realtimeClient, RealtimeEvent } from '@/app/lib/realtimeClient';

interface UseRealtimeEventsOptions {
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is lost */
  onDisconnect?: () => void;
}

/**
 * Hook for subscribing to real-time server events via SSE
 * 
 * Uses a singleton SSE connection shared across all components.
 * This prevents multiple connections and ensures consistent event delivery.
 * 
 * @example
 * ```tsx
 * const { on, off, isConnected } = useRealtimeEvents({
 *   onConnect: () => console.log('Connected'),
 *   onDisconnect: () => console.log('Disconnected'),
 * });
 * 
 * useEffect(() => {
 *   const handleMessage = (event: RealtimeEvent) => {
 *     console.log('New message:', event.data);
 *   };
 *   on('message', handleMessage);
 *   return () => off('message', handleMessage);
 * }, [on, off]);
 * ```
 */
export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const { onConnect, onDisconnect } = options;
  const [isConnected, setIsConnected] = useState(realtimeClient.getIsConnected());
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onConnect, onDisconnect]);

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = realtimeClient.onConnectionStateChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        onConnectRef.current?.();
      } else {
        onDisconnectRef.current?.();
      }
    });

    return unsubscribe;
  }, []);

  // Ensure connection is established on mount
  useEffect(() => {
    realtimeClient.connect();
  }, []);

  /**
   * Subscribe to a specific event type
   */
  const on = useCallback((type: EventType, listener: (event: RealtimeEvent) => void) => {
    return realtimeClient.on(type, listener);
  }, []);

  /**
   * Unsubscribe from a specific event type
   */
  const off = useCallback((type: EventType, listener: (event: RealtimeEvent) => void) => {
    realtimeClient.off(type, listener);
  }, []);

  return {
    /** Subscribe to events */
    on,
    /** Unsubscribe from events */
    off,
    /** Whether the connection is active */
    isConnected,
    /** Get connection statistics for debugging */
    getStats: () => realtimeClient.getStats(),
  };
}

// Re-export RealtimeEvent type for convenience
export type { RealtimeEvent };
