import React, { useEffect, useState } from 'react';
import { useFollow } from '../context/FollowContext';
import { useAuth, api } from '../context/AuthContext';
import { normalizeAssetUrl } from '../lib/utils';
import { Link } from 'react-router-dom';
import { User, Check, X, Bell, MessageSquare, Heart } from 'lucide-react';
import { PostDto, CommentDto } from '../types';

interface NotificationItem {
    id: string;
    type: 'follow_request' | 'comment' | 'like';
    date: Date;
    actor: {
        id: string;
        name: string;
        username: string;
        imageUrl: string;
    };
    content?: string;
    entityId?: string; // postId or followRequestId
    isRead?: boolean;
}

export default function Notifications() {
    const { user } = useAuth();
    const { getPendingRequests, acceptFollowRequest, rejectFollowRequest } = useFollow();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        let mounted = true;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const allNotifications: NotificationItem[] = [];

                // 1. Fetch Follow Requests
                try {
                    const requests = await getPendingRequests();
                    // Enrich requests
                    const enrichedRequests = await Promise.all(requests.map(async (req: any) => {
                        // Attempt to extract or fetch user
                        let u = req.follower || req.user;
                        if (!u && req.followerId) {
                            try {
                                const p = await api.get(`/profiles/${req.followerId}`);
                                u = p.data;
                            } catch (e) { /* ignore */ }
                        }
                        if (!u) u = { id: req.followerId, userName: 'Unknown' };

                        return {
                            id: req.followRequestId,
                            type: 'follow_request',
                            date: new Date(req.requestedAt),
                            actor: {
                                id: u.id,
                                name: u.firstName ? `${u.firstName} ${u.lastName}`.trim() : u.userName,
                                username: u.userName,
                                imageUrl: u.profileImageUrl
                            },
                            entityId: req.followRequestId
                        } as NotificationItem;
                    }));
                    allNotifications.push(...enrichedRequests);
                } catch (e) {
                    console.error("Failed to fetch follow requests", e);
                }

                // 2. Fetch My Posts (and their comments/likes)
                try {
                    // We specifically want extended profile to see MY posts
                    const profileRes = await api.get(`/profiles/${user.id}/extended`);
                    const posts: PostDto[] = profileRes.data.posts || [];

                    // Extract Comments
                    for (const post of posts) {
                        if (post.comments && Array.isArray(post.comments)) {
                            for (const comment of post.comments) {
                                // Skip my own comments
                                if (comment.userId === user.id) continue;

                                // We need actor details. CommentDto usually has basic userId.
                                // If backend returns Comment including User object, great.
                                // If not, we might need to fetch user?
                                // Let's check 'types.ts' CommentDto. it DOES NOT have User object.
                                // But `Comment` interface DOES.
                                // Let's assume the extended profile *might* populate it or we fetch?
                                // Fetching profile for every comment is heavy.
                                // OPTIMIZATION: Collect unique userIds and fetch them in batch (or individually in parallel).

                                // Actually, let's see if we can get away with just userId or if standard DTO includes it.
                                // Inspecting types.ts: UserDto is NOT in CommentDto.
                                // But backend *might* send it.
                                // Safer: Fetch user details for these comments.

                                let actorName = 'User';
                                let actorUsername = 'user';
                                let actorImage = '';

                                const c: any = comment; // cast to any to check for extra fields
                                if (c.user || c.User) {
                                    const u = c.user || c.User;
                                    actorName = u.fullName || u.firstName ? `${u.firstName} ${u.lastName}` : u.userName;
                                    actorUsername = u.userName;
                                    actorImage = u.profileImageUrl;
                                } else {
                                    // Must fetch
                                    try {
                                        const uRes = await api.get(`/profiles/${comment.userId}`);
                                        const u = uRes.data;
                                        actorName = u.fullName || `${u.firstName} ${u.lastName}`.trim();
                                        actorUsername = u.userName;
                                        actorImage = u.profileImageUrl;
                                    } catch (e) {
                                        // ignore
                                    }
                                }

                                allNotifications.push({
                                    id: comment.commentId,
                                    type: 'comment',
                                    date: new Date(comment.createdAt),
                                    actor: {
                                        id: comment.userId,
                                        name: actorName,
                                        username: actorUsername,
                                        imageUrl: actorImage
                                    },
                                    content: comment.content,
                                    entityId: post.postId
                                });
                            }
                        }
                    }

                    // Extract Likes (if available in future)
                    // Currently PostDto doesn't have likes list.
                } catch (e) {
                    console.error("Failed to fetch extended profile for notifications", e);
                }

                // Sort by date desc
                allNotifications.sort((a, b) => b.date.getTime() - a.date.getTime());

                if (mounted) {
                    setNotifications(allNotifications);
                }
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [user, getPendingRequests]);

    const handleAccept = async (notif: NotificationItem) => {
        if (notif.type !== 'follow_request') return;
        const success = await acceptFollowRequest(notif.actor.id, notif.entityId);
        if (success) {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }
    };

    const handleReject = async (notif: NotificationItem) => {
        if (notif.type !== 'follow_request') return;
        const success = await rejectFollowRequest(notif.actor.id, notif.entityId);
        if (success) {
            setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 p-4">
            <div className="flex items-center gap-3 border-b border-border pb-4">
                <Bell className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Notificări</h1>
            </div>

            <div className="space-y-4">
                {notifications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Nu ai notificări noi.</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div key={notif.id} className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                            <Link to={`/profile/${notif.actor.id}`} className="shrink-0 mt-1">
                                <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden border border-border">
                                    {notif.actor.imageUrl ? (
                                        <img src={normalizeAssetUrl(notif.actor.imageUrl)} alt={notif.actor.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center">
                                            <User className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </Link>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm">
                                        <Link to={`/profile/${notif.actor.id}`} className="font-semibold hover:underline">
                                            {notif.actor.name}
                                        </Link>
                                        {' '}
                                        {notif.type === 'follow_request' && <span className="text-muted-foreground">vrea să te urmărească.</span>}
                                        {notif.type === 'comment' && <span className="text-muted-foreground">a comentat la postarea ta:</span>}
                                        {notif.type === 'like' && <span className="text-muted-foreground">ți-a apreciat postarea.</span>}
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {notif.date.toLocaleDateString()}
                                    </span>
                                </div>

                                {notif.type === 'comment' && (
                                    <div className="mt-1 text-sm bg-secondary/30 p-2 rounded-md border border-border/50 italic text-muted-foreground line-clamp-2">
                                        "{notif.content}"
                                    </div>
                                )}

                                {notif.type === 'follow_request' && (
                                    <div className="flex items-center gap-2 mt-3">
                                        <button
                                            onClick={() => handleAccept(notif)}
                                            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-full hover:opacity-90 flex items-center gap-1"
                                        >
                                            <Check className="h-3 w-3" /> Acceptă
                                        </button>
                                        <button
                                            onClick={() => handleReject(notif)}
                                            className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-medium rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center gap-1"
                                        >
                                            <X className="h-3 w-3" /> Refuză
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Icon Indicator */}
                            <div className="shrink-0 text-muted-foreground/30">
                                {notif.type === 'comment' && <MessageSquare className="h-4 w-4" />}
                                {notif.type === 'like' && <Heart className="h-4 w-4" />}
                                {notif.type === 'follow_request' && <User className="h-4 w-4" />}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
