import React, { useState } from 'react';
import { User, Check, X, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeAssetUrl, cn } from '../lib/utils';
import { useFollow } from '../context/FollowContext';

interface UserListModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    users: any[];
    type: 'followers' | 'following' | 'requests';
    isLoading: boolean;
}

export default function UserListModal({ isOpen, onClose, title, users, type, isLoading }: UserListModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{title}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Loading users...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No users found.</p>
                        </div>
                    ) : (
                        users.map((item, index) => {
                            // Extract user object. Backend might return different structures.
                            // For 'followers': item.follower (the user following me)
                            // For 'following': item.following (the user I am following)
                            // For 'requests': item.followerRequest (the user requesting)
                            // Or sometimes just the User object if flattened.

                            const userObj =
                                (type === 'followers' ? item.follower : null) ||
                                (type === 'following' ? item.following : null) ||
                                (type === 'requests' ? item.followerRequest : null) ||
                                item;

                            // Safety check
                            if (!userObj) return null;

                            const displayName = userObj.fullName || (userObj.firstName ? `${userObj.firstName} ${userObj.lastName}` : userObj.userName);
                            const username = userObj.userName;
                            const imageUrl = userObj.profileImageUrl;
                            const userId = userObj.id;

                            return (
                                <div key={userId || index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Link to={`/profile/${userId}`} onClick={onClose} className="shrink-0">
                                            <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden">
                                                {imageUrl ? (
                                                    <img src={normalizeAssetUrl(imageUrl)} alt={displayName} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center">
                                                        <User className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                        <div className="min-w-0">
                                            <Link to={`/profile/${userId}`} onClick={onClose} className="font-medium hover:underline truncate block">
                                                {displayName}
                                            </Link>
                                            <div className="text-xs text-muted-foreground truncate">@{username}</div>
                                        </div>
                                    </div>

                                    {/* Action buttons could go here if needed (e.g. remove follower) */}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
