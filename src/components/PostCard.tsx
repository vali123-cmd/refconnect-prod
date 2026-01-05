import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Heart, MessageCircle, Share2, Trash2, Image, Video, X } from 'lucide-react';
import CommentsModal from './CommentsModal';
import { Link } from 'react-router-dom';
import { Post } from '../types';
import { usePost } from '../context/PostContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../context/AuthContext';
import { UpdatePostDto } from '../types';
import { normalizeAssetUrl } from '../lib/utils';
import { useAIModeration } from '../hooks/useAIModeration';

interface PostProps {
    post: Post;
    initialIsLiked?: boolean;
    initialLikesCount?: number;
}

export default function PostCard({ post, initialIsLiked, initialLikesCount }: PostProps) {
    const { user } = useAuth();
    const { likePost, unlikePost, deletePost, fetchPosts, isPostLiked } = usePost();
    const { checkContent } = useAIModeration();


    const isLikedByMe = post.likes?.some(l => l.userId === user?.id) || false;

    const [isLiked, setIsLiked] = useState<boolean>(typeof initialIsLiked === 'boolean' ? initialIsLiked : isLikedByMe);
    const [likesCount, setLikesCount] = useState<number>(typeof initialLikesCount === 'number' ? initialLikesCount : (post.likeCount ?? post.likes?.length ?? 0));

    const handleLike = async () => {
        if (isLiked) {
            // Optimistically update UI
            setLikesCount(prev => Math.max(0, prev - 1));
            setIsLiked(false);
            const ok = await unlikePost(post.postId);
            if (!ok) {
                // revert optimistic update
                setLikesCount(prev => prev + 1);
                setIsLiked(true);
                console.error(`Failed to unlike post ${post.postId}. See previous logs for details.`);
            }
        } else {
            setLikesCount(prev => prev + 1);
            setIsLiked(true);
            const ok = await likePost(post.postId);
            if (!ok) {
                setLikesCount(prev => Math.max(0, prev - 1));
                setIsLiked(false);
                console.error(`Failed to like post ${post.postId}. See previous logs for details.`);
            }
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            await deletePost(post.postId);
        }
    };

    const [showComments, setShowComments] = useState(false);

    const formattedDate = new Date(post.createdAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Local author state: prefer embedded post.user but fall back to calling api/profiles/{id}
    const [author, setAuthor] = useState<any | null>(post.user || null);
    const authorName = author ? ((author.firstName && author.lastName) ? `${author.firstName} ${author.lastName}` : (author.userName || 'Unknown User')) : 'Unknown User';

    const isAuthor = user?.id === post.userId;
    const canEdit = isAuthor || user?.role === 'admin';

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<UpdatePostDto>({
        description: post.description || '',
        mediaUrl: post.mediaUrl || '',
        mediaType: post.mediaType || 'text'
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const fetchAuthor = async () => {
            if (post.user) return; // already have embedded author
            if (!post.userId) return;
            try {
                const resp = await api.get(`/profiles/${post.userId}`);
                if (!mounted) return;
                setAuthor(resp.data);
            } catch (err) {
                // ignore - we'll show fallback Unknown
                console.debug('Failed to fetch author profile', err);
            }
        };
        fetchAuthor();

        const checkLiked = async () => {
            if (!post.postId) return;
            try {
                const liked = await isPostLiked(post.postId);
                if (!mounted) return;
                setIsLiked(liked);
            } catch (err) {

            }
        };
        checkLiked();
        return () => { mounted = false; };
    }, [post.user, post.userId, post.postId, isPostLiked]);

    return (
        <div className="bg-card border border-border rounded-lg p-4 mb-4 text-sm">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <Link to={`/profile/${post.userId}`} className="h-10 w-10 rounded-full bg-secondary overflow-hidden">
                        {post.user?.profileImageUrl ? (
                            <img src={normalizeAssetUrl(post.user.profileImageUrl)} alt={authorName} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                {authorName.charAt(0)}
                            </div>
                        )}
                    </Link>
                    <div>
                        <Link to={`/profile/${post.userId}`} className="font-semibold hover:underline block">
                            {authorName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formattedDate}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {(isAuthor || user?.role === 'admin') && (
                        <button onClick={handleDelete} className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                    {canEdit && (
                        <button onClick={() => { setIsEditing(prev => !prev); setEditData({ description: post.description || '', mediaUrl: post.mediaUrl || '', mediaType: post.mediaType || 'text' }); }} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                            Edit
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <p className="mb-3 whitespace-pre-wrap">{post.description}</p>

            {isEditing && (
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSaving(true);
                    try {
                        // AI moderation check
                        const moderationResult = await checkContent(editData.description);
                        if (!moderationResult.safe) {
                            alert(moderationResult.reason || "Content has been flagged as inappropriate.");
                            setIsSaving(false);
                            return;
                        }

                        let finalEditData = { ...editData };

                        // If user selected a new media file, upload to S3 first
                        if (selectedMediaFile) {
                            // Check file size (30MB limit)
                            const maxSize = 30 * 1024 * 1024; // 30MB in bytes
                            if (selectedMediaFile.size > maxSize) {
                                alert(`File size (${(selectedMediaFile.size / 1024 / 1024).toFixed(2)}MB) exceeds the 30MB limit. Please choose a smaller file.`);
                                setIsSaving(false);
                                return;
                            }

                            setIsUploading(true);
                            const fd = new FormData();
                            fd.append('file', selectedMediaFile);
                            const upResp = await api.post('/Files/upload', fd, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            const returned = upResp?.data;
                            const s3Url = returned?.Url || returned?.url;
                            console.log('Files/upload returned S3 URL:', s3Url);

                            finalEditData.mediaUrl = s3Url;
                            finalEditData.mediaType = selectedMediaFile.type.startsWith('image/') ? 'image' : 'video';
                            setIsUploading(false);
                        }

                        await api.put(`/posts/${post.postId}`, finalEditData);
                        setIsEditing(false);
                        setSelectedMediaFile(null);
                        setMediaPreviewUrl(null);
                        try { await fetchPosts(); } catch { }
                    } catch (err: any) {
                        console.error('Failed to update post', err);
                        console.error('Error details:', {
                            message: err.message,
                            response: err.response?.data,
                            status: err.response?.status,
                            statusText: err.response?.statusText
                        });
                        setIsUploading(false);
                    } finally {
                        setIsSaving(false);
                    }
                }} className="space-y-3 mb-3">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                        <textarea value={editData.description} onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))} rows={3} className="block w-full rounded-md border border-input px-3 py-2 text-foreground sm:text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Upload New Media</label>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                id={`edit-image-${post.postId}`}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setSelectedMediaFile(file);
                                        setMediaPreviewUrl(URL.createObjectURL(file));
                                    }
                                }}
                            />
                            <label htmlFor={`edit-image-${post.postId}`} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-input text-sm cursor-pointer hover:bg-secondary">
                                <Image className="h-4 w-4" />
                                Image
                            </label>

                            <input
                                type="file"
                                accept="video/*"
                                id={`edit-video-${post.postId}`}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setSelectedMediaFile(file);
                                        setMediaPreviewUrl(URL.createObjectURL(file));
                                    }
                                }}
                            />
                            <label htmlFor={`edit-video-${post.postId}`} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-input text-sm cursor-pointer hover:bg-secondary">
                                <Video className="h-4 w-4" />
                                Video
                            </label>
                        </div>
                    </div>

                    {/* Preview selected media */}
                    {mediaPreviewUrl && selectedMediaFile && (
                        <div className="relative rounded-lg overflow-hidden border border-border">
                            {selectedMediaFile.type.startsWith('image/') ? (
                                <img src={mediaPreviewUrl} alt="Preview" className="w-full h-auto" />
                            ) : (
                                <video src={mediaPreviewUrl} controls className="w-full h-auto" />
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMediaFile(null);
                                    setMediaPreviewUrl(null);
                                }}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Show current media if no new file selected */}
                    {!mediaPreviewUrl && editData.mediaUrl && (
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Current Media</label>
                            {editData.mediaType === 'image' ? (
                                <img src={normalizeAssetUrl(editData.mediaUrl)} alt="Current" className="w-full h-auto rounded-lg border border-border" />
                            ) : editData.mediaType === 'video' ? (
                                <video src={normalizeAssetUrl(editData.mediaUrl)} controls className="w-full h-auto rounded-lg border border-border" />
                            ) : (
                                <p className="text-sm text-muted-foreground">No media</p>
                            )}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button type="button" disabled={isRefining} onClick={async () => {
                            if (!editData.description.trim()) return;
                            setIsRefining(true);
                            try {
                                // Send raw JSON string body (curl example uses a raw string payload). Use absolute URL so it hits the AI service directly.
                                const resp = await api.post('/AI/refine-post-text', editData.description);
                                const refined = resp?.data?.refinedText ?? resp?.data?.text ?? resp?.data;
                                if (typeof refined === 'string' && refined.trim()) setEditData(prev => ({ ...prev, description: refined.trim() }));
                            } catch (err) {
                                console.error('AI refine failed', err);
                            } finally {
                                setIsRefining(false);
                            }
                        }} className="px-3 py-1 rounded border text-sm">{isRefining ? 'AI…' : 'Refine'}</button>
                        <button type="submit" disabled={isSaving || isUploading} className="px-3 py-1 rounded bg-foreground text-background text-sm">
                            {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1 rounded border text-sm">Cancel</button>
                    </div>
                </form>
            )}

            {post.mediaUrl && post.mediaType === 'image' && (
                <div className="mb-3 rounded-lg overflow-hidden border border-border">
                    <img src={normalizeAssetUrl(post.mediaUrl)} alt="Post content" className="w-full h-auto" />
                </div>
            )}
            {post.mediaUrl && post.mediaType === 'video' && (
                <div className="mb-3 rounded-lg overflow-hidden border border-border">
                    <video src={post.mediaUrl} controls className="w-full h-auto" />
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-6 pt-3 border-t border-border mt-3">
                <button
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                    {likesCount}
                </button>
                <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="h-4 w-4" />
                    {post.comments?.length || 0}
                </button>
                <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto">
                    <Share2 className="h-4 w-4" />
                </button>
            </div>
            <CommentsModal open={showComments} onClose={() => setShowComments(false)} postId={post.postId} initialComments={post.comments} />
        </div>
    );
}
