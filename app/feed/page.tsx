"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const MAX_CAPTION_LENGTH = 140;

interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface FeedPost {
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

export default function FeedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [feedType, setFeedType] = useState<'friends' | 'public'>('friends');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchPosts();
    }
  }, [session, feedType]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/feed?type=${feedType}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image or video file (JPEG, PNG, GIF, WebP, MP4, WebM)');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      alert(`Caption must be ${MAX_CAPTION_LENGTH} characters or less`);
      return;
    }

    setUploading(true);
    try {
      // First, upload the file
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', 'feed'); // Upload to feed folder

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const { url } = await uploadRes.json();

      // Determine media type
      let mediaType = 'image';
      if (selectedFile.type.startsWith('video/')) {
        mediaType = 'video';
      } else if (selectedFile.type === 'image/gif') {
        mediaType = 'gif';
      }

      // Create the feed post
      const postRes = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          mediaUrl: url,
          mediaType,
          isPublic,
        }),
      });

      if (!postRes.ok) {
        throw new Error('Failed to create post');
      }

      // Reset form and close modal
      setCaption('');
      setSelectedFile(null);
      setMediaPreview(null);
      setIsPublic(false);
      setShowUploadModal(false);
      
      // Refresh posts
      await fetchPosts();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (postId: number) => {
    try {
      const res = await fetch(`/api/feed/${postId}/like`, {
        method: 'POST',
      });

      if (res.ok) {
        // Optimistically update the UI
        setPosts(posts.map(post => {
          if (post.id === postId) {
            const currentUserId = parseInt((session?.user as any)?.id || '0');
            const isLiked = post.likes.some(like => like.userId === currentUserId);
            
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter(like => like.userId !== currentUserId)
                : [...post.likes, { userId: currentUserId }],
              _count: {
                likes: isLiked ? post._count.likes - 1 : post._count.likes + 1,
              },
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPosts(posts.filter(post => post.id !== postId));
      } else {
        alert('Failed to delete post');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    }
  };

  const isLikedByCurrentUser = (post: FeedPost) => {
    const currentUserId = parseInt((session?.user as any)?.id || '0');
    return post.likes.some(like => like.userId === currentUserId);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading feed...</p>
        </div>
      </div>
    );
  }

  const currentUserId = parseInt((session?.user as any)?.id || '0');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#313338' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ backgroundColor: '#2b2d31', borderBottom: '1px solid #1e1f22' }}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold" style={{ color: '#f2f3f5' }}>Feed</h1>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-2 rounded-md font-semibold transition hover:brightness-90"
              style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
            >
              + Upload
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFeedType('friends')}
              className="px-6 py-2 rounded-md font-semibold transition"
              style={{
                backgroundColor: feedType === 'friends' ? '#5865f2' : '#383a40',
                color: feedType === 'friends' ? '#ffffff' : '#949ba4',
              }}
            >
              Friends
            </button>
            <button
              onClick={() => setFeedType('public')}
              className="px-6 py-2 rounded-md font-semibold transition"
              style={{
                backgroundColor: feedType === 'public' ? '#5865f2' : '#383a40',
                color: feedType === 'public' ? '#ffffff' : '#949ba4',
              }}
            >
              Public
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📷</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#f2f3f5' }}>No posts yet</h2>
            <p className="mb-6" style={{ color: '#949ba4' }}>Be the first to share something!</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-8 py-3 rounded-md font-semibold transition hover:brightness-90"
              style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
            >
              Upload Your First Post
            </button>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-lg overflow-hidden transition hover:brightness-90 mb-4 break-inside-avoid"
                style={{ backgroundColor: '#2b2d31' }}
              >
                {/* Media */}
                <div 
                  className="relative bg-black cursor-pointer"
                  onClick={() => setSelectedPost(post)}
                >
                  {post.mediaType === 'video' ? (
                    <video
                      src={post.mediaUrl}
                      className="w-full object-contain"
                      controls
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={post.caption || 'Post'}
                      className="w-full object-contain"
                    />
                  )}
                </div>

                {/* Post Info */}
                <div className="p-4">
                  {/* User Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <Link href={`/profile/${post.user.username}`}>
                      {post.user.avatar ? (
                        <img
                          src={post.user.avatar}
                          alt={post.user.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                          style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
                        >
                          {post.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <Link href={`/profile/${post.user.username}`} className="flex-1">
                      <p className="text-sm font-semibold hover:underline" style={{ color: '#f2f3f5' }}>
                        {post.user.nickname || post.user.username}
                      </p>
                      <p className="text-xs" style={{ color: '#949ba4' }}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </Link>
                    {post.userId === currentUserId && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-1 rounded hover:bg-red-500/20 transition"
                        title="Delete post"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#f23f42">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p className="text-sm mb-3" style={{ color: '#dbdee1' }}>
                      {post.caption}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-2 transition hover:brightness-125"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill={isLikedByCurrentUser(post) ? '#f23f42' : 'none'}
                        stroke={isLikedByCurrentUser(post) ? '#f23f42' : '#949ba4'}
                        strokeWidth="2"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isLikedByCurrentUser(post) ? '#f23f42' : '#949ba4' }}
                      >
                        {post._count.likes}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post View Modal */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="relative w-full max-w-6xl max-h-[90vh] overflow-auto rounded-lg"
            style={{ backgroundColor: '#2b2d31' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute top-4 left-4 z-20 p-2 rounded-full transition hover:bg-gray-700"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
              title="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="flex flex-col lg:flex-row">
              {/* Image Section */}
              <div className="flex-1 bg-black flex items-center justify-center p-4">
                {selectedPost.mediaType === 'video' ? (
                  <video
                    src={selectedPost.mediaUrl}
                    className="max-w-full max-h-[80vh] object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedPost.mediaUrl}
                    alt={selectedPost.caption || 'Post'}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                )}
              </div>

              {/* Info Section */}
              <div className="lg:w-96 p-6 flex flex-col">
                {/* User Info and Delete Button */}
                <div className="flex items-center gap-3 mb-6 pb-6" style={{ borderBottom: '1px solid #404249' }}>
                  <Link href={`/profile/${selectedPost.user.username}`} onClick={() => setSelectedPost(null)}>
                    {selectedPost.user.avatar ? (
                      <img
                        src={selectedPost.user.avatar}
                        alt={selectedPost.user.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold"
                        style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
                      >
                        {selectedPost.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link 
                      href={`/profile/${selectedPost.user.username}`} 
                      onClick={() => setSelectedPost(null)}
                      className="block"
                    >
                      <p className="font-semibold hover:underline truncate" style={{ color: '#f2f3f5' }}>
                        {selectedPost.user.nickname || selectedPost.user.username}
                      </p>
                      <p className="text-sm truncate" style={{ color: '#949ba4' }}>
                        @{selectedPost.user.username}
                      </p>
                    </Link>
                  </div>
                  {selectedPost.userId === currentUserId && (
                    <button
                      onClick={() => {
                        setSelectedPost(null);
                        handleDelete(selectedPost.id);
                      }}
                      className="p-2 rounded hover:bg-red-500/20 transition flex-shrink-0"
                      title="Delete post"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="#f23f42">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Caption */}
                {selectedPost.caption && (
                  <div className="mb-6">
                    <p style={{ color: '#dbdee1' }}>
                      {selectedPost.caption}
                    </p>
                  </div>
                )}

                {/* Date */}
                <p className="text-sm mb-6" style={{ color: '#949ba4' }}>
                  {new Date(selectedPost.createdAt).toLocaleString()}
                </p>

                {/* Actions */}
                <div className="mt-auto pt-6" style={{ borderTop: '1px solid #404249' }}>
                  <button
                    onClick={() => handleLike(selectedPost.id)}
                    className="flex items-center gap-3 transition hover:brightness-125 w-full"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill={isLikedByCurrentUser(selectedPost) ? '#f23f42' : 'none'}
                      stroke={isLikedByCurrentUser(selectedPost) ? '#f23f42' : '#949ba4'}
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span
                      className="text-lg font-semibold"
                      style={{ color: isLikedByCurrentUser(selectedPost) ? '#f23f42' : '#949ba4' }}
                    >
                      {selectedPost._count.likes} {selectedPost._count.likes === 1 ? 'like' : 'likes'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
          onClick={() => !uploading && setShowUploadModal(false)}
        >
          <div
            className="rounded-lg p-6 w-full max-w-lg"
            style={{ backgroundColor: '#2b2d31' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: '#f2f3f5' }}>
                Upload to Feed
              </h2>
              <button
                onClick={() => !uploading && setShowUploadModal(false)}
                className="p-1 rounded hover:bg-gray-700 transition"
                disabled={uploading}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#949ba4" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* File Input */}
            <div className="mb-4">
              <label
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:brightness-90 transition"
                style={{ borderColor: '#404249', backgroundColor: '#383a40' }}
              >
                {mediaPreview ? (
                  <div className="relative w-full h-full">
                    {selectedFile?.type.startsWith('video/') ? (
                      <video src={mediaPreview} className="w-full h-full object-contain" />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="w-full h-full object-contain" />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#949ba4" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p className="mt-2 text-sm" style={{ color: '#949ba4' }}>
                      Click to upload photo or video
                    </p>
                    <p className="text-xs" style={{ color: '#6d6f78' }}>
                      PNG, JPG, GIF, WebP, MP4, WebM (max 50MB)
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* Caption Input */}
            <div className="mb-4">
              <textarea
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CAPTION_LENGTH) {
                    setCaption(e.target.value);
                  }
                }}
                className="w-full px-4 py-3 rounded-md resize-none"
                style={{
                  backgroundColor: '#383a40',
                  color: '#f2f3f5',
                  border: 'none',
                  outline: 'none',
                }}
                rows={3}
                disabled={uploading}
                maxLength={MAX_CAPTION_LENGTH}
              />
              <div className="mt-2 text-sm text-right" style={{ 
                color: caption.length > MAX_CAPTION_LENGTH * 0.9 ? '#f23f42' : '#949ba4' 
              }}>
                {caption.length} / {MAX_CAPTION_LENGTH}
              </div>
            </div>

            {/* Public/Private Toggle */}
            <div className="mb-6 flex items-center gap-3 p-3 rounded-md" style={{ backgroundColor: '#383a40' }}>
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={uploading}
                  className="w-5 h-5 rounded cursor-pointer"
                  style={{ accentColor: '#5865f2' }}
                />
                <div>
                  <p className="font-semibold" style={{ color: '#f2f3f5' }}>
                    Make this post public
                  </p>
                  <p className="text-sm" style={{ color: '#949ba4' }}>
                    {isPublic ? 'Everyone can see this post' : 'Only your friends can see this post'}
                  </p>
                </div>
              </label>
              <div className="text-2xl">
                {isPublic ? '🌍' : '👥'}
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full py-3 rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-90"
              style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
            >
              {uploading ? 'Uploading...' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
