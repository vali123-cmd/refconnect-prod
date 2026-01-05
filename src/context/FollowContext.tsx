import React, { createContext, useContext, ReactNode } from 'react';
import { api, useAuth } from './AuthContext';
import { Follow, FollowRequestDto, FollowDto, ApplicationUser, ProfileDto } from '../types';

interface FollowContextType {
    followUser: (userId: string) => Promise<boolean>;
    sendFollowRequest: (userId: string) => Promise<boolean>;
    unfollowUser: (userId: string) => Promise<boolean>;
    cancelFollowRequest: (userId: string) => Promise<boolean>;
    checkFollowStatus: (userId: string) => Promise<'following' | 'requested' | 'not_following'>;
    acceptFollowRequest: (requesterId: string, followRequestId?: string) => Promise<boolean>;
    rejectFollowRequest: (requesterId: string, followRequestId?: string) => Promise<boolean>;
    getFollowers: (userId: string) => Promise<ProfileDto[]>;
    getFollowing: (userId: string) => Promise<ProfileDto[]>;
    getPendingRequests: () => Promise<FollowRequestDto[]>;
}

const FollowContext = createContext<FollowContextType | undefined>(undefined);

export const FollowProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();

    const getFollowers = async (userId: string) => {
        try {
            const response = await api.get<ProfileDto[]>(`/Follows/${userId}/followers`);
            return response.data;
        } catch (error) {
            console.error('Failed to get followers', error);
            return [];
        }
    };

    const getFollowing = async (userId: string) => {
        try {
            const response = await api.get<ProfileDto[]>(`/Follows/${userId}/following`);
            return response.data;
        } catch (error) {
            console.error('Failed to get following', error);
            return [];
        }
    };

    const checkFollowStatus = async (userId: string): Promise<'following' | 'requested' | 'not_following'> => {
        if (!user) return 'not_following';
        try {
            // Check follow status by looking at our own 'following' list.
            const followingList = await getFollowing(user.id);
            // ProfileDto result from getFollowing has 'id' for the user.
            const isFollowing = followingList.some(f => f.id === userId);

            if (isFollowing) return 'following';

            return 'not_following';
        } catch (error) {
            console.warn('Failed to deduce follow status', error);
            return 'not_following';
        }
    };

    const followUser = async (userId: string) => {
        if (!user) return false;
        try {
            const payload: FollowDto = {
                followerId: user.id,
                followingId: userId,
                followedAt: new Date()
            };
            await api.post(`/Follows`, payload);
            return true;
        } catch (error) {
            console.error('Failed to follow user', error);
            throw error;
        }
    };

    const sendFollowRequest = async (userId: string) => {
        if (!user) return false;
        try {
            const payload: FollowRequestDto = {
                followRequestId: crypto.randomUUID ? crypto.randomUUID() : 'req-' + Date.now(),
                followerId: user.id,
                followingId: userId,
                requestedAt: new Date()
            };
            await api.post(`/FollowRequests`, payload);
            return true;
        } catch (error) {
            console.error('Failed to send follow request', error);
            throw error;
        }
    };

    const unfollowUser = async (userId: string) => {
        if (!user) return false;
        try {
            const payload: FollowDto = {
                followerId: user.id,
                followingId: userId,
                followedAt: new Date()
            };
            await api.delete(`/Follows`, {
                data: payload
            });
            return true;
        } catch (error) {
            console.error('Failed to unfollow user', error);
            throw error;
        }
    };

    const cancelFollowRequest = async (userId: string) => {
        if (!user) return false;
        try {
            const payload: FollowRequestDto = {
                followRequestId: crypto.randomUUID ? crypto.randomUUID() : 'cancel-' + Date.now(),
                followerId: user.id,
                followingId: userId,
                requestedAt: new Date()
            };
            await api.delete(`/FollowRequests`, {
                data: payload
            });
            return true;
        } catch (error) {
            console.error('Failed to cancel follow request', error);
            throw error;
        }
    };

    const acceptFollowRequest = async (requesterId: string, followRequestId?: string) => {
        if (!user) return false;
        try {
            const payload: FollowRequestDto = {
                followRequestId: followRequestId || (crypto.randomUUID ? crypto.randomUUID() : 'accept-' + Date.now()),
                followerId: requesterId,
                followingId: user.id,
                requestedAt: new Date()
            };
            await api.post(`/FollowRequests/Accept`, payload);
            return true;
        } catch (error) {
            console.error('Failed to accept follow request', error);
            return false;
        }
    };

    const rejectFollowRequest = async (requesterId: string, followRequestId?: string) => {
        if (!user) return false;
        try {
            const payload: FollowRequestDto = {
                followRequestId: followRequestId || (crypto.randomUUID ? crypto.randomUUID() : 'reject-' + Date.now()),
                followerId: requesterId,
                followingId: user.id,
                requestedAt: new Date()
            };
            await api.post(`/FollowRequests/Decline`, payload);
            return true;
        } catch (error) {
            console.error('Failed to reject follow request', error);
            return false;
        }
    };

    const getPendingRequests = async () => {
        try {
            const response = await api.get<FollowRequestDto[]>(`/FollowRequests/Pending`);
            return response.data;
        } catch (error) {
            console.error('Failed to get pending requests', error);
            return [];
        }
    }

    return (
        <FollowContext.Provider value={{
            followUser,
            sendFollowRequest,
            unfollowUser,
            cancelFollowRequest,
            checkFollowStatus,
            acceptFollowRequest,
            rejectFollowRequest,
            getFollowers,
            getFollowing,
            getPendingRequests
        }}>
            {children}
        </FollowContext.Provider>
    );
};

export const useFollow = () => {
    const context = useContext(FollowContext);
    if (context === undefined) {
        throw new Error('useFollow must be used within a FollowProvider');
    }
    return context;
};
