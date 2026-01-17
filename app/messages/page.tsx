'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface Message {
  id: number;
  content: string;
  sender: User;
  createdAt: string;
}

interface Conversation {
  id: number;
  members: { user: User }[];
  messages: Message[];
}

export default function DMsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<User[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchConversations();
    fetchFriends();
    const interval = setInterval(fetchConversations, 3000);

    return () => clearInterval(interval);
  }, [session, router]);

  // Poll for messages in the selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    // Fetch messages immediately when conversation is selected
    fetchMessages(selectedConversation.id);

    // Set up polling interval for real-time updates
    const messagesInterval = setInterval(() => {
      fetchMessages(selectedConversation.id);
    }, 1500); // Poll every 1.5 seconds for instant feel

    return () => clearInterval(messagesInterval);
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Failed to load friends');
    }
  };

  const fetchMessages = async (conversationId: number) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    // fetchMessages will be called automatically by the useEffect
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !newMessage.trim()) return;

    try {
      const res = await fetch(
        `/api/conversations/${selectedConversation.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage }),
        }
      );

      if (res.ok) {
        setNewMessage('');
        // Message will appear automatically via polling
        // But we can fetch immediately for instant feedback
        fetchMessages(selectedConversation.id);
      }
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  const handleStartConversation = async (friendId: number) => {
    setCreatingConversation(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });

      if (res.ok) {
        const conversation = await res.json();
        await fetchConversations();
        setShowNewConversation(false);
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create conversation');
      }
    } catch (error) {
      console.error('Failed to create conversation');
      alert('Failed to create conversation');
    } finally {
      setCreatingConversation(false);
    }
  };

  const getOtherUser = (conversation: Conversation): User | null => {
    const userId = parseInt((session?.user as any)?.id || '0');
    return conversation.members.find((m) => m.user.id !== userId)?.user || null;
  };

  const getFriendsWithoutConversation = () => {
    const conversationFriendIds = conversations.map(conv => {
      const otherUser = getOtherUser(conv);
      return otherUser?.id;
    });
    return friends.filter(friend => !conversationFriendIds.includes(friend.id));
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <p className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading messages...</p>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Conversations List */}
      <div className="w-64 sm:w-80 flex flex-col" style={{ backgroundColor: '#2b2d31', borderRight: 'none' }}>
        {/* Search Bar Header */}
        <div className="px-4 py-3" style={{ 
          borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
          boxShadow: '0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)'
        }}>
          <input
            type="text"
            placeholder="Find or start a conversation"
            className="w-full px-2 py-1.5 rounded text-sm transition-all"
            style={{ 
              backgroundColor: '#1e1f22',
              color: '#f2f3f5',
              border: 'none',
              fontSize: '14px',
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* New Conversation Button */}
          <button
            onClick={() => setShowNewConversation(!showNewConversation)}
            className="w-full px-4 py-2 text-left flex items-center gap-2 transition-colors"
            style={{
              color: '#949ba4',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: showNewConversation ? '#404249' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!showNewConversation) e.currentTarget.style.backgroundColor = '#35373c';
            }}
            onMouseLeave={(e) => {
              if (!showNewConversation) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '20px' }}>+</span>
            <span>Start New Conversation</span>
          </button>

          {showNewConversation && (
            <div className="px-4 py-3" style={{ backgroundColor: '#1e1f22', borderBottom: '1px solid rgba(0, 0, 0, 0.2)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm" style={{ color: '#f2f3f5' }}>Select a Friend</h2>
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="text-xl hover:text-white transition"
                  style={{ color: '#949ba4' }}
                >
                  ×
                </button>
              </div>
              {getFriendsWithoutConversation().length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-sm mb-2" style={{ color: '#949ba4' }}>
                    No friends available
                  </p>
                  <Link
                    href="/friends"
                    className="text-sm font-semibold hover:underline"
                    style={{ color: '#00a8fc' }}
                  >
                    Add friends
                  </Link>
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {getFriendsWithoutConversation().map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleStartConversation(friend.id)}
                      disabled={creatingConversation}
                      className="w-full p-2 rounded flex items-center gap-3 transition hover:bg-gray-700"
                      style={{ backgroundColor: 'transparent' }}
                    >
                      {friend.avatar ? (
                        <img
                          src={friend.avatar}
                          alt={friend.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: '#5865f2' }}
                        >
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-sm" style={{ color: '#f2f3f5' }}>
                          {friend.nickname || friend.username}
                        </p>
                        <p className="text-xs" style={{ color: '#949ba4' }}>
                          @{friend.username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {conversations.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm" style={{ color: '#949ba4' }}>No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const otherUser = getOtherUser(conv);
              const lastMessage = conv.messages[0];
              const isSelected = selectedConversation?.id === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className="w-full px-2 py-1 mx-2 my-0.5 rounded text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? '#404249' : 'transparent',
                    maxWidth: 'calc(100% - 16px)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#35373c';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div className="flex items-center gap-3 p-2">
                    {otherUser?.avatar ? (
                      <img
                        src={otherUser.avatar}
                        alt={otherUser.username}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                        style={{ backgroundColor: '#5865f2' }}
                      >
                        {(otherUser?.username?.charAt(0) || 'U').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-base truncate" style={{ color: '#f2f3f5' }}>
                          {otherUser?.nickname || otherUser?.username}
                        </p>
                      </div>
                      {lastMessage && (
                        <p className="text-sm truncate" style={{ color: '#949ba4' }}>
                          {lastMessage.sender.id === parseInt((session?.user as any)?.id || '0') ? 'You: ' : ''}
                          {lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#313338' }}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ 
              borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
              boxShadow: '0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)',
              backgroundColor: '#313338',
            }}>
              <span className="text-xl" style={{ color: '#949ba4' }}>@</span>
              <button
                onClick={() => {
                  const otherUser = getOtherUser(selectedConversation);
                  if (otherUser) {
                    router.push(`/profile/${otherUser.username}`);
                  }
                }}
                className="font-semibold text-base hover:underline"
                style={{ color: '#f2f3f5' }}
              >
                {getOtherUser(selectedConversation)?.nickname ||
                  getOtherUser(selectedConversation)?.username}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  {getOtherUser(selectedConversation)?.avatar ? (
                    <img
                      src={getOtherUser(selectedConversation)!.avatar || ''}
                      alt=""
                      className="w-20 h-20 rounded-full mb-4"
                    />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-4"
                      style={{ backgroundColor: '#5865f2' }}
                    >
                      {(getOtherUser(selectedConversation)?.username?.charAt(0) || 'U').toUpperCase()}
                    </div>
                  )}
                  <h2 className="text-2xl font-bold mb-2" style={{ color: '#f2f3f5' }}>
                    {getOtherUser(selectedConversation)?.nickname || getOtherUser(selectedConversation)?.username}
                  </h2>
                  <p className="text-sm mb-4" style={{ color: '#949ba4' }}>
                    This is the beginning of your direct message history with @{getOtherUser(selectedConversation)?.username}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => {
                    const isCurrentUser = msg.sender.id === parseInt((session?.user as any)?.id || '0');
                    const showAvatar = index === 0 || messages[index - 1].sender.id !== msg.sender.id;

                    return (
                      <div key={msg.id} className="flex gap-4 hover:bg-black hover:bg-opacity-5 px-4 py-1 -mx-4 rounded">
                        <div className="flex-shrink-0">
                          {showAvatar ? (
                            isCurrentUser ? (
                              (session?.user as any)?.avatar ? (
                                <img
                                  src={(session?.user as any)?.avatar}
                                  alt="You"
                                  className="w-10 h-10 rounded-full"
                                />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
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
                                  className="w-10 h-10 rounded-full"
                                />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                                  style={{ backgroundColor: '#5865f2' }}
                                >
                                  {msg.sender.username.charAt(0).toUpperCase()}
                                </div>
                              )
                            )
                          ) : (
                            <div className="w-10"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          {showAvatar && (
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="font-semibold" style={{ color: isCurrentUser ? '#00a8fc' : '#f2f3f5' }}>
                                {isCurrentUser ? 'You' : (msg.sender.nickname || msg.sender.username)}
                              </span>
                              <span className="text-xs" style={{ color: '#949ba4' }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          <p className="break-words" style={{ color: '#dbdee1', lineHeight: '1.375rem' }}>
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="px-4 pb-6"
            >
              <div className="rounded-lg" style={{ backgroundColor: '#383a40' }}>
                <input
                  type="text"
                  placeholder={`Message @${getOtherUser(selectedConversation)?.username}`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg"
                  style={{ 
                    backgroundColor: '#383a40',
                    color: '#dbdee1',
                    border: 'none',
                    outline: 'none',
                    fontSize: '15px',
                  }}
                />
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
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
                Select a conversation from the list or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
