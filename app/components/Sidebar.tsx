'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!session) {
    return null;
  }

  const isActive = (href: string) => pathname === href;

  const navItems = [
    { href: '/friends', label: 'Friends', icon: '👥' },
  ];

  const handleStartConversation = () => {
    router.push('/messages');
  };

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

        {/* Direct Messages Label */}
        <div className="mt-4 mb-2 px-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#949ba4' }}>
              Direct Messages
            </span>
            <button 
              onClick={handleStartConversation}
              className="text-lg hover:text-white transition" 
              style={{ color: '#949ba4' }}
              title="Start a conversation"
            >
              +
            </button>
          </div>
        </div>
      </nav>

      {/* Profile Section */}
      <div className="mt-auto" style={{ 
        backgroundColor: '#232428',
        padding: '10px 8px',
      }}>
        <div className="flex items-center gap-2 px-2">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
          >
            {((session.user as any)?.username?.[0] || session.user?.email?.[0] || 'U').toUpperCase()}
          </div>
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
