'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSidebar } from '../context/SidebarContext';
import NotificationBell from './NotificationBell';

export default function MobileHeader() {
  const { data: session } = useSession();
  const { toggleSidebar } = useSidebar();

  if (!session) {
    return null;
  }

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 shadow-lg" style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between px-4 h-14">
        {/* Hamburger Menu */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>

        {/* Logo */}
        <Link 
          href="/feed" 
          className="flex items-center gap-2 group rounded-lg"
          aria-label="Fibeger - Home"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)' }} aria-hidden="true">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Fibeger</span>
        </Link>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
