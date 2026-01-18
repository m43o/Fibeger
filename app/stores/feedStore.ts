import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

export interface FeedPost {
  id: number;
  userId: number;
  caption: string | null;
  mediaUrl: string;
  mediaType: string;
  isPublic: boolean;
  createdAt: string;
  user: User;
  likes: { userId: number }[];
  _count: {
    likes: number;
  };
}

interface FeedState {
  posts: FeedPost[];
  feedType: 'friends' | 'public';
  isLoading: boolean;
  lastFetch: Map<string, number>; // Key: feedType

  // Actions
  setPosts: (posts: FeedPost[]) => void;
  addPost: (post: FeedPost) => void;
  updatePost: (postId: number, updates: Partial<FeedPost>) => void;
  removePost: (postId: number) => void;
  toggleLike: (postId: number, userId: number) => void;
  
  setFeedType: (feedType: 'friends' | 'public') => void;
  setLoading: (isLoading: boolean) => void;

  // API Actions
  fetchPosts: (feedType?: 'friends' | 'public') => Promise<void>;
  createPost: (caption: string, mediaUrl: string, mediaType: string, isPublic: boolean) => Promise<{ success: boolean; error?: string }>;
  likePost: (postId: number) => Promise<{ success: boolean; error?: string }>;
  deletePost: (postId: number) => Promise<{ success: boolean; error?: string }>;
}

export const useFeedStore = create<FeedState>()(
  devtools(
    (set, get) => ({
      posts: [],
      feedType: 'friends',
      isLoading: false,
      lastFetch: new Map(),

      setPosts: (posts) => {
        const { feedType } = get();
        const lastFetch = new Map(get().lastFetch);
        lastFetch.set(feedType, Date.now());
        set({ posts, lastFetch });
      },

      addPost: (post) => set((state) => ({
        posts: [post, ...state.posts]
      })),

      updatePost: (postId, updates) => set((state) => ({
        posts: state.posts.map(post => 
          post.id === postId ? { ...post, ...updates } : post
        )
      })),

      removePost: (postId) => set((state) => ({
        posts: state.posts.filter(post => post.id !== postId)
      })),

      toggleLike: (postId, userId) => set((state) => ({
        posts: state.posts.map(post => {
          if (post.id === postId) {
            const isLiked = post.likes.some(like => like.userId === userId);
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter(like => like.userId !== userId)
                : [...post.likes, { userId }],
              _count: {
                likes: isLiked ? post._count.likes - 1 : post._count.likes + 1,
              },
            };
          }
          return post;
        })
      })),

      setFeedType: (feedType) => set({ feedType }),

      setLoading: (isLoading) => set({ isLoading }),

      // API Actions
      fetchPosts: async (feedType) => {
        const currentFeedType = feedType || get().feedType;
        const { lastFetch } = get();
        
        // Cache for 30 seconds
        const lastFetchTime = lastFetch.get(currentFeedType);
        if (lastFetchTime && Date.now() - lastFetchTime < 30000) {
          return;
        }

        set({ isLoading: true });
        try {
          const res = await fetch(`/api/feed?type=${currentFeedType}`);
          if (res.ok) {
            const data = await res.json();
            set({ posts: data });
            const newLastFetch = new Map(lastFetch);
            newLastFetch.set(currentFeedType, Date.now());
            set({ lastFetch: newLastFetch });
          }
        } catch (error) {
          console.error('Failed to fetch posts:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      createPost: async (caption, mediaUrl, mediaType, isPublic) => {
        try {
          const res = await fetch('/api/feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ caption, mediaUrl, mediaType, isPublic }),
          });

          if (res.ok) {
            const post = await res.json();
            get().addPost(post);
            return { success: true };
          } else {
            return { success: false, error: 'Failed to create post' };
          }
        } catch (error) {
          return { success: false, error: 'Failed to create post' };
        }
      },

      likePost: async (postId) => {
        try {
          const res = await fetch(`/api/feed/${postId}/like`, {
            method: 'POST',
          });

          if (res.ok) {
            return { success: true };
          } else {
            return { success: false, error: 'Failed to like post' };
          }
        } catch (error) {
          return { success: false, error: 'Failed to like post' };
        }
      },

      deletePost: async (postId) => {
        try {
          const res = await fetch(`/api/feed/${postId}`, {
            method: 'DELETE',
          });

          if (res.ok) {
            get().removePost(postId);
            return { success: true };
          } else {
            return { success: false, error: 'Failed to delete post' };
          }
        } catch (error) {
          return { success: false, error: 'Failed to delete post' };
        }
      },
    }),
    { name: 'FeedStore' }
  )
);
