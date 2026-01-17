/**
 * Server-Side Events Manager
 * 
 * This module provides a simple event emitter system for real-time updates
 * without polling. It uses in-memory event streams that persist during the
 * server's lifecycle.
 */

export type EventType = 
  | 'notification'
  | 'message'
  | 'conversation_update'
  | 'group_update'
  | 'typing'
  | 'reaction'
  | 'message_deleted'
  | 'conversation_deleted'
  | 'group_deleted';

export interface EventData {
  userId: number;
  type: EventType;
  data: any;
}

type EventListener = (event: EventData) => void;

class EventManager {
  private listeners: Map<number, Set<EventListener>> = new Map();

  /**
   * Subscribe to events for a specific user
   */
  subscribe(userId: number, listener: EventListener): () => void {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    
    this.listeners.get(userId)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(listener);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  /**
   * Emit an event to a specific user
   */
  emit(userId: number, type: EventType, data: any): void {
    const event: EventData = { userId, type, data };
    const userListeners = this.listeners.get(userId);
    
    if (userListeners) {
      userListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Emit an event to multiple users
   */
  emitToMany(userIds: number[], type: EventType, data: any): void {
    userIds.forEach(userId => this.emit(userId, type, data));
  }

  /**
   * Get number of active connections
   */
  getActiveConnections(): number {
    return this.listeners.size;
  }

  /**
   * Get number of listeners for a specific user
   */
  getUserListenerCount(userId: number): number {
    return this.listeners.get(userId)?.size || 0;
  }
}

// Create a singleton instance
const globalForEvents = global as unknown as { eventManager: EventManager };

export const eventManager = globalForEvents.eventManager || new EventManager();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.eventManager = eventManager;
}
