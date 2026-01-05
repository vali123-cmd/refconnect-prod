import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';
import { useNotification, NotificationItem } from '../context/NotificationContext';
import { normalizeAssetUrl } from '../lib/utils';
import { Link } from 'react-router-dom';
import { User, Check, X, Bell, MessageSquare, Heart } from 'lucide-react';

export default function Notifications() {
    const { user } = useAuth();
    const { acceptFollowRequest, rejectFollowRequest } = useFollow();
    const { notifications, isLoading, markAsViewed, refreshNotifications } = useNotification();

    useEffect(() => {
        markAsViewed();
        // optionally refresh on mount to get latest
        refreshNotifications();
    }, []);

    const handleAccept = async (notif: NotificationItem) => {
        if (notif.type !== 'follow_request') return;
        const success = await acceptFollowRequest(notif.actor.id, notif.entityId);
        if (success) {
            refreshNotifications();
        }
    };

    const handleReject = async (notif: NotificationItem) => {
        if (notif.type !== 'follow_request') return;
        const success = await rejectFollowRequest(notif.actor.id, notif.entityId);
        if (success) {
            refreshNotifications();
        }
    };

    if (isLoading && notifications.length === 0) {
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
