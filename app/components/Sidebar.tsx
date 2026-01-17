'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

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

interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  members: { user: User; role: string }[];
  messages: Message[];
}

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [showDMs, setShowDMs] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [friends, setFriends] = useState<User[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  useEffect(() => {
    if (session) {
      fetchConversations();
      fetchGroupChats();
      fetchFriends();
      const interval = setInterval(() => {
        fetchConversations();
        fetchGroupChats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [session]);

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
    { href: '/friends', label: 'Friends', icon: '👥' },
  ];

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-60 flex flex-col"
      style={{
        backgroundColor: '#2b2d31',
        borderRight: 'none',
      }}
      aria-label="Sidebar navigation"
    >
      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto" aria-label="Main navigation">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
                  
                  return (
                    <Link
                      key={conv.id}
                      href={`/messages?dm=${conv.id}`}
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
                      <span className="text-sm truncate flex-1">
                        {otherUser?.nickname || otherUser?.username}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Groups Accordion */}
        <div className="mt-4">
          <button
            onClick={() => setShowGroups(!showGroups)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-700 transition"
          >
            <div className="flex items-center gap-2">
              <span 
                className="text-xs transition-transform"
                style={{ color: '#949ba4', transform: showGroups ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ▶
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#949ba4' }}>
                Groups
              </span>
            </div>
          </button>

          {showGroups && (
            <div className="mt-1 space-y-0.5">
              {groupChats.length === 0 ? (
                <div className="px-2 py-1">
                  <p className="text-xs" style={{ color: '#949ba4' }}>No groups yet</p>
                </div>
              ) : (
                groupChats.map((group) => {
                  const isGroupActive = isMessageActive(group.id, 'group');
                  
                  return (
                    <Link
                      key={group.id}
                      href={`/messages?group=${group.id}`}
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
                      <span className="text-sm truncate flex-1">
                        {group.name}
                      </span>
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
  );
}
