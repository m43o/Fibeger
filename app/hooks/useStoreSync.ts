'use client';

import { useEffect } from 'react';
import { useRealtimeEvents } from './useRealtimeEvents';
import { useFriendsStore } from '../stores/friendsStore';
import { useMessagesStore } from '../stores/messagesStore';
import { useFeedStore } from '../stores/feedStore';
import { useNotificationsStore } from '../stores/notificationsStore';

/**
 * Hook to sync SSE events with Zustand stores
 * 
 * This centralizes the event handling and keeps stores updated in real-time.
 * Use this hook once at the root level (e.g., in layout or providers).
 */
export function useStoreSync() {
  const { on } = useRealtimeEvents();
  
  const friendsStore = useFriendsStore();
  const messagesStore = useMessagesStore();
  const feedStore = useFeedStore();
  const notificationsStore = useNotificationsStore();

  useEffect(() => {
    // ===== NOTIFICATIONS =====
    const unsubNotification = on('notification', (event) => {
      notificationsStore.addNotification(event.data.notification);
    });

    // ===== MESSAGES =====
    const unsubMessage = on('message', (event) => {
      const { conversationId, groupChatId, message } = event.data;
      const chatId = conversationId || groupChatId;
      
      if (chatId && message) {
        messagesStore.addMessage(chatId, message);
      }
    });

    // ===== TYPING =====
    const unsubTyping = on('typing', (event) => {
      const { conversationId, groupChatId, userName, isTyping } = event.data;
      const chatId = conversationId || groupChatId;
      
      if (chatId) {
        if (isTyping) {
          messagesStore.addTypingUser(chatId, userName);
          // Auto-remove after 5 seconds
          setTimeout(() => {
            messagesStore.removeTypingUser(chatId, userName);
          }, 5000);
        } else {
          messagesStore.removeTypingUser(chatId, userName);
        }
      }
    });

    // ===== REACTIONS =====
    const unsubReaction = on('reaction', (event) => {
      const { messageId, reaction, action, userId, emoji, conversationId, groupChatId } = event.data;
      const chatId = conversationId || groupChatId;
      
      if (chatId) {
        if (action === 'add') {
          messagesStore.addReaction(chatId, messageId, reaction);
        } else if (action === 'remove') {
          messagesStore.removeReaction(chatId, messageId, userId, emoji);
        }
      }
    });

    // ===== MESSAGE DELETED =====
    const unsubMessageDeleted = on('message_deleted', (event) => {
      const { messageId, conversationId, groupChatId } = event.data;
      const chatId = conversationId || groupChatId;
      
      if (chatId) {
        messagesStore.removeMessage(chatId, messageId);
      }
    });

    // ===== CONVERSATION DELETED =====
    const unsubConversationDeleted = on('conversation_deleted', (event) => {
      const { conversationId } = event.data;
      messagesStore.removeConversation(conversationId);
    });

    // ===== GROUP DELETED =====
    const unsubGroupDeleted = on('group_deleted', (event) => {
      const { groupChatId } = event.data;
      messagesStore.removeGroupChat(groupChatId);
    });

    // ===== GROUP UPDATED =====
    const unsubGroupUpdated = on('group_updated', (event) => {
      const { group } = event.data;
      if (group) {
        messagesStore.updateGroupChat(group);
      }
    });

    // ===== FRIEND REMOVED =====
    const unsubFriendRemoved = on('friend_removed', (event) => {
      const { friendId } = event.data;
      if (friendId) {
        friendsStore.removeFriend(friendId);
      }
    });

    // ===== CONVERSATION UPDATE =====
    const unsubConversationUpdate = on('conversation_update', (event) => {
      const { conversation } = event.data;
      if (conversation) {
        messagesStore.updateConversation(conversation);
      }
    });

    // Cleanup all subscriptions
    return () => {
      unsubNotification();
      unsubMessage();
      unsubTyping();
      unsubReaction();
      unsubMessageDeleted();
      unsubConversationDeleted();
      unsubGroupDeleted();
      unsubGroupUpdated();
      unsubFriendRemoved();
      unsubConversationUpdate();
    };
  }, [on, friendsStore, messagesStore, feedStore, notificationsStore]);
}
