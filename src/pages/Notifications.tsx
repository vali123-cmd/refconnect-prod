import React, { useEffect, useState } from 'react';
import { useFollow } from '../context/FollowContext';
import { useAuth, api } from '../context/AuthContext';
import { normalizeAssetUrl } from '../lib/utils';
import { Link } from 'react-router-dom';
import { User, Check, X, Bell, MessageSquare, Heart } from 'lucide-react';
import { PostDto, CommentDto } from '../types';

interface NotificationItem {
    id: string;
    type: 'follow_request' | 'comment' | 'like' | 'new_follower';
    date: Date;
    actor: {
        id: string;
        name: string;
        username: string;
        imageUrl: string;
    };
    content?: string;
    entityId?: string; // postId or followRequestId
    postContext?: {
        postId: string;
        mediaUrl?: string;
        mediaType?: string;
        text?: string;
    };
    isRead?: boolean;
}

export default function Notifications() {
    const { user } = useAuth();
    const { getPendingRequests, getFollowers, acceptFollowRequest, rejectFollowRequest } = useFollow();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        let mounted = true;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const allNotifications: NotificationItem[] = [];

                // 1. Fetch Follow Requests (Private profiles)
                try {
                    const requests = await getPendingRequests();
                    const enrichedRequests = await Promise.all(requests.map(async (req: any) => {
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

                // 2. Fetch Followers (Public profiles / Accepted requests) -> "New Follower"
                try {
                    // Try to get followers (this might return a list of profiles or Follow objects)
                    // Assuming getFollowers returns UserDto[] or similar
                    // We need 'followedAt' to make it a meaningful notification, but getFollowers might just return users.
                    // If it just returns users, we can't really date it, but we can show it at least.
                    // Let's check api.get('/follows/followers/{id}') typically returns dates in DTO?
                    // The types.ts FollowDto has followedAt.

                    // Direct API call to ensure we get metadata like followedAt if possible
                    const followersRes = await api.get(`/Follows/${user.id}/followers`);
                    const followersData = followersRes.data; // Expecting FollowDto[] or UserDto[]

                    if (Array.isArray(followersData)) {
                        for (const f of followersData) {
                            // If f is UserDto, we don't have date. If f is FollowDto, we do.
                            // Let's assume best effort.
                            const followedAt = f.followedAt ? new Date(f.followedAt) : new Date(); // Fallback to now if missing

                            // For a clearer notification, might filter very old ones? 
                            // But for now show all to ensure user sees them as requested.

                            let u = f.follower || f;
                            // If we have to fetch user details
                            if (!u.userName && f.followerId) {
                                try {
                                    const p = await api.get(`/profiles/${f.followerId}`);
                                    u = p.data;
                                } catch { }
                            }

                            if (u) {
                                allNotifications.push({
                                    id: `new_follower_${u.id}`,
                                    type: 'new_follower',
                                    date: followedAt,
                                    actor: {
                                        id: u.id,
                                        name: u.firstName ? `${u.firstName} ${u.lastName}`.trim() : u.userName,
                                        username: u.userName,
                                        imageUrl: u.profileImageUrl
                                    },
                                    entityId: u.id
                                });
                            }
                        }
                    }

                } catch (e) {
                    console.error("Failed to fetch followers", e);
                }

                // 3. Fetch My Posts (Comments & Likes)
                try {
                    const profileRes = await api.get(`/profiles/${user.id}/extended`);
                    const posts: any[] = profileRes.data.posts || [];

                    for (const post of posts) {
                        const postCtx = {
                            postId: post.postId,
                            mediaUrl: post.mediaUrl,
                            mediaType: post.mediaType,
                            text: post.description
                        };

                        // COMMENTS
                        if (post.comments && Array.isArray(post.comments)) {
                            for (const comment of post.comments) {
                                if (comment.userId === user.id) continue;

                                let actorName = 'User';
                                let actorUsername = 'user';
                                let actorImage = '';

                                const c: any = comment;
                                if (c.user || c.User) {
                                    const u = c.user || c.User;
                                    actorName = u.fullName || u.firstName ? `${u.firstName} ${u.lastName}` : u.userName;
                                    actorUsername = u.userName;
                                    actorImage = u.profileImageUrl;
                                } else {
                                    try {
                                        const uRes = await api.get(`/profiles/${comment.userId}`);
                                        const u = uRes.data;
                                        actorName = u.fullName || `${u.firstName} ${u.lastName}`.trim();
                                        actorUsername = u.userName;
                                        actorImage = u.profileImageUrl;
                                    } catch (e) { }
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
                                    entityId: post.postId,
                                    postContext: postCtx
                                });
                            }
                        }

                        // LIKES
                        // If post.likes is missing or we want to be sure, we can try to fetch.
                        // But let's check if the array exists first.
                        let likesList = post.likes;

                        if (!likesList || !Array.isArray(likesList) || likesList.length === 0) {
                            // Attempt explicit fetch
                            try {
                                // "Guess" endpoint: /likes/post/{postId} or /posts/{postId}/likes
                                // Base on 'types.ts' LikeDto etc.
                                // Common pattern might be: GET /Like/post/{postId}
                                const likesRes = await api.get(`/Like/post/${post.postId}`);
                                likesList = likesRes.data;
                            } catch (e) {
                                // ignore
                            }
                        }

                        if (likesList && Array.isArray(likesList)) {
                            for (const like of likesList) {
                                if (like.userId === user.id) continue;

                                let actorName = 'User';
                                let actorUsername = 'user';
                                let actorImage = '';

                                const l: any = like;
                                // If endpoint returned just LikeDto { userId, postId, likedAt }, we need to fetch user
                                if (l.user || l.User) {
                                    const u = l.user || l.User;
                                    actorName = u.fullName || u.firstName ? `${u.firstName} ${u.lastName}` : u.userName;
                                    actorUsername = u.userName;
                                    actorImage = u.profileImageUrl;
                                } else {
                                    try {
                                        const uRes = await api.get(`/profiles/${like.userId}`);
                                        const u = uRes.data;
                                        actorName = u.fullName || `${u.firstName} ${u.lastName}`.trim();
                                        actorUsername = u.userName;
                                        actorImage = u.profileImageUrl;
                                    } catch (e) { }
                                }

                                allNotifications.push({
                                    id: `${post.postId}_like_${like.userId}`,
                                    type: 'like',
                                    date: new Date(like.likedAt),
                                    actor: {
                                        id: like.userId,
                                        name: actorName,
                                        username: actorUsername,
                                        imageUrl: actorImage
                                    },
                                    entityId: post.postId,
                                    postContext: postCtx
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch extended profile/posts for notifications", e);
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
                                        {notif.type === 'new_follower' && <span className="text-muted-foreground">a început să te urmărească.</span>}
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

                            {/* Post Preview */}
                            {notif.postContext && (
                                <Link to={`/post/${notif.postContext.postId}`} className="shrink-0 ml-3">
                                    <div className="h-12 w-12 rounded bg-secondary overflow-hidden border border-border">
                                        {notif.postContext.mediaUrl ? (
                                            notif.postContext.mediaType === 'video' ? (
                                                <div className="h-full w-full flex items-center justify-center bg-black">
                                                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                                                </div>
                                            ) : (
                                                <img src={normalizeAssetUrl(notif.postContext.mediaUrl)} alt="Post" className="h-full w-full object-cover" />
                                            )
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center p-1 text-[10px] text-muted-foreground bg-muted">
                                                <span className="line-clamp-2 leading-tight">
                                                    {notif.postContext.text || 'Post'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            )}

                            {/* Icon Indicator */}
                            <div className="shrink-0 text-muted-foreground/30 flex items-center">
                                {notif.type === 'comment' && <MessageSquare className="h-4 w-4" />}
                                {notif.type === 'like' && <Heart className="h-4 w-4" />}
                                {(notif.type === 'follow_request' || notif.type === 'new_follower') && <User className="h-4 w-4" />}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
