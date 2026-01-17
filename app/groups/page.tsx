'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GroupsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to messages page since groups are now in the sidebar
    router.push('/messages');
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#313338' }}>
      <p className="text-xl font-semibold" style={{ color: '#949ba4' }}>Redirecting...</p>
    </div>
  );
}
