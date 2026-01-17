'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import personalityTestData from '@/app/lib/personalityTest.json';

interface UserProfile {
  id: number;
  username: string;
  nickname: string | null;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  createdAt: string;
  isFriend: boolean;
  isOwnProfile: boolean;
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
}

interface SocialLinks {
  twitter?: string;
  github?: string;
  instagram?: string;
  linkedin?: string;
}

interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export default function UserProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const username = params?.username as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const getCountryFlag = (countryCode: string | null) => {
    if (!countryCode) return '';
    // Ensure we have a valid 2-letter country code
    const code = countryCode.toUpperCase().trim();
    if (code.length !== 2) return countryCode; // Return original if invalid
    
    try {
      // Convert country code to flag emoji
      // A = 65, Regional Indicator A = 127462, offset = 127397
      const codePoints = code
        .split('')
        .map(char => {
          const charCode = char.charCodeAt(0);
          // Validate it's A-Z
          if (charCode < 65 || charCode > 90) return null;
          return 127397 + charCode;
        })
        .filter(cp => cp !== null) as number[];
      
      if (codePoints.length !== 2) return countryCode;
      return String.fromCodePoint(...codePoints);
    } catch (error) {
      console.error('Error converting country code to flag:', error);
      return countryCode; // Fallback to showing the code
    }
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

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    if (username) {
      fetchProfile();
    }
  }, [session, username, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${username}`);
      if (res.ok) {
        const data = await res.json();
        
        // If it's the user's own profile, redirect to the main profile page
        if (data.isOwnProfile) {
          router.push('/profile');
          return;
        }
        
        setProfile(data);
      } else if (res.status === 404) {
        setMessage('User not found');
      } else {
        setMessage('Failed to load profile');
      }
    } catch (error) {
      setMessage('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!profile) return;

    try {
      // Get or create conversation with this friend
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: profile.id }),
      });

      if (res.ok) {
        const conversation = await res.json();
        // Navigate to the DM
        router.push(`/messages?dm=${conversation.id}`);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to open conversation');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Error opening conversation');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div 
            className="inline-block animate-spin rounded-full h-12 w-12 border-4" 
            style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}
          ></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  if (message && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-6 px-6 py-3 text-white rounded-md transition font-medium"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {message && (
          <div 
            className={`mb-8 p-5 rounded-lg font-semibold transition-all`}
            style={{
              backgroundColor: message.includes('✓') ? 'var(--success)' : 'var(--accent)',
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
              {profile.banner ? (
                <div className="relative w-full h-48 sm:h-64">
                  <img 
                    src={profile.banner}
                    alt="Profile banner"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-32 sm:h-48" style={{ backgroundColor: 'var(--bg-primary)' }}></div>
              )}
              
              <div className="p-6 sm:p-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                  {/* Avatar Section */}
                  <div className="flex-shrink-0" style={{ marginTop: '-5rem' }}>
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile.username}
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4"
                        style={{ borderColor: profile.themeColor || 'var(--accent)', backgroundColor: 'var(--bg-secondary)' }}
                      />
                    ) : (
                      <div 
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white text-5xl font-bold border-4" 
                        style={{ backgroundColor: profile.themeColor || 'var(--accent)', borderColor: 'var(--bg-secondary)' }}
                      >
                        {profile.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {profile.nickname || profile.username}
                      </h1>
                      {profile.country && (
                        <span className="text-3xl" title={countries.find(c => c.code === profile.country)?.name}>
                          {getCountryFlag(profile.country)}
                        </span>
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
                      {profile.isFriend && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: 'var(--success)', color: 'white' }}>
                          ✓ Friends
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
                    
                    {/* Location, Birthday, and Website */}
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
                      <div className="flex items-center gap-1">
                        <span>📅</span>
                        <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Social Links */}
                    {profile.socialLinks && (() => {
                      try {
                        const links = JSON.parse(profile.socialLinks) as SocialLinks;
                        const hasLinks = Object.values(links).some(v => v);
                        if (hasLinks) {
                          return (
                            <div className="flex items-center gap-4 mt-4">
                              {links.twitter && (
                                <a href={`https://twitter.com/${links.twitter}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition">
                                  𝕏
                                </a>
                              )}
                              {links.github && (
                                <a href={`https://github.com/${links.github}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition">
                                  🐙
                                </a>
                              )}
                              {links.instagram && (
                                <a href={`https://instagram.com/${links.instagram}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition">
                                  📷
                                </a>
                              )}
                              {links.linkedin && (
                                <a href={`https://linkedin.com/in/${links.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition">
                                  💼
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
                      if (badge) {
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
                  </div>

                  {/* Action Buttons */}
                  {profile.isFriend && (
                    <div className="flex flex-col gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleSendMessage}
                        className="w-full px-8 py-3 text-white rounded-md transition font-medium"
                        style={{ backgroundColor: profile.themeColor || 'var(--accent)' }}
                      >
                        Send Message
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Info */}
            {!profile.isFriend && (
              <div 
                className="rounded-lg p-6 sm:p-10 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Add {profile.nickname || profile.username} as a friend to interact with them!
                </p>
                <button
                  onClick={() => router.push('/friends')}
                  className="mt-6 px-8 py-3 text-white rounded-md transition font-medium"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Go to Friends
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
