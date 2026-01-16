'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/app/context/ThemeContext';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  if (!session) {
    return null;
  }

  const isActive = (href: string) => pathname === href;

  const navItems = [
    { href: '/feed', label: 'Home', icon: '🏠' },
    { href: '/messages', label: 'Messages', icon: '💬' },
    { href: '/friends', label: 'Friends', icon: '👥' },
    { href: '/groups', label: 'Groups', icon: '👨‍💼' },
  ];

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-64 flex flex-col border-r"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
      }}
      aria-label="Sidebar navigation"
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <Link 
          href="/feed" 
          className="flex items-center gap-3 rounded-lg focus:outline-2 focus:outline-offset-2 transition-all"
          style={{ 
            outline: '2px solid transparent',
            outlineColor: 'var(--accent)',
          }}
          aria-label="Fibeger - Home"
        >
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--text-primary)' }}
          >
            F
          </div>
          <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Fibeger</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4" aria-label="Main navigation">
        <div className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all focus:outline-2 focus:outline-offset-2"
              style={{
                backgroundColor: isActive(item.href) ? 'var(--focus-color)' : 'transparent',
                color: isActive(item.href) ? 'var(--text-primary)' : 'var(--text-secondary)',
                outlineColor: 'var(--accent)',
              }}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Divider */}
      <div 
        className="mx-4 h-px"
        style={{ backgroundColor: 'var(--border-color)' }}
      />

      {/* Settings */}
      <div className="p-4 space-y-3">
        {/* Theme Toggle */}
        <div 
          className="flex items-center justify-between p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-tertiary)' }}
        >
          <label 
            htmlFor="theme-toggle"
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {theme === 'dark' ? '🌙' : '☀️'} Theme
          </label>
          <button
            id="theme-toggle"
            onClick={toggleTheme}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-2 focus:outline-offset-2"
            style={{
              backgroundColor: theme === 'dark' ? 'var(--accent)' : 'var(--hover-bg)',
              outlineColor: 'var(--accent)',
            }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                theme === 'light' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Profile Button */}
        <Link
          href="/profile"
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left focus:outline-2 focus:outline-offset-2"
          style={{
            backgroundColor: isActive('/profile') ? 'var(--focus-color)' : 'var(--hover-bg)',
            color: 'var(--text-secondary)',
            outlineColor: 'var(--accent)',
          }}
          aria-current={isActive('/profile') ? 'page' : undefined}
        >
          <span aria-hidden="true">👤</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {(session.user as any)?.username || session.user?.email}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Profile</div>
          </div>
        </Link>
      </div>

      {/* Sign Out Button */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={() => signOut()}
          className="w-full px-4 py-3 rounded-lg font-medium transition-all focus:outline-2 focus:outline-offset-2 text-sm"
          style={{
            backgroundColor: 'var(--hover-bg)',
            color: 'var(--text-secondary)',
            outlineColor: 'var(--accent)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--focus-color)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          aria-label="Sign out of your account"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
