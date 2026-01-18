'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useMessagesStore } from '@/app/stores/messagesStore';
import { useFriendsStore } from '@/app/stores/friendsStore';
import type { Message, Attachment, User } from '@/app/stores/messagesStore';

// Utility function to detect and linkify URLs and mentions
function linkifyText(text: string, router: any) {
  const combinedRegex = /(https?:\/\/[^\s]+)|(@everyone)|(@[a-zA-Z0-9_]+)/g;
  const parts = text.split(combinedRegex);
  
  return parts.map((part, index) => {
    if (!part) return null;
    
    if (part.match(/^https?:\/\//)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: '#00a8fc' }}
        >
          {part}
        </a>
      );
    }
    
    if (part === '@everyone') {
      return (
        <span
          key={index}
          className="font-semibold px-1 rounded"
          style={{ 
            backgroundColor: 'rgba(88, 101, 242, 0.3)', 
            color: '#5865f2',
            cursor: 'default'
          }}
        >
          {part}
        </span>
      );
    }
    
    if (part.match(/^@[a-zA-Z0-9_]+$/)) {
      const username = part.substring(1);
      return (
        <button
          key={index}
          onClick={() => router.push(`/profile/${username}`)}
          className="font-semibold px-1 rounded hover:underline"
          style={{ 
            backgroundColor: 'rgba(88, 101, 242, 0.3)', 
            color: '#5865f2'
          }}
        >
          {part}
        </button>
      );
    }
    
    return part;
  });
}

function MessagesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmId = searchParams.get('dm');
  const groupId = searchParams.get('group');
  const chatId = dmId ? parseInt(dmId) : groupId ? parseInt(groupId) : null;

  // Get state and actions from stores
  const {
    conversations,
    groupChats,
    messages: messagesMap,
    typingUsers: typingUsersMap,
    fetchMessages,
    addMessage,
    updateMessage,
    removeMessage,
    addReaction,
    removeReaction,
  } = useMessagesStore();

  const { friends, fetchFriends } = useFriendsStore();

  // Get current conversation/group and messages
  const conversation = dmId ? conversations.get(parseInt(dmId)) : null;
  const groupChat = groupId ? groupChats.get(parseInt(groupId)) : null;
  const messages = chatId ? messagesMap.get(chatId) || [] : [];
  const typingUsers = chatId ? typingUsersMap.get(chatId) || new Set() : new Set();

  // Local UI state
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Initial fetch
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/auth/login');
      return;
    }

    if (status === "loading" || !session) {
      return;
    }

    if (!dmId && !groupId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      if (chatId) {
        await fetchMessages(chatId, dmId ? 'dm' : 'group');
        markAsRead(chatId, dmId ? 'dm' : 'group');
      }
      
      if (groupId) {
        fetchFriends();
      }
      
      setLoading(false);
    };

    loadData();
  }, [status, session, router, dmId, groupId, chatId, fetchMessages, fetchFriends]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle ESC key and body scroll lock for media viewer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingMedia) {
        setViewingMedia(null);
      }
    };

    if (viewingMedia) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [viewingMedia]);

  const markAsRead = async (id: number, type: 'dm' | 'group') => {
    try {
      await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: type === 'dm' ? id : undefined,
          groupChatId: type === 'group' ? id : undefined,
        }),
      });
    } catch (error) {
      console.error('Failed to mark messages as read');
    }
  };

  const handleTyping = async () => {
    if (!chatId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: dmId ? parseInt(dmId) : undefined,
          groupChatId: groupId ? parseInt(groupId) : undefined,
          isTyping: true,
        }),
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: dmId ? parseInt(dmId) : undefined,
            groupChatId: groupId ? parseInt(groupId) : undefined,
            isTyping: false,
          }),
        });
      } catch (error) {
        console.error('Failed to send stop typing indicator:', error);
      }
    }, 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedFiles = data.files || [data];
        setAttachments((prev) => [...prev, ...uploadedFiles]);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload files');
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;
    if (!chatId) return;

    const type = dmId ? 'dm' : 'group';
    const messageContent = newMessage;
    const messageAttachments = attachments;
    const replyToId = replyingTo?.id;
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    const userId = parseInt((session?.user as any)?.id || '0');
    const currentUser: User = {
      id: userId,
      username: (session?.user as any)?.username || 'Unknown',
      nickname: (session?.user as any)?.nickname || null,
      avatar: (session?.user as any)?.avatar || null,
    };

    // Create optimistic message
    const optimisticMessage: Message = {
      id: -1,
      tempId,
      content: messageContent,
      attachments: messageAttachments.length > 0 ? JSON.stringify(messageAttachments) : null,
      sender: currentUser,
      createdAt: new Date().toISOString(),
      isPending: true,
      reactions: [],
      replyTo: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        sender: replyingTo.sender,
      } : null,
    };

    // Optimistically add to store
    addMessage(chatId, optimisticMessage);

    // Clear input immediately
    setNewMessage('');
    setAttachments([]);
    setReplyingTo(null);

    // Send stop typing indicator
    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: dmId ? parseInt(dmId) : undefined,
          groupChatId: groupId ? parseInt(groupId) : undefined,
          isTyping: false,
        }),
      });
    } catch (error) {
      // Ignore typing errors
    }

    try {
      const endpoint = type === 'dm'
        ? `/api/conversations/${chatId}/messages`
        : `/api/groupchats/${chatId}/messages`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: messageContent,
          attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
          replyToId: replyToId,
        }),
      });

      if (res.ok) {
        const serverMessage = await res.json();
        // Replace optimistic message with server response
        updateMessage(chatId, -1, { ...serverMessage, isPending: false, tempId });
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to send message - Status:', res.status, 'Error:', errorData);
        // Remove optimistic message on failure
        removeMessage(chatId, -1);
        alert(`Failed to send message: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Failed to send message - Exception:', error);
      // Remove optimistic message on failure
      removeMessage(chatId, -1);
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    const userId = parseInt((session?.user as any)?.id || '0');
    return conversation.members.find((m) => m.user.id !== userId)?.user || null;
  };

  const isGroupAdmin = (): boolean => {
    if (!groupChat) return false;
    const userId = parseInt((session?.user as any)?.id || '0');
    const membership = groupChat.members.find((m) => m.user.id === userId);
    return membership?.role === 'admin';
  };

  const getAvailableFriends = (): User[] => {
    if (!groupChat) return [];
    const memberIds = groupChat.members.map((m) => m.user.id);
    return friends.filter((friend) => !memberIds.includes(friend.id));
  };

  const handleAddMember = async (friendId: number) => {
    if (!groupId) return;
    setAddingMember(true);

    try {
      const res = await fetch(`/api/groupchats/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: friendId }),
      });

      if (res.ok) {
        // Group will be updated via SSE
        setShowAddMember(false);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to add member');
      }
    } catch (error) {
      console.error('Failed to add member');
      alert('Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!groupId) return;
    const currentUserId = parseInt((session?.user as any)?.id || '0');
    const isRemovingSelf = userId === currentUserId;

    const confirmMessage = isRemovingSelf
      ? 'Are you sure you want to leave this group?'
      : 'Are you sure you want to remove this member?';

    if (!confirm(confirmMessage)) return;

    try {
      const res = await fetch(`/api/groupchats/${groupId}/members/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (isRemovingSelf) {
          router.push('/messages');
        }
        // Group will be updated via SSE
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member');
      alert('Failed to remove member');
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;

    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/groupchats/${groupId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/messages');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Failed to delete group');
      alert('Failed to delete group');
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId) return;

    setUploadingGroupAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(`/api/groupchats/${groupId}/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        alert('Group avatar updated successfully!');
        // Group will be updated via SSE
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Failed to upload group avatar:', error);
      alert('Failed to upload avatar');
    } finally {
      setUploadingGroupAvatar(false);
      if (groupAvatarInputRef.current) {
        groupAvatarInputRef.current.value = '';
      }
    }
  };

  const handleAddReaction = async (messageId: number, emoji: string) => {
    if (!chatId) return;
    
    try {
      const res = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });

      if (!res.ok) {
        console.error('Failed to add reaction');
      }
      // Reaction will be added via SSE
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
    setShowEmojiPicker(null);
  };

  const handleRemoveReaction = async (messageId: number, emoji: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        console.error('Failed to remove reaction');
      }
      // Reaction will be removed via SSE
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      console.log('Message copied to clipboard');
    }).catch((error) => {
      console.error('Failed to copy message:', error);
    });
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Message will be removed via SSE
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message');
    }
  };

  const handleDeleteConversation = async () => {
    if (!dmId) return;

    if (!confirm('Are you sure you want to delete this conversation? This will delete all messages and cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${dmId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/messages');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Failed to delete conversation');
      alert('Failed to delete conversation');
    }
  };

  const getMentionableUsers = (): User[] => {
    const users: User[] = [];
    
    if (conversation) {
      const otherUser = getOtherUser();
      if (otherUser) users.push(otherUser);
    } else if (groupChat) {
      const currentUserId = parseInt((session?.user as any)?.id || '0');
      groupChat.members.forEach((member) => {
        if (member.user.id !== currentUserId) {
          users.push(member.user);
        }
      });
    }
    
    return users;
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    handleTyping();

    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      const charBeforeAt = lastAtIndex === 0 ? ' ' : value[lastAtIndex - 1];
      if ((charBeforeAt === ' ' || lastAtIndex === 0) && !textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt.toLowerCase());
        const mentionableUsers = getMentionableUsers();
        
        const filtered = mentionableUsers.filter(
          (user) =>
            user.username.toLowerCase().includes(textAfterAt.toLowerCase()) ||
            (user.nickname && user.nickname.toLowerCase().includes(textAfterAt.toLowerCase()))
        );
        
        const suggestions = groupChat && 'everyone'.includes(textAfterAt.toLowerCase())
          ? [{ id: -1, username: 'everyone', nickname: null, avatar: null } as User, ...filtered]
          : filtered;
        
        setMentionSuggestions(suggestions);
        setShowMentionSuggestions(suggestions.length > 0);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const insertMention = (username: string) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const beforeAt = newMessage.substring(0, lastAtIndex);
      const afterAt = newMessage.substring(lastAtIndex + 1);
      const afterMention = afterAt.includes(' ') ? afterAt.substring(afterAt.indexOf(' ')) : '';
      setNewMessage(`${beforeAt}@${username} ${afterMention}`);
      setShowMentionSuggestions(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selectedUser = mentionSuggestions[selectedMentionIndex];
        insertMention(selectedUser.username);
      } else if (e.key === 'Escape') {
        setShowMentionSuggestions(false);
      }
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!dmId && !groupId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: '#313338' }}>
        <div className="text-center px-4">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: '#2b2d31' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#949ba4">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#f2f3f5' }}>
            No chat selected
          </h2>
          <p className="text-sm" style={{ color: '#949ba4' }}>
            Select a conversation or group from the sidebar
          </p>
        </div>
      </div>
    );
  }

  const activeChat = conversation || groupChat;
  const chatName = conversation 
    ? (getOtherUser()?.nickname || getOtherUser()?.username || 'Unknown')
    : groupChat?.name || 'Unknown';
  const chatAvatar = conversation
    ? getOtherUser()?.avatar
    : groupChat?.avatar;
  const currentUserId = parseInt((session?.user as any)?.id || '0');

  return (
    <div className="flex flex-col pt-14 lg:pt-0 fixed top-0 bottom-0 left-0 right-0 lg:left-60" style={{ backgroundColor: '#313338' }}>
      {activeChat ? (
        <>
          {/* Chat Header - Fixed */}
          <div className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 flex-shrink-0" style={{ 
            borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
            boxShadow: '0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)',
            backgroundColor: '#313338',
            zIndex: 10,
          }}>
            {conversation && <span className="text-xl" style={{ color: '#949ba4' }}>@</span>}
            {groupChat && <span className="text-xl" style={{ color: '#949ba4' }}>#</span>}
            
            <button
              onClick={() => {
                if (conversation) {
                  const otherUser = getOtherUser();
                  if (otherUser) {
                    router.push(`/profile/${otherUser.username}`);
                  }
                }
              }}
              className={`font-semibold text-sm sm:text-base truncate ${conversation ? 'hover:underline' : 'cursor-default'}`}
              style={{ color: '#f2f3f5' }}
              disabled={!conversation}
            >
              {chatName}
            </button>
            
            {conversation && (
              <button
                onClick={handleDeleteConversation}
                className="ml-auto p-2 rounded hover:bg-gray-700 transition"
                title="Delete Conversation"
                style={{ color: '#b5bac1' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            )}
            
            {groupChat && (
              <>
                <span className="text-sm" style={{ color: '#949ba4' }}>
                  ({groupChat.members.length} members)
                </span>
                <button
                  onClick={() => setShowGroupSettings(true)}
                  className="ml-auto p-2 rounded hover:bg-gray-700 transition"
                  title="Group Settings"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#b5bac1">
                    <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z"/>
                    <path d="M3 13C3 12.5341 3.03591 12.0765 3.10509 11.6296L5.74864 11.1567C5.88167 10.6437 6.07567 10.1533 6.32336 9.69318L4.81331 7.51741C5.32331 6.82107 5.92607 6.19852 6.60487 5.66794L8.81517 7.13088C9.27059 6.87428 9.75654 6.67426 10.2641 6.53773L10.7295 3.84479C11.1506 3.78129 11.5792 3.75 12.0114 3.75C12.4784 3.75 12.9371 3.78875 13.3849 3.86233L13.8503 6.52557C14.3595 6.65825 14.8474 6.85003 15.3055 7.09486L17.5028 5.63344C18.1846 6.1633 18.7899 6.78476 19.3015 7.48067L17.7889 9.66587C18.0383 10.1284 18.2335 10.6214 18.3672 11.1377L21.0172 11.6106C21.0876 12.0639 21.125 12.5279 21.125 13C21.125 13.4377 21.0929 13.8676 21.0305 14.2888L18.3801 14.7617C18.2471 15.2747 18.0531 15.7651 17.8054 16.2252L19.3155 18.401C18.8055 19.0973 18.2027 19.7199 17.5239 20.2505L15.3136 18.7875C14.8582 19.0441 14.3722 19.2441 13.8647 19.3807L13.3993 22.0736C12.9782 22.1371 12.5496 22.1684 12.1174 22.1684C11.6504 22.1684 11.1917 22.1296 10.7439 22.056L10.2785 19.3928C9.76927 19.2601 9.28136 19.0683 8.82323 18.8235L6.62603 20.285C5.94416 19.7551 5.33897 19.1336 4.82731 18.4377L6.33987 16.2525C6.09053 15.79 5.89529 15.297 5.7616 14.7807L3.11153 14.3078C3.04113 13.8545 3.00373 13.3905 3.00373 12.9528C3.00373 12.9193 3.00391 12.8858 3.00427 12.8524L3 13Z"/>
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Media Viewer Modal */}
          {viewingMedia && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
              onClick={() => setViewingMedia(null)}
            >
              <button
                onClick={() => setViewingMedia(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-800 transition z-10"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', color: 'white' }}
                title="Close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
              
              <div 
                className="max-w-7xl max-h-[90vh] w-full mx-4 flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                {viewingMedia.type.startsWith('image/') ? (
                  <img
                    src={viewingMedia.url}
                    alt={viewingMedia.name}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                ) : viewingMedia.type.startsWith('video/') ? (
                  <video
                    src={viewingMedia.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  />
                ) : null}
              </div>
            </div>
          )}

          {/* Group Settings Modal */}
          {showGroupSettings && groupChat && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowGroupSettings(false)}
            >
              <div 
                className="rounded-lg p-6 max-w-md w-full mx-4"
                style={{ backgroundColor: '#2b2d31' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold" style={{ color: '#f2f3f5' }}>
                    Group Settings
                  </h2>
                  <button
                    onClick={() => setShowGroupSettings(false)}
                    className="text-2xl hover:text-white transition"
                    style={{ color: '#949ba4' }}
                  >
                    ×
                  </button>
                </div>

                {/* Group Avatar Upload - Admin Only */}
                {isGroupAdmin() && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#949ba4' }}>
                      GROUP AVATAR
                    </h3>
                    <div className="flex items-center gap-4">
                      {groupChat.avatar ? (
                        <img
                          src={groupChat.avatar}
                          alt={groupChat.name}
                          className="w-20 h-20 rounded-full"
                        />
                      ) : (
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                          style={{ backgroundColor: '#5865f2' }}
                        >
                          {groupChat.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          ref={groupAvatarInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleGroupAvatarUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => groupAvatarInputRef.current?.click()}
                          disabled={uploadingGroupAvatar}
                          className="px-4 py-2 rounded font-semibold hover:bg-blue-600 transition disabled:opacity-50"
                          style={{ backgroundColor: '#5865f2', color: '#fff' }}
                        >
                          {uploadingGroupAvatar ? 'Uploading...' : 'Change Avatar'}
                        </button>
                        <p className="text-xs mt-2" style={{ color: '#949ba4' }}>
                          Recommended: Square image, max 5MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2" style={{ color: '#949ba4' }}>
                    GROUP NAME
                  </h3>
                  <p className="text-base" style={{ color: '#f2f3f5' }}>{groupChat.name}</p>
                </div>

                {groupChat.description && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2" style={{ color: '#949ba4' }}>
                      DESCRIPTION
                    </h3>
                    <p className="text-base" style={{ color: '#f2f3f5' }}>{groupChat.description}</p>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold" style={{ color: '#949ba4' }}>
                      MEMBERS ({groupChat.members.length})
                    </h3>
                    {isGroupAdmin() && (
                      <button
                        onClick={() => setShowAddMember(!showAddMember)}
                        className="text-sm font-semibold hover:underline"
                        style={{ color: '#00a8fc' }}
                      >
                        Add Member
                      </button>
                    )}
                  </div>

                  {showAddMember && (
                    <div className="mb-3 p-3 rounded" style={{ backgroundColor: '#1e1f22' }}>
                      <p className="text-xs mb-2" style={{ color: '#949ba4' }}>Select a friend to add:</p>
                      {getAvailableFriends().length === 0 ? (
                        <p className="text-sm" style={{ color: '#949ba4' }}>No friends available to add</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {getAvailableFriends().map((friend) => (
                            <button
                              key={friend.id}
                              onClick={() => handleAddMember(friend.id)}
                              disabled={addingMember}
                              className="w-full p-2 rounded flex items-center gap-2 transition hover:bg-gray-700"
                            >
                              {friend.avatar ? (
                                <img
                                  src={friend.avatar}
                                  alt={friend.username}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                                  style={{ backgroundColor: '#5865f2' }}
                                >
                                  {friend.username.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm flex-1 text-left" style={{ color: '#f2f3f5' }}>
                                {friend.nickname || friend.username}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {groupChat.members.map((member) => {
                      const isCurrentUser = member.user.id === currentUserId;
                      return (
                        <div key={member.user.id} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: '#1e1f22' }}>
                          {member.user.avatar ? (
                            <img
                              src={member.user.avatar}
                              alt={member.user.username}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                              style={{ backgroundColor: '#5865f2' }}
                            >
                              {member.user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: '#f2f3f5' }}>
                              {member.user.nickname || member.user.username}
                              {isCurrentUser && ' (You)'}
                            </p>
                            {member.role === 'admin' && (
                              <span className="text-xs" style={{ color: '#00a8fc' }}>Admin</span>
                            )}
                          </div>
                          {(isGroupAdmin() && !isCurrentUser) && (
                            <button
                              onClick={() => handleRemoveMember(member.user.id)}
                              className="px-2 py-1 rounded text-xs font-semibold hover:bg-red-600 transition"
                              style={{ backgroundColor: '#da373c', color: '#fff' }}
                            >
                              Kick
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t" style={{ borderColor: '#1e1f22' }}>
                  <button
                    onClick={() => handleRemoveMember(currentUserId)}
                    className="w-full px-4 py-2 rounded font-semibold hover:bg-red-700 transition"
                    style={{ backgroundColor: '#da373c', color: '#fff' }}
                  >
                    Leave Group
                  </button>
                  {isGroupAdmin() && (
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full px-4 py-2 rounded font-semibold hover:bg-red-800 transition"
                      style={{ backgroundColor: '#a12828', color: '#fff' }}
                    >
                      Delete Group
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4" style={{ minHeight: 0, maxHeight: '100%' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                {chatAvatar ? (
                  <img
                    src={chatAvatar}
                    alt=""
                    className="w-20 h-20 rounded-full mb-4"
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-4"
                    style={{ backgroundColor: '#5865f2' }}
                  >
                    {chatName.charAt(0).toUpperCase()}
                  </div>
                )}
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#f2f3f5' }}>
                  {chatName}
                </h2>
                <p className="text-sm mb-4" style={{ color: '#949ba4' }}>
                  {conversation
                    ? `This is the beginning of your direct message history with @${getOtherUser()?.username}`
                    : `This is the beginning of the ${groupChat?.name} group chat.`
                  }
                </p>
              </div>
            ) : (
              <div>
                {messages.map((msg, index) => {
                  const isCurrentUser = msg.sender.id === currentUserId;
                  const showAvatar = index === 0 || messages[index - 1].sender.id !== msg.sender.id;
                  const isConsecutive = !showAvatar;

                  return (
                    <div 
                      key={msg.tempId || msg.id} 
                      className={`flex gap-2 sm:gap-4 hover:bg-[#2e3035] px-2 sm:px-4 py-1 -mx-2 sm:-mx-4 rounded ${isConsecutive ? 'mt-0.5' : 'mt-3 sm:mt-4'} ${msg.isPending ? 'opacity-70' : ''} relative group`}
                      onMouseEnter={() => setHoveredMessage(msg.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          isCurrentUser ? (
                            (session?.user as any)?.avatar ? (
                              <img
                                src={(session?.user as any)?.avatar}
                                alt="You"
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-base"
                                style={{ backgroundColor: '#5865f2' }}
                              >
                                {((session?.user as any)?.username?.charAt(0) || 'U').toUpperCase()}
                              </div>
                            )
                          ) : (
                            msg.sender.avatar ? (
                              <img
                                src={msg.sender.avatar}
                                alt={msg.sender.username}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
                              />
                            ) : (
                              <div
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-base"
                                style={{ backgroundColor: '#5865f2' }}
                              >
                                {msg.sender.username.charAt(0).toUpperCase()}
                              </div>
                            )
                          )
                        ) : (
                          <div className="w-8 sm:w-10"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        {/* Hover Actions */}
                        {!msg.isPending && hoveredMessage === msg.id && (
                          <div className="absolute -top-4 right-4 flex gap-1 p-1 rounded shadow-lg z-10" style={{ backgroundColor: '#2b2d31' }}>
                            <button
                              onClick={() => handleReply(msg)}
                              className="p-1.5 rounded hover:bg-gray-700 transition"
                              title="Reply"
                              style={{ color: '#b5bac1' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                              className="p-1.5 rounded hover:bg-gray-700 transition"
                              title="Add Reaction"
                              style={{ color: '#b5bac1' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                              </svg>
                            </button>
                            {msg.content && (
                              <button
                                onClick={() => handleCopyMessage(msg.content)}
                                className="p-1.5 rounded hover:bg-gray-700 transition"
                                title="Copy"
                                style={{ color: '#b5bac1' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                              </button>
                            )}
                            {isCurrentUser && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1.5 rounded hover:bg-red-700 transition"
                                title="Delete Message"
                                style={{ color: '#da373c' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker === msg.id && (
                          <div 
                            className="absolute top-0 right-16 p-2 rounded shadow-lg z-20 flex flex-wrap gap-1" 
                            style={{ backgroundColor: '#2b2d31', maxWidth: '200px' }}
                          >
                            {['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉', '🔥', '💯'].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleAddReaction(msg.id, emoji)}
                                className="text-2xl hover:bg-gray-700 rounded p-1 transition"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {showAvatar && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <button
                              onClick={() => router.push(`/profile/${msg.sender.username}`)}
                              className="font-semibold hover:underline"
                              style={{ color: isCurrentUser ? '#00a8fc' : '#f2f3f5' }}
                            >
                              {isCurrentUser ? ((session?.user as any)?.nickname || (session?.user as any)?.username) : (msg.sender.nickname || msg.sender.username)}
                            </button>
                            <span className="text-xs" style={{ color: '#949ba4' }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <div>
                          {/* Reply Context */}
                          {msg.replyTo && (
                            <div 
                              className="mb-2 pl-2 py-1 border-l-2 rounded text-sm cursor-pointer hover:bg-black hover:bg-opacity-10"
                              style={{ borderColor: '#4e5058', color: '#b5bac1' }}
                              onClick={() => {
                                const element = document.getElementById(`msg-${msg.replyTo!.id}`);
                                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                                </svg>
                                <span className="font-semibold">
                                  {msg.replyTo.sender.nickname || msg.replyTo.sender.username}
                                </span>
                              </div>
                              <p className="truncate" style={{ color: '#949ba4' }}>
                                {msg.replyTo.content}
                              </p>
                            </div>
                          )}
                          
                          {msg.content && (
                            <div className="flex items-center gap-2">
                              <p className="break-words" style={{ color: '#dbdee1', lineHeight: '1.375rem' }}>
                                {linkifyText(msg.content, router)}
                              </p>
                              {msg.isPending && (
                                <span className="text-xs" style={{ color: '#949ba4' }} title="Sending...">
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                </span>
                              )}
                            </div>
                          )}
                          {msg.attachments && (() => {
                            try {
                              const attachmentList: Attachment[] = typeof msg.attachments === 'string' 
                                ? JSON.parse(msg.attachments)
                                : msg.attachments;
                              
                              return (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {attachmentList.map((attachment, idx) => {
                                    const isImage = attachment.type.startsWith('image/');
                                    const isVideo = attachment.type.startsWith('video/');
                                    
                                    return (
                                      <div key={idx} className="max-w-sm">
                                        {isImage ? (
                                          <img
                                            src={attachment.url}
                                            alt={attachment.name}
                                            className="rounded-lg max-h-80 max-w-full object-contain cursor-pointer hover:opacity-90 transition"
                                            onClick={() => setViewingMedia({ url: attachment.url, type: attachment.type, name: attachment.name })}
                                          />
                                        ) : isVideo ? (
                                          <div className="relative">
                                            <video
                                              src={attachment.url}
                                              controls
                                              className="rounded-lg max-h-80 max-w-full object-contain"
                                            />
                                            <button
                                              onClick={() => setViewingMedia({ url: attachment.url, type: attachment.type, name: attachment.name })}
                                              className="absolute top-2 right-2 p-2 rounded-full hover:bg-black hover:bg-opacity-50 transition"
                                              style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
                                              title="View fullscreen"
                                            >
                                              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                                              </svg>
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          })()}

                          {/* Reactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(() => {
                                const grouped = msg.reactions.reduce((acc, reaction) => {
                                  if (!acc[reaction.emoji]) {
                                    acc[reaction.emoji] = [];
                                  }
                                  acc[reaction.emoji].push(reaction);
                                  return acc;
                                }, {} as Record<string, typeof msg.reactions>);

                                return Object.entries(grouped).map(([emoji, reactions]) => {
                                  const hasReacted = reactions.some(r => r.userId === currentUserId);
                                  const usernames = reactions.map(r => r.user.nickname || r.user.username).join(', ');

                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => hasReacted ? handleRemoveReaction(msg.id, emoji) : handleAddReaction(msg.id, emoji)}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm transition ${
                                        hasReacted ? 'hover:bg-blue-900' : 'hover:bg-gray-700'
                                      }`}
                                      style={{ 
                                        backgroundColor: hasReacted ? '#2e4a7c' : '#2b2d31',
                                        border: hasReacted ? '1px solid #5865f2' : '1px solid #1e1f22'
                                      }}
                                      title={usernames}
                                    >
                                      <span>{emoji}</span>
                                      <span style={{ color: hasReacted ? '#5865f2' : '#b5bac1' }}>
                                        {reactions.length}
                                      </span>
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
            {/* Typing Indicator */}
            {typingUsers.size > 0 && (
              <div className="px-2 py-1">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#949ba4', animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#949ba4', animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#949ba4', animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm italic" style={{ color: '#949ba4' }}>
                    {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Message Input - Fixed */}
          <form
            onSubmit={handleSendMessage}
            className="px-3 sm:px-4 pb-4 sm:pb-6 flex-shrink-0"
            style={{
              backgroundColor: '#313338',
              zIndex: 10,
            }}
          >
            {/* Reply Context */}
            {replyingTo && (
              <div className="mb-2 flex items-center gap-2 p-2 rounded" style={{ backgroundColor: '#2b2d31' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1">
                      <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                    </svg>
                    <span className="text-sm font-semibold" style={{ color: '#b5bac1' }}>
                      Replying to {replyingTo.sender.nickname || replyingTo.sender.username}
                    </span>
                  </div>
                  <p className="text-sm truncate" style={{ color: '#949ba4' }}>
                    {replyingTo.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded hover:bg-gray-700 transition"
                  style={{ color: '#949ba4' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => {
                  const isImage = attachment.type.startsWith('image/');
                  const isVideo = attachment.type.startsWith('video/');
                  
                  return (
                    <div key={index} className="relative group">
                      {isImage ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="h-20 w-20 object-cover rounded"
                        />
                      ) : isVideo ? (
                        <video
                          src={attachment.url}
                          className="h-20 w-20 object-cover rounded"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-700 transition"
                        style={{ backgroundColor: '#da373c', color: '#fff' }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="rounded-lg flex items-center gap-2" style={{ backgroundColor: '#383a40' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="ml-3 p-2 rounded hover:bg-gray-700 transition flex-shrink-0"
                title="Attach files"
                style={{ color: uploading ? '#949ba4' : '#b5bac1' }}
              >
                {uploading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41C3.37 14.2 4.63 14.2 5.41 13.41L11 7.83V19C11 20.1 11.9 21 13 21C14.1 21 15 20.1 15 19V7.83L20.59 13.41C21.37 14.2 22.63 14.2 23.41 13.41C24.2 12.63 24.2 11.37 23.41 10.59L15.41 2.59C15 2.19 14.5 2 14 2H12Z"/>
                  </svg>
                )}
              </button>
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={conversation ? `Message @${getOtherUser()?.username}` : `Message #${groupChat?.name}`}
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3"
                  style={{ 
                    backgroundColor: 'transparent',
                    color: '#dbdee1',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                  }}
                />
                
                {/* Mention Suggestions Dropdown */}
                {showMentionSuggestions && mentionSuggestions.length > 0 && (
                  <div
                    className="absolute bottom-full left-0 mb-2 rounded-lg shadow-lg overflow-hidden"
                    style={{
                      backgroundColor: '#2b2d31',
                      minWidth: '200px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 50,
                    }}
                  >
                    <div className="p-2">
                      <p className="text-xs font-semibold mb-2 px-2" style={{ color: '#949ba4' }}>
                        MENTION
                      </p>
                      {mentionSuggestions.map((user, index) => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user.username)}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded transition"
                          style={{
                            backgroundColor: index === selectedMentionIndex ? '#404249' : 'transparent',
                          }}
                          onMouseEnter={() => setSelectedMentionIndex(index)}
                        >
                          {user.id === -1 ? (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                              style={{ backgroundColor: '#5865f2' }}
                            >
                              @
                            </div>
                          ) : user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                              style={{ backgroundColor: '#5865f2' }}
                            >
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold" style={{ color: '#f2f3f5' }}>
                              {user.id === -1 ? 'everyone' : (user.nickname || user.username)}
                            </p>
                            {user.id !== -1 && (
                              <p className="text-xs" style={{ color: '#949ba4' }}>
                                @{user.username}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim() && attachments.length === 0}
                className="mr-3 p-2 rounded hover:bg-gray-700 transition flex-shrink-0"
                title="Send message"
                style={{ color: (newMessage.trim() || attachments.length > 0) ? '#5865f2' : '#4e5058' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-xl font-semibold mb-2" style={{ color: '#f2f3f5' }}>
              Chat not found
            </h2>
            <p className="text-sm" style={{ color: '#949ba4' }}>
              This conversation or group may no longer exist
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading messages...</p>
        </div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}
