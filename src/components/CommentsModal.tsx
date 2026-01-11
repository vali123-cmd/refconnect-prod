import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePost } from '../context/PostContext';
import { useAuth, api } from '../context/AuthContext';
import { useAIModeration } from '../hooks/useAIModeration';

interface Props {
    open: boolean;
    onClose: () => void;
    postId: string;
    initialComments?: any[];
}

export default function CommentsModal({ open, onClose, postId, initialComments }: Props) {
    const { addComment, deleteComment } = usePost();
    const { user } = useAuth();
    const { checkContent } = useAIModeration();
    const [comments, setComments] = useState<any[]>(initialComments || []);
    const [loading, setLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const profileCacheRef = React.useRef<Record<string, any>>({});
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editingText, setEditingText] = React.useState<string>('');


    const updateCommentOnServer = async (commentId: string, content: string) => {
        try {
            const base = api.defaults.baseURL || '';
            const fullUrl = base.endsWith('/') ? `${base}comments/${commentId}` : `${base}/comments/${commentId}`;
            console.debug('Updating comment', commentId, 'to', fullUrl, 'payload=', { content });
            const resp = await api.put(fullUrl, { content });
            return resp?.data;
        } catch (err: any) {
            console.error('Failed to update comment (detailed)', err);

            if (err.response) {
                console.error('Response status', err.response.status, 'data', err.response.data);
                window.alert(`Update failed: ${err.response.status} ${JSON.stringify(err.response.data)}`);
            } else if (err.request) {
                console.error('No response received, request=', err.request);
                window.alert('Network Error: no response received. Check server availability and CORS settings.');
            } else {
                console.error('Error setting up request', err.message);
                window.alert('Error: ' + (err.message || 'Unknown'));
            }
            throw err;
        }
    };

    useEffect(() => {
        setComments(initialComments || []);
        if (initialComments && initialComments.length > 0) {
            // enrich comments with profile info
            enrichCommentsWithProfiles(initialComments).catch(err => console.debug('enrich initial comments failed', err));
        }
    }, [initialComments]);

    useEffect(() => {
        if (!open) return;
        let mounted = true;
        const fetchComments = async () => {
            setLoading(true);
            try {
                if (!initialComments) {

                    const resp = await api.get(`/posts/${postId}/comments`);
                    if (!mounted) return;
                    const data = resp?.data || [];
                    setComments(data);
                    await enrichCommentsWithProfiles(data);
                }
            } catch (err) {
                console.error('Failed to fetch comments', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchComments();
        return () => { mounted = false; };
    }, [open, postId, initialComments]);

    async function enrichCommentsWithProfiles(list: any[]) {
        if (!list || list.length === 0) return;
        const ids = Array.from(new Set(list.map(c => c.userId).filter(Boolean)));
        const toFetch = ids.filter(id => !profileCacheRef.current[id]);
        if (toFetch.length > 0) {
            try {
                const results = await Promise.all(toFetch.map(async (id) => {
                    try {
                        const r = await api.get(`/profiles/${id}`);
                        return [id, r.data];
                    } catch (e: any) {
                        return [id, null];
                    }
                }));
                for (const [id, data] of results) {
                    profileCacheRef.current[id] = data || null;
                }
            } catch (e) {
                console.debug('Failed to batch fetch profiles', e);
            }
        }
        // apply cached profiles to current comments
        setComments(prev => prev.map(c => {
            const prof = profileCacheRef.current[c.userId];
            if (prof) {
                return { ...c, user: prof, userName: prof.userName || `${prof.firstName || ''} ${prof.lastName || ''}`.trim() };
            }
            return c;
        }));
    }

    const handleAdd = async () => {
        if (!newComment.trim()) return;

        // AI moderation check
        const moderationResult = await checkContent(newComment.trim());
        if (!moderationResult.safe) {
            alert(moderationResult.reason || "Comment has been flagged as inappropriate.");
            return;
        }

        try {
            const added = await addComment(postId, newComment.trim());
            if (added) {
                // Ensure the newly added comment has a readable user/name for immediate display
                let enriched = { ...added } as any;
                // If backend returned user info, prefer it. Otherwise try to fetch profile for the userId
                if (!enriched.user) {
                    try {
                        const r = await api.get(`/profiles/${enriched.userId}`);
                        enriched.user = r?.data || null;
                        enriched.userName = enriched.user?.userName || enriched.userName;
                    } catch (e) {
                        // fallback to auth user info
                        if (user) {
                            enriched.user = { firstName: user.name || '', lastName: '' };
                            enriched.userName = user.name || enriched.userName;
                        }
                    }
                }
                if (!enriched.createdAt) enriched.createdAt = new Date().toISOString();
                setComments(prev => [enriched, ...prev]);
                setNewComment('');
            }
        } catch (err) {
            console.error('Add comment failed', err);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await deleteComment(commentId);
            setComments(prev => prev.filter(c => c.commentId !== commentId));
        } catch (err) {
            console.error('Delete comment failed', err);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg w-full max-w-2xl mx-4 shadow-lg">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-lg font-semibold">Comments</h3>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                    {loading ? (
                        <div className="text-center text-sm text-muted-foreground">Loading comments...</div>
                    ) : comments.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No comments yet.</div>
                    ) : (
                        comments.map(c => (
                            <div key={c.commentId} className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
                                    {c.user?.firstName ? c.user.firstName.charAt(0) : (c.userName ? c.userName.charAt(0) : c.userId?.charAt(0) || '?')}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium">{c.user?.firstName ? `${c.user.firstName} ${c.user.lastName || ''}`.trim() : c.userName || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                                        {editingId === c.commentId ? (
                                            <div className="space-y-2">
                                                <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={3} className="block w-full rounded-md border border-input px-3 py-2 text-foreground sm:text-sm" />
                                                <div className="flex gap-2">
                                                    <button onClick={async () => {
                                                        // AI moderation check
                                                        const moderationResult = await checkContent(editingText.trim());
                                                        if (!moderationResult.safe) {
                                                            alert(moderationResult.reason || "Comment has been flagged as inappropriate.");
                                                            return;
                                                        }

                                                        try {
                                                            const updated = await updateCommentOnServer(c.commentId, editingText);
                                                            const newContent = (updated && (updated.content || updated.body || updated.text)) ? (updated.content || updated.body || updated.text) : editingText;
                                                            setComments(prev => prev.map(cm => cm.commentId === c.commentId ? { ...cm, content: newContent } : cm));
                                                            setEditingId(null);
                                                            setEditingText('');
                                                        } catch (err) {
                                                            console.error('Failed to update comment', err);
                                                            // updateCommentOnServer already alerted the user
                                                        }
                                                    }} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">Save</button>
                                                    <button onClick={() => { setEditingId(null); setEditingText(''); }} className="px-2 py-1 rounded border text-xs">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            c.content
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        {(user?.id === c.userId || user?.role?.toLowerCase() === 'admin') && (
                                            <>
                                                <button onClick={() => { setEditingId(c.commentId); setEditingText(c.content || ''); }} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                                                <button onClick={() => handleDelete(c.commentId)} className="text-xs text-red-500">Delete</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border">
                    <div className="flex gap-2">
                        <input value={newComment} onChange={(e) => setNewComment(e.target.value)} className="flex-1 rounded-md border border-input px-3 py-2 text-sm text-black" placeholder="Write a comment..." />
                        <button onClick={handleAdd} className="px-3 py-2 bg-primary text-primary-foreground rounded-md">Send</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
