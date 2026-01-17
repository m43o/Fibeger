'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSidebar } from '../context/SidebarContext';
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';

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
  unreadCount?: number;
}

interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  members: { user: User; role: string }[];
  messages: Message[];
  unreadCount?: number;
}

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, closeSidebar } = useSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [showDMs, setShowDMs] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [friends, setFriends] = useState<User[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const { on, off } = useRealtimeEvents();

  // Initial fetch (no polling!)
  useEffect(() => {
    if (session) {
      fetchConversations();
      fetchGroupChats();
      fetchFriends();
    }
  }, [session]);

  // Subscribe to real-time conversation and group updates
  useEffect(() => {
    const handleConversationUpdate = () => {
      fetchConversations();
    };

    const handleGroupUpdate = () => {
      fetchGroupChats();
    };

    // Handle incoming messages to update unread counts instantly
    const handleMessage = (event: any) => {
      const { conversationId, groupChatId, message } = event.data;
      const currentUserId = parseInt((session?.user as any)?.id || '0');

      // Don't update unread count for own messages
      if (message?.sender?.id === currentUserId) {
        return;
      }

      // Update conversation unread count locally (optimistic update)
      if (conversationId) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
              : conv
          )
        );
      }

      // Update group chat unread count locally (optimistic update)
      if (groupChatId) {
        setGroupChats((prev) =>
          prev.map((group) =>
            group.id === groupChatId
              ? { ...group, unreadCount: (group.unreadCount || 0) + 1 }
              : group
          )
        );
      }
    };

    // Handle conversation deletion
    const handleConversationDeleted = (event: any) => {
      const { conversationId } = event.data;
      setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
    };

    // Handle group chat deletion
    const handleGroupDeleted = (event: any) => {
      const { groupChatId } = event.data;
      setGroupChats((prev) => prev.filter((group) => group.id !== groupChatId));
    };

    const unsubConversation = on('conversation_update', handleConversationUpdate);
    const unsubGroup = on('group_update', handleGroupUpdate);
    const unsubMessage = on('message', handleMessage);
    const unsubConversationDeleted = on('conversation_deleted', handleConversationDeleted);
    const unsubGroupDeleted = on('group_deleted', handleGroupDeleted);

    return () => {
      unsubConversation();
      unsubGroup();
      unsubMessage();
      unsubConversationDeleted();
      unsubGroupDeleted();
    };
  }, [on, session]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations');
    }
  };

  const fetchGroupChats = async () => {
    try {
      const res = await fetch('/api/groupchats');
      if (res.ok) {
        const data = await res.json();
        setGroupChats(data);
      }
    } catch (error) {
      console.error('Failed to load group chats');
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
        router.push(`/messages?dm=${conversation.id}`);
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

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    setCreatingGroup(true);
    try {
      const res = await fetch('/api/groupchats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDescription || null,
          memberIds: selectedFriends,
        }),
      });

      if (res.ok) {
        const group = await res.json();
        await fetchGroupChats();
        setShowNewGroup(false);
        setNewGroupName('');
        setNewGroupDescription('');
        setSelectedFriends([]);
        router.push(`/messages?group=${group.id}`);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create group');
      }
    } catch (error) {
      console.error('Failed to create group');
      alert('Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleFriendSelection = (friendId: number) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  if (!session) {
    return null;
  }

  const isActive = (href: string) => pathname === href;
  const isMessageActive = (id: number, type: 'dm' | 'group') => {
    if (pathname !== '/messages') return false;
    const params = new URLSearchParams(window.location.search);
    const dmId = params.get('dm');
    const groupId = params.get('group');
    if (type === 'dm') return dmId === id.toString();
    return groupId === id.toString();
  };

  const navItems = [
    { href: '/feed', label: 'Feed', icon: '📷' },
    { href: '/friends', label: 'Friends', icon: '👥' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 h-screen w-60 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: '#2b2d31',
          borderRight: 'none',
        }}
        aria-label="Sidebar navigation"
      >
      {/* Mobile Close Button */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#1e1f22' }}>
        <span className="text-sm font-semibold" style={{ color: '#f2f3f5' }}>Menu</span>
        <button
          onClick={closeSidebar}
          className="p-2 rounded hover:bg-gray-700 transition"
          aria-label="Close menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="#949ba4"
          >
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto" aria-label="Main navigation">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => closeSidebar()}
              className="flex items-center gap-3 px-2 py-1.5 rounded transition-all group"
              style={{
                backgroundColor: isActive(item.href) ? '#404249' : 'transparent',
                color: isActive(item.href) ? '#ffffff' : '#949ba4',
                fontSize: '16px',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.href)) {
                  e.currentTarget.style.backgroundColor = '#35373c';
                  e.currentTarget.style.color = '#dbdee1';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.href)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#949ba4';
                }
              }}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span className="text-base">{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Direct Messages Accordion */}
        <div className="mt-4">
          <div className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-700 transition">
            <button
              onClick={() => setShowDMs(!showDMs)}
              className="flex items-center gap-2 flex-1"
            >
              <span 
                className="text-xs transition-transform"
                style={{ color: '#949ba4', transform: showDMs ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ▶
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#949ba4' }}>
                Direct Messages
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowNewConversation(!showNewConversation);
              }}
              className="text-lg hover:text-white transition" 
              style={{ color: '#949ba4' }}
              title="Start a conversation"
            >
              +
            </button>
          </div>

          {showNewConversation && (
            <div className="px-2 py-2 mb-2" style={{ backgroundColor: '#1e1f22', borderRadius: '4px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: '#f2f3f5' }}>Select a Friend</span>
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="text-lg hover:text-white transition"
                  style={{ color: '#949ba4' }}
                >
                  ×
                </button>
              </div>
              {getFriendsWithoutConversation().length === 0 ? (
                <div className="text-center py-2">
                  <p className="text-xs mb-1" style={{ color: '#949ba4' }}>
                    No friends available
                  </p>
                  <Link
                    href="/friends"
                    className="text-xs font-semibold hover:underline"
                    style={{ color: '#00a8fc' }}
                  >
                    Add friends
                  </Link>
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {getFriendsWithoutConversation().map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleStartConversation(friend.id)}
                      disabled={creatingConversation}
                      className="w-full p-1.5 rounded flex items-center gap-2 transition hover:bg-gray-700"
                      style={{ backgroundColor: 'transparent' }}
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
                      <span className="text-sm truncate" style={{ color: '#f2f3f5' }}>
                        {friend.nickname || friend.username}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showDMs && (
            <div className="mt-1 space-y-0.5">
              {conversations.length === 0 ? (
                <div className="px-2 py-1">
                  <p className="text-xs" style={{ color: '#949ba4' }}>No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const otherUser = getOtherUser(conv);
                  const isConvActive = isMessageActive(conv.id, 'dm');
                  const hasUnread = (conv.unreadCount || 0) > 0;
                  
                  return (
                    <Link
                      key={conv.id}
                      href={`/messages?dm=${conv.id}`}
                      onClick={() => closeSidebar()}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-all"
                      style={{
                        backgroundColor: isConvActive ? '#404249' : 'transparent',
                        color: isConvActive ? '#ffffff' : '#949ba4',
                      }}
                      onMouseEnter={(e) => {
                        if (!isConvActive) {
                          e.currentTarget.style.backgroundColor = '#35373c';
                          e.currentTarget.style.color = '#dbdee1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isConvActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#949ba4';
                        }
                      }}
                    >
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
                      <span className="text-sm truncate flex-1" style={{ 
                        fontWeight: hasUnread ? 600 : 'normal',
                        color: hasUnread && !isConvActive ? '#f2f3f5' : undefined
                      }}>
                        {otherUser?.nickname || otherUser?.username}
                      </span>
                      {hasUnread && (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#f23f42', color: '#ffffff' }}
                        >
                          {conv.unreadCount! > 9 ? '9+' : conv.unreadCount}
                        </div>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Groups Accordion */}
        <div className="mt-4">
          <div className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-700 transition">
            <button
              onClick={() => setShowGroups(!showGroups)}
              className="flex items-center gap-2 flex-1"
            >
              <span 
                className="text-xs transition-transform"
                style={{ color: '#949ba4', transform: showGroups ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ▶
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#949ba4' }}>
                Groups
              </span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowNewGroup(!showNewGroup);
              }}
              className="text-lg hover:text-white transition" 
              style={{ color: '#949ba4' }}
              title="Create a group"
            >
              +
            </button>
          </div>

          {showNewGroup && (
            <div className="px-2 py-2 mb-2" style={{ backgroundColor: '#1e1f22', borderRadius: '4px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: '#f2f3f5' }}>Create Group</span>
                <button
                  onClick={() => {
                    setShowNewGroup(false);
                    setNewGroupName('');
                    setNewGroupDescription('');
                    setSelectedFriends([]);
                  }}
                  className="text-lg hover:text-white transition"
                  style={{ color: '#949ba4' }}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateGroup} className="space-y-2">
                <input
                  type="text"
                  placeholder="Group Name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-2 py-1 rounded text-sm"
                  style={{ backgroundColor: '#383a40', color: '#f2f3f5', border: 'none', outline: 'none' }}
                  required
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="w-full px-2 py-1 rounded text-sm resize-none"
                  style={{ backgroundColor: '#383a40', color: '#f2f3f5', border: 'none', outline: 'none' }}
                  rows={2}
                />
                {friends.length > 0 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#949ba4' }}>Add Friends (optional)</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {friends.map((friend) => (
                        <label
                          key={friend.id}
                          className="flex items-center gap-2 p-1 rounded hover:bg-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.includes(friend.id)}
                            onChange={() => toggleFriendSelection(friend.id)}
                            className="cursor-pointer"
                          />
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.username}
                              className="w-5 h-5 rounded-full"
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                              style={{ backgroundColor: '#5865f2' }}
                            >
                              {friend.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs truncate" style={{ color: '#f2f3f5' }}>
                            {friend.nickname || friend.username}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="w-full py-1.5 rounded text-sm font-semibold hover:brightness-90 transition"
                  style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </form>
            </div>
          )}

          {showGroups && (
            <div className="mt-1 space-y-0.5">
              {groupChats.length === 0 ? (
                <div className="px-2 py-1">
                  <p className="text-xs" style={{ color: '#949ba4' }}>No groups yet</p>
                </div>
              ) : (
                groupChats.map((group) => {
                  const isGroupActive = isMessageActive(group.id, 'group');
                  const hasUnread = (group.unreadCount || 0) > 0;
                  
                  return (
                    <Link
                      key={group.id}
                      href={`/messages?group=${group.id}`}
                      onClick={() => closeSidebar()}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-all"
                      style={{
                        backgroundColor: isGroupActive ? '#404249' : 'transparent',
                        color: isGroupActive ? '#ffffff' : '#949ba4',
                      }}
                      onMouseEnter={(e) => {
                        if (!isGroupActive) {
                          e.currentTarget.style.backgroundColor = '#35373c';
                          e.currentTarget.style.color = '#dbdee1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isGroupActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#949ba4';
                        }
                      }}
                    >
                      {group.avatar ? (
                        <img
                          src={group.avatar}
                          alt={group.name}
                          className="w-8 h-8 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                          style={{ backgroundColor: '#5865f2' }}
                        >
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm truncate flex-1" style={{ 
                        fontWeight: hasUnread ? 600 : 'normal',
                        color: hasUnread && !isGroupActive ? '#f2f3f5' : undefined
                      }}>
                        {group.name}
                      </span>
                      {hasUnread && (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#f23f42', color: '#ffffff' }}
                        >
                          {group.unreadCount! > 9 ? '9+' : group.unreadCount}
                        </div>
                      )}
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Profile Section */}
      <div className="mt-auto" style={{ 
        backgroundColor: '#232428',
        padding: '10px 8px',
      }}>
        <div className="flex items-center gap-2 px-2">
          {(session.user as any)?.avatar ? (
            <img 
              src={(session.user as any).avatar}
              alt="Your avatar"
              className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
            />
          ) : (
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
            >
              {((session.user as any)?.username?.[0] || session.user?.email?.[0] || 'U').toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: '#f2f3f5' }}>
              {(session.user as any)?.username || session.user?.email}
            </div>
            <div className="text-xs" style={{ color: '#949ba4' }}>Online</div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Link
              href="/profile"
              className="p-1.5 rounded hover:bg-gray-700 transition"
              title="Profile Settings"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#b5bac1">
                <path d="M19.738 10H22V14H19.739C19.498 14.931 19.1 15.798 18.565 16.564L20 18L18 20L16.565 18.564C15.797 19.099 14.932 19.498 14 19.738V22H10V19.738C9.069 19.498 8.203 19.099 7.436 18.564L6 20L4 18L5.436 16.564C4.901 15.799 4.502 14.932 4.262 14H2V10H4.262C4.502 9.068 4.9 8.202 5.436 7.436L4 6L6 4L7.436 5.436C8.202 4.9 9.068 4.502 10 4.262V2H14V4.261C14.932 4.502 15.797 4.9 16.565 5.435L18 3.999L20 5.999L18.564 7.436C19.099 8.202 19.498 9.069 19.738 10ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z"/>
              </svg>
            </Link>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded hover:bg-gray-700 transition"
              title="Sign Out"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#b5bac1">
                <path d="M18 2H7C5.897 2 5 2.898 5 4V11H12.59L10.293 8.708L11.707 7.292L16.414 11.991L11.708 16.708L10.292 15.292L12.582 13H5V20C5 21.103 5.897 22 7 22H18C19.103 22 20 21.103 20 20V4C20 2.898 19.103 2 18 2Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
