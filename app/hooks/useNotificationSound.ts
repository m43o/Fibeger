'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook for playing notification sounds
 * 
 * Manages audio playback with proper cleanup and error handling.
 * Falls back to Web Audio API beep if notification file is not available.
 * Respects user's notification sound preference from their profile settings.
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const useWebAudioFallback = useRef(false);
  const [notificationSoundsEnabled, setNotificationSoundsEnabled] = useState(true);
  const { data: session } = useSession();

  // Fetch user's notification sound preference
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchPreference = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setNotificationSoundsEnabled(data.notificationSoundsEnabled ?? true);
        }
      } catch (error) {
        console.error('Failed to fetch notification preference:', error);
      }
    };

    fetchPreference();
  }, [session?.user?.id]);

  // Initialize audio on mount
  useEffect(() => {
    // Try to create audio element first
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5; // Set to 50% volume by default
    
    // Check if the file exists
    audioRef.current.addEventListener('error', () => {
      console.log('Notification sound file not found, using Web Audio API fallback');
      useWebAudioFallback.current = true;
    });
    
    // Preload the audio
    audioRef.current.load();

    return () => {
      // Cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  /**
   * Play a simple beep using Web Audio API
   */
  const playWebAudioBeep = useCallback(() => {
    try {
      // Create AudioContext if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      
      // Create oscillator for the beep sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Configure the beep
      oscillator.frequency.value = 800; // 800 Hz tone
      oscillator.type = 'sine';
      
      // Envelope: fade in and out
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Fade in
      gainNode.gain.linearRampToValueAtTime(0, now + 0.15); // Fade out
      
      // Play the beep
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } catch (error) {
      console.error('Error playing Web Audio beep:', error);
    }
  }, []);

  /**
   * Play the notification sound
   */
  const playSound = useCallback(() => {
    // Don't play if user has disabled notification sounds
    if (!notificationSoundsEnabled) {
      return;
    }

    // Use Web Audio API fallback if file didn't load
    if (useWebAudioFallback.current) {
      playWebAudioBeep();
      return;
    }

    if (!audioRef.current) return;

    try {
      // Reset audio to start if it's already playing
      audioRef.current.currentTime = 0;
      
      // Play the sound
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Auto-play was prevented or other error, try Web Audio fallback
          console.warn('Notification sound could not be played, trying fallback:', error);
          playWebAudioBeep();
        });
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
      playWebAudioBeep();
    }
  }, [playWebAudioBeep, notificationSoundsEnabled]);

  /**
   * Set the volume (0.0 to 1.0)
   * Note: Only works for audio file, not Web Audio API fallback
   */
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  return {
    playSound,
    setVolume,
  };
}
