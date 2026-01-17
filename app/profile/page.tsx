'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  nickname: string | null;
  bio: string | null;
  avatar: string | null;
  lastUsernameChange: string | null;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    nickname: '',
    bio: '',
    newUsername: '',
  });

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchProfile();
  }, [session, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFormData({
          nickname: data.nickname || '',
          bio: data.bio || '',
          newUsername: '',
        });
      }
    } catch (error) {
      setMessage('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: formData.nickname,
          bio: formData.bio,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setMessage('✓ Profile updated successfully');
        setEditing(false);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update profile');
      }
    } catch (error) {
      setMessage('Error updating profile');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage('File size must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('avatar', file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formDataToSend,
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setMessage('✓ Profile picture updated successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to upload image');
      }
    } catch (error) {
      setMessage('Error uploading image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.newUsername.trim()) {
      setMessage('New username is required');
      return;
    }

    try {
      const res = await fetch('/api/profile/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername: formData.newUsername }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setFormData({ ...formData, newUsername: '' });
        setMessage('✓ Username changed successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to change username');
      }
    } catch (error) {
      setMessage('Error changing username');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== profile?.username) {
      setMessage('Username does not match. Please try again.');
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'DELETE',
      });

      if (res.ok) {
        // Sign out the user and redirect to login
        await signOut({ redirect: false });
        router.push('/auth/login');
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to delete account');
        setDeleting(false);
      }
    } catch (error) {
      setMessage('Error deleting account');
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}></div>
        <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
      </div>
    </div>
  );

  const canChangeUsername =
    !profile?.lastUsernameChange ||
    new Date(profile.lastUsernameChange).getTime() + 7 * 24 * 60 * 60 * 1000 <
      Date.now();

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {message && (
          <div 
            className={`mb-8 p-5 rounded-lg font-semibold transition-all`}
            style={{
              backgroundColor: message.includes('✓') ? 'var(--success)' : message.includes('Failed') || message.includes('Error') ? 'var(--danger)' : 'var(--accent)',
              color: '#ffffff',
            }}
          >
            {message}
          </div>
        )}

        {profile && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div 
              className="rounded-lg p-10"
              style={{
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                {/* Avatar Section */}
                <div className="flex-shrink-0">
                  <div className="relative group">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.username}
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4"
                        style={{ borderColor: 'var(--accent)' }}
                      />
                    ) : (
                      <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white text-5xl font-bold" style={{ backgroundColor: 'var(--accent)' }}>
                        {profile.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 text-white p-3 rounded-full cursor-pointer transition" style={{ backgroundColor: 'var(--accent)' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        className="hidden"
                      />
                      📷
                    </label>
                  </div>
                  <p className="text-xs mt-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Click to change</p>
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {profile.nickname || profile.username}
                  </h1>
                  <p className="text-lg mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>@{profile.username}</p>
                  <p className="mt-3 text-base" style={{ color: 'var(--text-secondary)' }}>{profile.bio || 'No bio yet'}</p>
                  <p className="text-sm mt-4 font-medium" style={{ color: 'var(--text-tertiary)' }}>{profile.email}</p>
                </div>

                <div className="w-full sm:w-auto">
                  {editing ? (
                    <button
                      onClick={() => setEditing(false)}
                      className="w-full px-8 py-3 text-white rounded-md transition font-medium"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditing(true)}
                      className="w-full px-8 py-3 text-white rounded-md transition font-medium"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Profile Form */}
            {editing && (
              <div className="rounded-lg p-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>Edit Profile</h2>
                <form onSubmit={handleUpdate} className="space-y-7">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Display Name
                      </label>
                      <span className="text-xs font-medium" style={{ color: formData.nickname.length > 25 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                        {formData.nickname.length}/25
                      </span>
                    </div>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) =>
                        setFormData({ ...formData, nickname: e.target.value })
                      }
                      placeholder="Your display name"
                      maxLength={25}
                      className="w-full px-5 py-3 rounded-md"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Bio
                      </label>
                      <span className="text-xs font-medium" style={{ color: formData.bio.length > 355 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                        {formData.bio.length}/355
                      </span>
                    </div>
                    <textarea
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData({ ...formData, bio: e.target.value })
                      }
                      placeholder="Tell us about yourself..."
                      maxLength={355}
                      className="w-full px-5 py-3 rounded-md"
                      rows={4}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-5 py-3 text-white rounded-md transition font-medium"
                      style={{ backgroundColor: 'var(--success)' }}
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="flex-1 px-5 py-3 text-white rounded-md transition font-medium"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Change Username */}
            <div className="rounded-lg p-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Change Username
              </h2>
              <p className="text-sm mb-8 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                You can change your username once every 7 days.
              </p>

              {!canChangeUsername && profile.lastUsernameChange && (
                <div className="mb-7 p-5 rounded-lg" style={{ backgroundColor: 'var(--warning)', color: '#000' }}>
                  <p className="font-semibold">
                    Available in {Math.ceil(
                      (new Date(profile.lastUsernameChange).getTime() +
                        7 * 24 * 60 * 60 * 1000 -
                        Date.now()) /
                        (24 * 60 * 60 * 1000)
                    )}{' '}
                    day(s)
                  </p>
                </div>
              )}

              <form onSubmit={handleUsernameChange} className="space-y-5">
                <input
                  type="text"
                  placeholder="New username"
                  value={formData.newUsername}
                  onChange={(e) =>
                    setFormData({ ...formData, newUsername: e.target.value })
                  }
                  disabled={!canChangeUsername}
                  className="w-full px-5 py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!canChangeUsername}
                  className="w-full px-5 py-3 text-white rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: canChangeUsername ? 'var(--accent)' : 'var(--text-tertiary)' }}
                >
                  {canChangeUsername ? 'Change Username' : 'Cooldown Active'}
                </button>
              </form>
            </div>

            {/* Danger Zone - Delete Account */}
            <div className="rounded-lg p-10 border-2" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--danger)' }}>
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--danger)' }}>
                Danger Zone
              </h2>
              <p className="text-sm mb-8 font-medium" style={{ color: 'var(--text-secondary)' }}>
                Once you delete your account, there is no going back. All your data, messages, and connections will be permanently deleted.
              </p>
              
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto px-8 py-3 text-white rounded-md transition font-medium"
                style={{ backgroundColor: 'var(--danger)' }}
              >
                Delete My Account
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="rounded-lg p-10 max-w-md w-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--danger)' }}>
                Delete Account
              </h2>
              <p className="text-base mb-6" style={{ color: 'var(--text-secondary)' }}>
                This action cannot be undone. This will permanently delete your account, all your messages, friendships, and remove you from all group chats.
              </p>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Please type <span className="font-mono px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>{profile?.username}</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-5 py-3 rounded-md mb-6"
                disabled={deleting}
              />
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== profile?.username}
                  className="flex-1 px-5 py-3 text-white rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--danger)' }}
                >
                  {deleting ? 'Deleting...' : 'Delete Account'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={deleting}
                  className="flex-1 px-5 py-3 text-white rounded-md transition font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--text-tertiary)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
