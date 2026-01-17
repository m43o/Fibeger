/**
 * Singleton SSE Connection Manager
 * 
 * Maintains a single SSE connection shared across all components.
 * This prevents multiple connections per user and ensures consistent event delivery.
 */

import { EventType } from './events';

export interface RealtimeEvent {
  userId: number;
  type: EventType;
  data: any;
}

type EventListener = (event: RealtimeEvent) => void;
type ConnectionStateListener = (connected: boolean) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private connectionStateListeners: Set<ConnectionStateListener> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    // Don't create duplicate connections
    if (this.eventSource || this.isConnecting) {
      console.log('[RealtimeClient] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    console.log('[RealtimeClient] Connecting to SSE...');

    try {
      this.eventSource = new EventSource('/api/events');

      this.eventSource.onopen = () => {
        console.log('[RealtimeClient] ✅ Connected to SSE');
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionState(true);
      };

      this.eventSource.onerror = (error) => {
        console.error('[RealtimeClient] ❌ SSE connection error:', error);
        this.isConnecting = false;
        this.isConnected = false;
        this.notifyConnectionState(false);
        
        // Close the broken connection
        this.eventSource?.close();
        this.eventSource = null;
        
        // Attempt to reconnect with exponential backoff
        this.scheduleReconnect();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          
          // Ignore connection confirmation messages
          if ((data as any).type === 'connected') {
            console.log('[RealtimeClient] Received connection confirmation');
            return;
          }

          console.log('[RealtimeClient] 📨 Received event:', data.type, data);

          // Dispatch to all listeners for this event type
          const listeners = this.listeners.get(data.type);
          if (listeners && listeners.size > 0) {
            listeners.forEach(listener => {
              try {
                listener(data);
              } catch (error) {
                console.error('[RealtimeClient] Error in event listener:', error);
              }
            });
          } else {
            console.warn('[RealtimeClient] No listeners for event type:', data.type);
          }
        } catch (error) {
          console.error('[RealtimeClient] Error parsing SSE message:', error);
        }
      };
    } catch (error) {
      console.error('[RealtimeClient] Error creating EventSource:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RealtimeClient] Max reconnect attempts reached. Please refresh the page.');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, etc. (max 30s)
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    this.reconnectAttempts++;
    console.log(`[RealtimeClient] 🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from SSE
   */
  disconnect(): void {
    console.log('[RealtimeClient] Disconnecting from SSE...');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnecting = false;
    this.isConnected = false;
    this.notifyConnectionState(false);
  }

  /**
   * Subscribe to a specific event type
   */
  on(type: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)!.add(listener);
    console.log(`[RealtimeClient] 👂 Subscribed to '${type}' events (${this.listeners.get(type)!.size} listeners)`);

    // Return unsubscribe function
    return () => this.off(type, listener);
  }

  /**
   * Unsubscribe from a specific event type
   */
  off(type: EventType, listener: EventListener): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
      console.log(`[RealtimeClient] 🔇 Unsubscribed from '${type}' events (${listeners.size} listeners remaining)`);
      
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.add(listener);
    
    // Immediately notify of current state
    listener(this.isConnected);
    
    // Return unsubscribe function
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  /**
   * Notify all connection state listeners
   */
  private notifyConnectionState(connected: boolean): void {
    this.connectionStateListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('[RealtimeClient] Error in connection state listener:', error);
      }
    });
  }

  /**
   * Get current connection status
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get statistics for debugging
   */
  getStats() {
    const stats: Record<string, number> = {};
    this.listeners.forEach((listeners, type) => {
      stats[type] = listeners.size;
    });
    
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      listenersPerEvent: stats,
      totalListeners: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
    };
  }
}

// Create singleton instance
const globalForRealtime = global as typeof globalThis & { realtimeClient: RealtimeClient };

export const realtimeClient = globalForRealtime.realtimeClient || new RealtimeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRealtime.realtimeClient = realtimeClient;
  
  // Expose to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).realtimeClient = realtimeClient;
  }
}
