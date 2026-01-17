'use client';

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/feed');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background - More vibrant and colorful */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90 animate-gradient" />
        <div className="absolute inset-0 bg-gradient-to-tl from-cyan-500 via-blue-600 to-violet-600 opacity-70 animate-gradient-reverse" />
        <div className="absolute inset-0 backdrop-blur-3xl" />
      </div>

      {/* Floating Orbs - More vibrant colors */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
      <div className="absolute top-40 right-20 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-amber-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000" />

      {/* Content */}
      <main className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full px-6 text-center">
        <div className="space-y-8 backdrop-blur-md bg-white/15 rounded-3xl p-12 shadow-2xl border border-white/30">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 to-pink-400 backdrop-blur-md shadow-lg mb-4">
            <span className="text-5xl font-bold text-white drop-shadow-lg">F</span>
          </div>

          <h1 className="text-7xl font-extrabold text-white leading-tight tracking-tight drop-shadow-2xl">
            Fibeger
          </h1>

          <p className="text-2xl text-white font-medium max-w-lg mx-auto drop-shadow-lg">
            Connect, chat, and share moments with friends
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Link
              href="/auth/signup"
              className="group relative px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full font-bold text-lg transition-all hover:scale-110 hover:shadow-2xl hover:from-yellow-300 hover:to-orange-400 shadow-xl"
            >
              Get Started
              <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-30 transition-opacity" />
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-4 bg-white/20 backdrop-blur-md text-white border-2 border-white/50 rounded-full font-bold text-lg transition-all hover:bg-white/30 hover:scale-110 shadow-xl hover:shadow-2xl"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes gradient-reverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 50px) scale(0.9); }
          66% { transform: translate(20px, -20px) scale(1.1); }
        }
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-gradient {
          animation: gradient 15s ease infinite;
        }
        .animate-gradient-reverse {
          animation: gradient-reverse 15s ease infinite;
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
