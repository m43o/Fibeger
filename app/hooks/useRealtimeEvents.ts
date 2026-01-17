'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EventType } from '@/app/lib/events';

export interface RealtimeEvent {
  userId: number;
  type: EventType;
  data: any;
}

interface UseRealtimeEventsOptions {
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is lost */
  onDisconnect?: () => void;
  /** Called when an error occurs */
  onError?: (error: Event) => void;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
}

/**
 * Hook for subscribing to real-time server events via SSE
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
  const {
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<EventType, Set<(event: RealtimeEvent) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (isUnmountedRef.current || eventSourceRef.current) {
      return;
    }

    try {
      const eventSource = new EventSource('/api/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        onConnect?.();
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        onError?.(error);
        
        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;
        
        // Auto-reconnect if enabled
        if (autoReconnect && !isUnmountedRef.current) {
          onDisconnect?.();
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, reconnectDelay);
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          
          // Ignore connection confirmation messages
          if ((data as any).type === 'connected') {
            return;
          }

          // Call all listeners for this event type
          const listeners = listenersRef.current.get(data.type);
          if (listeners) {
            listeners.forEach(listener => {
              try {
                listener(data);
              } catch (error) {
                console.error('Error in event listener:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };
    } catch (error) {
      console.error('Error creating EventSource:', error);
    }
  }, [onConnect, onDisconnect, onError, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      onDisconnect?.();
    }
  }, [onDisconnect]);

  /**
   * Subscribe to a specific event type
   */
  const on = useCallback((type: EventType, listener: (event: RealtimeEvent) => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(listener);
  }, []);

  /**
   * Unsubscribe from a specific event type
   */
  const off = useCallback((type: EventType, listener: (event: RealtimeEvent) => void) => {
    const listeners = listenersRef.current.get(type);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenersRef.current.delete(type);
      }
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    /** Subscribe to events */
    on,
    /** Unsubscribe from events */
    off,
    /** Whether the connection is active */
    isConnected,
    /** Manually reconnect */
    reconnect: () => {
      disconnect();
      setTimeout(connect, 100);
    },
  };
}
