import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth, api } from './AuthContext';
import { useFollow } from './FollowContext';

export interface NotificationItem {
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

interface NotificationContextType {
    notifications: NotificationItem[];
    unreadCount: number;
    isLoading: boolean;
    markAsViewed: () => void;
    refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const { getPendingRequests } = useFollow();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const refreshNotifications = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const allNotifications: NotificationItem[] = [];

            // 1. Fetch Follow Requests
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

            // 2. Fetch Followers
            try {
                const followersRes = await api.get(`/Follows/${user.id}/followers`);
                const followersData = followersRes.data;

                if (Array.isArray(followersData)) {
                    for (const f of followersData) {
                        // Fallback to epoch if missing to prevent "always new" issue
                        const followedAt = f.followedAt ? new Date(f.followedAt) : new Date(0);
                        let u = f.follower || f;
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
                    let likesList = post.likes;
                    if (!likesList || !Array.isArray(likesList) || likesList.length === 0) {
                        try {
                            const likesRes = await api.get(`/Like/post/${post.postId}`);
                            likesList = likesRes.data;
                        } catch (e) { }
                    }

                    if (likesList && Array.isArray(likesList)) {
                        for (const like of likesList) {
                            if (like.userId === user.id) continue;
                            let actorName = 'User';
                            let actorUsername = 'user';
                            let actorImage = '';
                            const l: any = like;
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

            allNotifications.sort((a, b) => b.date.getTime() - a.date.getTime());
            setNotifications(allNotifications);

            // Calculate unread count based on total - seen
            const seenCountStr = localStorage.getItem('notificationsSeenCount');
            const seenCount = seenCountStr ? parseInt(seenCountStr, 10) : 0;
            // Ensure we don't show negative if localStorage has more than current fetch
            setUnreadCount(Math.max(0, allNotifications.length - seenCount));

        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            refreshNotifications();
            // Optional: Set up polling here if we want real-time-ish updates without socket
            const interval = setInterval(refreshNotifications, 60000); // Poll every minute
            return () => clearInterval(interval);
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user, getPendingRequests]); // Re-fetch if user changes

    const markAsViewed = () => {
        const total = notifications.length;
        localStorage.setItem('notificationsSeenCount', total.toString());
        setUnreadCount(0);
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, isLoading, markAsViewed, refreshNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
