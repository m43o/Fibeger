'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import PersonalityTestModal from '../components/PersonalityTestModal';
import FlagEmoji from '../components/FlagEmoji';
import personalityTestData from '../lib/personalityTest.json';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  nickname: string | null;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  lastUsernameChange: string | null;
  country: string | null;
  city: string | null;
  pronouns: string | null;
  birthday: string | null;
  website: string | null;
  socialLinks: string | null;
  status: string | null;
  themeColor: string | null;
  interests: string | null;
  personalityBadge: string | null;
  showPersonalityBadge: boolean;
  notificationSoundsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  steamUsername: string | null;
}

interface SocialLinks {
  twitter?: string;
  github?: string;
  instagram?: string;
  linkedin?: string;
  steam?: string;
}

interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isSupported: browserNotificationsSupported, permission: browserNotificationPermission, requestPermission } = useBrowserNotifications();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showPersonalityTest, setShowPersonalityTest] = useState(false);

  const [formData, setFormData] = useState({
    nickname: '',
    bio: '',
    newUsername: '',
    country: '',
    city: '',
    pronouns: '',
    birthday: '',
    website: '',
    status: '',
    themeColor: '',
    twitter: '',
    github: '',
    instagram: '',
    linkedin: '',
    interests: [] as string[],
    showPersonalityBadge: true,
    notificationSoundsEnabled: true,
    browserNotificationsEnabled: false,
    steamUsername: '',
  });
  const [newInterest, setNewInterest] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/auth/login');
      return;
    }

    if (status === "loading" || !session) {
      return;
    }

    fetchProfile();
  }, [status, session, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        
        let socialLinks: SocialLinks = {};
        if (data.socialLinks) {
          try {
            socialLinks = JSON.parse(data.socialLinks);
          } catch {}
        }
        
        let interests: string[] = [];
        if (data.interests) {
          try {
            interests = JSON.parse(data.interests);
          } catch {}
        }
        
        setFormData({
          nickname: data.nickname || '',
          bio: data.bio || '',
          newUsername: '',
          country: data.country || '',
          city: data.city || '',
          pronouns: data.pronouns || '',
          birthday: data.birthday || '',
          website: data.website || '',
          status: data.status || '',
          themeColor: data.themeColor || '#8B5CF6',
          twitter: socialLinks.twitter || '',
          github: socialLinks.github || '',
          instagram: socialLinks.instagram || '',
          linkedin: socialLinks.linkedin || '',
          interests: interests,
          showPersonalityBadge: data.showPersonalityBadge ?? true,
          notificationSoundsEnabled: data.notificationSoundsEnabled ?? true,
          browserNotificationsEnabled: data.browserNotificationsEnabled ?? false,
          steamUsername: data.steamUsername || '',
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
      const socialLinks: SocialLinks = {
        twitter: formData.twitter || undefined,
        github: formData.github || undefined,
        instagram: formData.instagram || undefined,
        linkedin: formData.linkedin || undefined,
      };
      
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: formData.nickname,
          bio: formData.bio,
          country: formData.country,
          city: formData.city,
          pronouns: formData.pronouns,
          birthday: formData.birthday,
          website: formData.website,
          status: formData.status,
          themeColor: formData.themeColor,
          socialLinks: JSON.stringify(socialLinks),
          interests: JSON.stringify(formData.interests),
          showPersonalityBadge: formData.showPersonalityBadge,
          notificationSoundsEnabled: formData.notificationSoundsEnabled,
          browserNotificationsEnabled: formData.browserNotificationsEnabled,
          steamUsername: formData.steamUsername,
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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessage('Banner size must be less than 10MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('banner', file);

      const res = await fetch('/api/profile/banner', {
        method: 'POST',
        body: formDataToSend,
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setMessage('✓ Banner updated successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to upload banner');
      }
    } catch (error) {
      setMessage('Error uploading banner');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerRemove = async () => {
    if (!confirm('Are you sure you want to remove your banner?')) return;

    try {
      const res = await fetch('/api/profile/banner', {
        method: 'DELETE',
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setMessage('✓ Banner removed successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to remove banner');
      }
    } catch (error) {
      setMessage('Error removing banner');
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

  const addInterest = () => {
    if (newInterest.trim() && formData.interests.length < 10 && !formData.interests.includes(newInterest.trim())) {
      setFormData({ ...formData, interests: [...formData.interests, newInterest.trim()] });
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) });
  };

  const handlePersonalityTestComplete = (badge: Badge) => {
    setProfile((prev) => prev ? { ...prev, personalityBadge: badge.id } : null);
    setMessage(`✓ You are ${badge.name}! Badge saved to your profile.`);
    setTimeout(() => setMessage(''), 5000);
  };

  const getUserBadge = () => {
    if (!profile?.personalityBadge) return null;
    return personalityTestData.badges.find((b) => b.id === profile.personalityBadge);
  };


  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'PL', name: 'Poland' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'AR', name: 'Argentina' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'CN', name: 'China' },
    { code: 'IN', name: 'India' },
    { code: 'RU', name: 'Russia' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'IE', name: 'Ireland' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'PT', name: 'Portugal' },
    { code: 'GR', name: 'Greece' },
    { code: 'TR', name: 'Turkey' },
    { code: 'SG', name: 'Singapore' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'TH', name: 'Thailand' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'PH', name: 'Philippines' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'EG', name: 'Egypt' },
  ];

  if (status === "loading" || loading) return (
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
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              {/* Banner Image */}
              <div className="relative w-full h-48 sm:h-64" style={{ backgroundColor: profile.banner ? 'transparent' : 'var(--bg-primary)' }}>
                {profile.banner ? (
                  <>
                    <img 
                      src={profile.banner}
                      alt="Profile banner"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <label className="px-4 py-2 text-white rounded-md cursor-pointer transition font-medium" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          disabled={uploadingAvatar}
                          className="hidden"
                        />
                        Change Banner
                      </label>
                      <button
                        onClick={handleBannerRemove}
                        className="px-4 py-2 text-white rounded-md transition font-medium"
                        style={{ backgroundColor: 'rgba(220,38,38,0.8)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <label className="w-full h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={uploadingAvatar}
                      className="hidden"
                    />
                    <div className="text-center">
                      <div className="text-4xl mb-2">🖼️</div>
                      <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Click to add a banner
                      </p>
                    </div>
                  </label>
                )}
              </div>
              
              <div className="p-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                  {/* Avatar Section */}
                  <div className="flex-shrink-0" style={{ marginTop: profile.banner ? '-5rem' : '0' }}>
                    <div className="relative group">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile.username}
                          className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4"
                          style={{ borderColor: profile.themeColor || 'var(--accent)', backgroundColor: 'var(--bg-secondary)' }}
                        />
                      ) : (
                        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white text-5xl font-bold border-4" style={{ backgroundColor: profile.themeColor || 'var(--accent)', borderColor: 'var(--bg-secondary)' }}>
                          {profile.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 text-white p-3 rounded-full cursor-pointer transition" style={{ backgroundColor: profile.themeColor || 'var(--accent)' }}>
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
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {profile.nickname || profile.username}
                      </h1>
                      {profile.country && (
                        <FlagEmoji 
                          countryCode={profile.country}
                          className="text-3xl"
                          title={countries.find(c => c.code === profile.country)?.name}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
                        @{profile.username}
                      </p>
                      {profile.pronouns && (
                        <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                          {profile.pronouns}
                        </span>
                      )}
                    </div>
                    
                    {profile.status && (
                      <p className="mt-2 text-base font-medium italic" style={{ color: profile.themeColor || 'var(--accent)' }}>
                        "{profile.status}"
                      </p>
                    )}
                    
                    <p className="mt-3 text-base" style={{ color: 'var(--text-secondary)' }}>
                      {profile.bio || 'No bio yet'}
                    </p>
                    
                    {/* Location and Birthday */}
                    <div className="flex items-center gap-4 mt-4 flex-wrap text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {profile.city && (
                        <div className="flex items-center gap-1">
                          <span>📍</span>
                          <span>{profile.city}</span>
                        </div>
                      )}
                      {profile.birthday && (
                        <div className="flex items-center gap-1">
                          <span>🎂</span>
                          <span>{profile.birthday}</span>
                        </div>
                      )}
                      {profile.website && (
                        <a 
                          href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                          style={{ color: profile.themeColor || 'var(--accent)' }}
                        >
                          <span>🔗</span>
                          <span>{profile.website}</span>
                        </a>
                      )}
                    </div>

                    {/* Social Links */}
                    {(profile.socialLinks || profile.steamUsername) && (() => {
                      try {
                        const links = JSON.parse(profile.socialLinks || '{}') as SocialLinks;
                        const hasLinks = Object.values(links).some(v => v) || profile.steamUsername;
                        if (hasLinks) {
                          return (
                            <div className="flex items-center gap-4 mt-4">
                              {links.twitter && (
                                <a href={`https://twitter.com/${links.twitter}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition" title="Twitter/X">
                                  𝕏
                                </a>
                              )}
                              {links.github && (
                                <a href={`https://github.com/${links.github}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition" title="GitHub">
                                  🐙
                                </a>
                              )}
                              {links.instagram && (
                                <a href={`https://instagram.com/${links.instagram}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition" title="Instagram">
                                  📷
                                </a>
                              )}
                              {links.linkedin && (
                                <a href={`https://linkedin.com/in/${links.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition" title="LinkedIn">
                                  💼
                                </a>
                              )}
                              {profile.steamUsername && (
                                <a href={`https://steamcommunity.com/id/${profile.steamUsername}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition" title="Steam">
                                  🎮
                                </a>
                              )}
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}

                    {/* Interests */}
                    {profile.interests && (() => {
                      try {
                        const interests = JSON.parse(profile.interests) as string[];
                        if (interests.length > 0) {
                          return (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {interests.map((interest, idx) => (
                                <span 
                                  key={idx}
                                  className="px-3 py-1 rounded-full text-sm font-medium"
                                  style={{ backgroundColor: profile.themeColor || 'var(--accent)', color: '#fff' }}
                                >
                                  {interest}
                                </span>
                              ))}
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}

                    {/* Personality Badge */}
                    {(() => {
                      const badge = getUserBadge();
                      if (badge && profile.showPersonalityBadge) {
                        return (
                          <div 
                            className="mt-4 px-4 py-3 rounded-lg inline-flex items-center gap-3"
                            style={{ 
                              backgroundColor: `${badge.color}20`,
                              border: `2px solid ${badge.color}`
                            }}
                          >
                            <span className="text-3xl">{badge.emoji}</span>
                            <div>
                              <p className="font-bold text-sm" style={{ color: badge.color }}>
                                {badge.name}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {badge.description}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <p className="text-sm mt-4 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {profile.email}
                    </p>
                  </div>

                  <div className="w-full sm:w-auto flex flex-col gap-3">
                    {editing ? (
                      <button
                        onClick={() => setEditing(false)}
                        className="w-full px-8 py-3 text-white rounded-md transition font-medium"
                        style={{ backgroundColor: 'var(--danger)' }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditing(true)}
                          className="w-full px-8 py-3 text-white rounded-md transition font-medium"
                          style={{ backgroundColor: profile.themeColor || 'var(--accent)' }}
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={() => setShowPersonalityTest(true)}
                          className="w-full px-8 py-3 text-white rounded-md transition font-medium"
                          style={{ backgroundColor: profile.personalityBadge ? 'var(--text-tertiary)' : profile.themeColor || 'var(--accent)' }}
                        >
                          {profile.personalityBadge ? '🔄 Retake Test' : '✨ Take PEAS Test'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Form */}
            {editing && (
              <div className="rounded-lg p-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>Edit Profile</h2>
                <form onSubmit={handleUpdate} className="space-y-8">
                  
                  {/* Basic Information */}
                  <div className="space-y-5">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Basic Information</h3>
                    
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

                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                          Status Message
                        </label>
                        <span className="text-xs font-medium" style={{ color: formData.status.length > 100 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                          {formData.status.length}/100
                        </span>
                      </div>
                      <input
                        type="text"
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        placeholder="What's on your mind?"
                        maxLength={100}
                        className="w-full px-5 py-3 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Pronouns
                      </label>
                      <input
                        type="text"
                        value={formData.pronouns}
                        onChange={(e) =>
                          setFormData({ ...formData, pronouns: e.target.value })
                        }
                        placeholder="e.g., he/him, she/her, they/them"
                        maxLength={50}
                        className="w-full px-5 py-3 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-5 pt-6 border-t" style={{ borderColor: 'var(--bg-primary)' }}>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Location</h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Country
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                        className="w-full px-5 py-3 rounded-md"
                        style={{ fontSize: '16px' }}
                      >
                        <option value="">Select a country</option>
                        {countries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                      {formData.country && (
                        <div className="mt-2 flex items-center gap-2 text-base" style={{ color: 'var(--text-secondary)' }}>
                          <FlagEmoji 
                            countryCode={formData.country}
                            className="text-3xl"
                          />
                          <span>Selected: {countries.find(c => c.code === formData.country)?.name}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        City
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        placeholder="Your city"
                        maxLength={100}
                        className="w-full px-5 py-3 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Birthday (MM-DD)
                      </label>
                      <input
                        type="text"
                        value={formData.birthday}
                        onChange={(e) =>
                          setFormData({ ...formData, birthday: e.target.value })
                        }
                        placeholder="e.g., 05-15"
                        maxLength={5}
                        pattern="\d{2}-\d{2}"
                        className="w-full px-5 py-3 rounded-md"
                      />
                      <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                        Format: MM-DD (Year not required for privacy)
                      </p>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="space-y-5 pt-6 border-t" style={{ borderColor: 'var(--bg-primary)' }}>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Links & Socials</h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Website
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) =>
                          setFormData({ ...formData, website: e.target.value })
                        }
                        placeholder="https://yourwebsite.com"
                        maxLength={200}
                        className="w-full px-5 py-3 rounded-md"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                          𝕏 / Twitter Username
                        </label>
                        <input
                          type="text"
                          value={formData.twitter}
                          onChange={(e) =>
                            setFormData({ ...formData, twitter: e.target.value })
                          }
                          placeholder="username"
                          className="w-full px-5 py-3 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                          🐙 GitHub Username
                        </label>
                        <input
                          type="text"
                          value={formData.github}
                          onChange={(e) =>
                            setFormData({ ...formData, github: e.target.value })
                          }
                          placeholder="username"
                          className="w-full px-5 py-3 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                          📷 Instagram Username
                        </label>
                        <input
                          type="text"
                          value={formData.instagram}
                          onChange={(e) =>
                            setFormData({ ...formData, instagram: e.target.value })
                          }
                          placeholder="username"
                          className="w-full px-5 py-3 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                          💼 LinkedIn Username
                        </label>
                        <input
                          type="text"
                          value={formData.linkedin}
                          onChange={(e) =>
                            setFormData({ ...formData, linkedin: e.target.value })
                          }
                          placeholder="username"
                          className="w-full px-5 py-3 rounded-md"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                          🎮 Steam Username
                        </label>
                        <input
                          type="text"
                          value={formData.steamUsername}
                          onChange={(e) =>
                            setFormData({ ...formData, steamUsername: e.target.value })
                          }
                          placeholder="username"
                          maxLength={100}
                          className="w-full px-5 py-3 rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customization */}
                  <div className="space-y-5 pt-6 border-t" style={{ borderColor: 'var(--bg-primary)' }}>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Customization</h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Theme Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={formData.themeColor}
                          onChange={(e) =>
                            setFormData({ ...formData, themeColor: e.target.value })
                          }
                          className="h-12 w-20 rounded-md cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.themeColor}
                          onChange={(e) =>
                            setFormData({ ...formData, themeColor: e.target.value })
                          }
                          placeholder="#8B5CF6"
                          className="flex-1 px-5 py-3 rounded-md"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Interests & Hobbies (max 10)
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addInterest();
                            }
                          }}
                          placeholder="Add an interest..."
                          maxLength={20}
                          className="flex-1 px-5 py-3 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={addInterest}
                          disabled={formData.interests.length >= 10}
                          className="px-6 py-3 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: formData.themeColor }}
                        >
                          Add
                        </button>
                      </div>
                      {formData.interests.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {formData.interests.map((interest, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                              style={{ backgroundColor: formData.themeColor, color: '#fff' }}
                            >
                              {interest}
                              <button
                                type="button"
                                onClick={() => removeInterest(interest)}
                                className="hover:opacity-70"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Privacy & Preferences */}
                  <div className="space-y-5 pt-6 border-t" style={{ borderColor: 'var(--bg-primary)' }}>
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Privacy & Preferences</h3>
                    
                    <div className="flex items-center justify-between p-5 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <div className="flex-1">
                        <label className="block text-base font-medium mb-1 cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                          🔔 Notification Sounds
                        </label>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          Play a sound when you receive new messages or notifications
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, notificationSoundsEnabled: !formData.notificationSoundsEnabled })}
                        className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ 
                          backgroundColor: formData.notificationSoundsEnabled ? formData.themeColor : 'var(--text-tertiary)'
                        }}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            formData.notificationSoundsEnabled ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <div className="flex-1">
                        <label className="block text-base font-medium mb-1 cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                          🖥️ Browser Notifications
                        </label>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          {browserNotificationsSupported 
                            ? 'Show native notifications even when the tab is not focused' 
                            : 'Not supported in your browser'}
                        </p>
                        {browserNotificationsSupported && browserNotificationPermission === 'denied' && (
                          <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--danger)' }}>
                            Permission denied. Please enable in your browser settings.
                          </p>
                        )}
                        {browserNotificationsSupported && browserNotificationPermission === 'default' && formData.browserNotificationsEnabled && (
                          <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--warning)' }}>
                            Click the toggle to request browser permission.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!browserNotificationsSupported) return;
                          
                          const newValue = !formData.browserNotificationsEnabled;
                          
                          // If enabling and we don't have permission, request it
                          if (newValue && browserNotificationPermission !== 'granted') {
                            const result = await requestPermission();
                            if (result !== 'granted') {
                              return; // Don't enable if permission denied
                            }
                          }
                          
                          setFormData({ ...formData, browserNotificationsEnabled: newValue });
                        }}
                        disabled={!browserNotificationsSupported || browserNotificationPermission === 'denied'}
                        className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ 
                          backgroundColor: (formData.browserNotificationsEnabled && browserNotificationsSupported) ? formData.themeColor : 'var(--text-tertiary)'
                        }}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            formData.browserNotificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <div className="flex-1">
                        <label className="block text-base font-medium mb-1 cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                          🏆 Show Personality Badge
                        </label>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                          Display your personality quiz badge on your profile
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, showPersonalityBadge: !formData.showPersonalityBadge })}
                        className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ 
                          backgroundColor: formData.showPersonalityBadge ? formData.themeColor : 'var(--text-tertiary)'
                        }}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            formData.showPersonalityBadge ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
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

        {/* Personality Test Modal */}
        <PersonalityTestModal
          isOpen={showPersonalityTest}
          onClose={() => setShowPersonalityTest(false)}
          onComplete={handlePersonalityTestComplete}
          themeColor={profile?.themeColor || '#8B5CF6'}
        />
      </div>
    </div>
  );
}
