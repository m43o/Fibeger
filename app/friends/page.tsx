'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface UserPreview {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface FriendRequest {
  id: number;
  sender: UserPreview;
  status: string;
  createdAt: string;
}

export default function FriendsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPreview[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserPreview[]>([]);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchFriendRequests();
    fetchFriends();
  }, [session, router]);

  const fetchFriendRequests = async () => {
    try {
      const res = await fetch('/api/friends/request/dummy');
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Failed to load friend requests');
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

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/friends/request?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (error) {
      setMessage('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (username: string) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUsername: username }),
      });

      if (res.ok) {
        setMessage('✓ Friend request sent!');
        setSearchQuery('');
        setSearchResults([]);
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to send request');
      }
    } catch (error) {
      setMessage('Error sending friend request');
    }
  };

  const handleRespondToRequest = async (
    requestId: number,
    action: 'accept' | 'reject'
  ) => {
    try {
      const res = await fetch(`/api/friends/request/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setMessage(action === 'accept' ? '✓ Friend added!' : '✗ Request rejected');
        fetchFriendRequests();
        if (action === 'accept') {
          fetchFriends();
        }
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to respond to request');
      }
    } catch (error) {
      setMessage('Error responding to request');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6 sm:p-12">
        <h1 className="text-4xl font-bold mb-10" style={{ color: 'var(--text-primary)' }}>Find Friends</h1>

        {message && (
          <div className={`mb-8 p-5 rounded-lg font-semibold transition-all`}
            style={{
              backgroundColor: message.includes('✓') ? 'var(--success)' : message.includes('✗') ? 'var(--danger)' : 'var(--accent)',
              color: '#ffffff'
            }}>
            {message}
          </div>
        )}

        {/* Friends List */}
        {friends.length > 0 && (
          <div className="rounded-lg p-10 mb-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Your Friends</h2>
            <p className="mb-10 font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>
              You have {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-4">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-5 rounded-lg transition hover:opacity-80"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-4">
                    {friend.avatar ? (
                      <img
                        src={friend.avatar}
                        alt={friend.username}
                        className="w-14 h-14 rounded-full object-cover border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: 'var(--accent)' }}>
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <button
                        onClick={() => router.push(`/profile/${friend.username}`)}
                        className="font-semibold hover:underline text-left text-lg"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {friend.nickname || friend.username}
                      </button>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{friend.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/messages`)}
                    className="px-5 py-2.5 text-white text-sm font-medium rounded-md transition hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Users */}
        <div className="rounded-lg p-10 mb-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Search Users</h2>
          <p className="mb-6 font-medium" style={{ color: 'var(--text-secondary)' }}>Find your friends by username</p>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full px-5 py-4 rounded-md text-base font-medium"
            />
            {searching && (
              <div className="absolute right-4 top-3 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Searching...
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-10 pt-8" style={{ borderTop: '1px solid var(--border-color)' }}>
              <p className="text-lg mb-7 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-5 px-5 rounded-lg mb-4 transition"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-4">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-12 h-12 rounded-full object-cover border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: 'var(--accent)' }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <button
                        onClick={() => router.push(`/profile/${user.username}`)}
                        className="font-semibold hover:underline text-left"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {user.username}
                      </button>
                      {user.nickname && (
                        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{user.nickname}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendFriendRequest(user.username)}
                    className="px-5 py-2.5 text-white text-sm font-medium rounded-md transition"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <div className="rounded-lg p-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Friend Requests</h2>
            <p className="mb-10 font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>You have {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}</p>
            <div className="space-y-5">
              {friendRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-5 rounded-lg transition"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-4">
                    {request.sender.avatar ? (
                      <img
                        src={request.sender.avatar}
                        alt={request.sender.username}
                        className="w-14 h-14 rounded-full object-cover border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: 'var(--accent)' }}>
                        {request.sender.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <button
                        onClick={() => router.push(`/profile/${request.sender.username}`)}
                        className="font-semibold hover:underline text-left"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {request.sender.nickname || request.sender.username}
                      </button>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{request.sender.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRespondToRequest(request.id, 'accept')}
                      className="px-5 py-2.5 text-white text-sm font-medium rounded-md transition"
                      style={{ backgroundColor: 'var(--success)' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespondToRequest(request.id, 'reject')}
                      className="px-5 py-2.5 text-white text-sm font-medium rounded-md transition"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {friendRequests.length === 0 && searchQuery === '' && (
          <div className="text-center py-12">
            <p className="text-2xl font-semibold" style={{ color: 'var(--text-secondary)' }}>No friend requests yet</p>
            <p className="mt-4 font-medium" style={{ color: 'var(--text-tertiary)' }}>Search for users above to send friend requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
