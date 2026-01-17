'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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

export default function MessagesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmId = searchParams.get('dm');
  const groupId = searchParams.get('group');

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    if (!dmId && !groupId) {
      setLoading(false);
      return;
    }

    if (dmId) {
      fetchConversation(parseInt(dmId));
      const interval = setInterval(() => fetchMessages(parseInt(dmId), 'dm'), 1500);
      return () => clearInterval(interval);
    } else if (groupId) {
      fetchGroupChat(parseInt(groupId));
      const interval = setInterval(() => fetchMessages(parseInt(groupId), 'group'), 1500);
      return () => clearInterval(interval);
    }
  }, [session, router, dmId, groupId]);

  const fetchConversation = async (id: number) => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        const conv = data.find((c: Conversation) => c.id === id);
        setConversation(conv || null);
        if (conv) {
          fetchMessages(id, 'dm');
        }
      }
    } catch (error) {
      console.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupChat = async (id: number) => {
    try {
      const res = await fetch('/api/groupchats');
      if (res.ok) {
        const data = await res.json();
        const group = data.find((g: GroupChat) => g.id === id);
        setGroupChat(group || null);
        if (group) {
          fetchMessages(id, 'group');
        }
      }
    } catch (error) {
      console.error('Failed to load group chat');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (id: number, type: 'dm' | 'group') => {
    try {
      const endpoint = type === 'dm' 
        ? `/api/conversations/${id}/messages`
        : `/api/groupchats/${id}/messages`;
      
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const id = dmId ? parseInt(dmId) : groupId ? parseInt(groupId) : null;
    if (!id) return;

    const type = dmId ? 'dm' : 'group';

    try {
      const endpoint = type === 'dm'
        ? `/api/conversations/${id}/messages`
        : `/api/groupchats/${id}/messages`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      if (res.ok) {
        setNewMessage('');
        fetchMessages(id, type);
      }
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    const userId = parseInt((session?.user as any)?.id || '0');
    return conversation.members.find((m) => m.user.id !== userId)?.user || null;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#313338' }}>
        <p className="text-xl font-semibold" style={{ color: '#949ba4' }}>Loading...</p>
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

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: '#313338' }}>
      {activeChat ? (
        <>
          {/* Chat Header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ 
            borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
            boxShadow: '0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)',
            backgroundColor: '#313338',
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
              className="font-semibold text-base hover:underline"
              style={{ color: '#f2f3f5' }}
            >
              {chatName}
            </button>
            {groupChat && (
              <span className="text-sm" style={{ color: '#949ba4' }}>
                ({groupChat.members.length} members)
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
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
                placeholder={conversation ? `Message @${getOtherUser()?.username}` : `Message #${groupChat?.name}`}
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
