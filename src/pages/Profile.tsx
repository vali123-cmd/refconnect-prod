import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { User, Settings, Grid, Lock, UserPlus, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import PostCard from '../components/PostCard';
import { normalizeAssetUrl } from '../lib/utils';
import { usePost } from '../context/PostContext';
import { useFollow } from '../context/FollowContext';
import UserListModal from '../components/UserListModal';

export default function Profile() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'posts' | 'info'>('posts');
    const [profileData, setProfileData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { isPostLiked } = usePost();
    const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
    const [followersCount, setFollowersCount] = useState<number>(0);
    const [followingCount, setFollowingCount] = useState<number>(0);


    useEffect(() => {

        const profileId = user?.id || (user as any)?.sub || (user as any)?.userId;
        if (!profileId) {
            console.debug('Profile: no user id/sub/userId available yet, skipping fetch');
            setIsLoading(false);
            return;
        }
        console.debug('Profile: fetching for profileId=', profileId);
        let mounted = true;
        const fetchProfile = async () => {
            setIsLoading(true);
            try {
                // Try extended first, fall back to basic on any error
                try {
                    const ext = await api.get(`/profiles/${profileId}/extended`);
                    if (!mounted) return;
                    console.debug('Profile: extended profile response', ext && ext.status, ext && ext.data);
                    setProfileData(ext.data);
                    return;
                } catch (err: any) {
                    console.debug('Profile: extended profile fetch errored, falling back to basic:', err?.response?.status);
                    // Fallback to basic profile on any error
                    const basic = await api.get(`/profiles/${profileId}`);
                    if (!mounted) return;
                    console.debug('Profile: basic profile response', basic && basic.status, basic && basic.data);
                    setProfileData(basic.data);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch profile', err);
            } finally {
                if (!mounted) return;
                setIsLoading(false);
            }
        };

        fetchProfile();
        return () => { mounted = false; };
    }, [user?.id]);

    // When we have profileData.posts, pre-check like status for each post
    useEffect(() => {
        let mounted = true;
        const checkLikes = async () => {
            if (!profileData?.posts || !Array.isArray(profileData.posts)) return;
            const entries = await Promise.all(profileData.posts.map(async (p: any) => {
                try {
                    const liked = await isPostLiked(p.postId);
                    return [p.postId, !!liked] as [string, boolean];
                } catch (e) {
                    return [p.postId, false] as [string, boolean];
                }
            }));
            if (!mounted) return;
            const map: Record<string, boolean> = {};
            for (const [k, v] of entries) map[k] = v;
            setLikedMap(map);
        };
        checkLikes();
        return () => { mounted = false; };
    }, [profileData?.posts, isPostLiked]);

    // Mock data for profile (fallback)
    const isOwnProfile = true; // In real app, this depends on URL param vs auth user
    const profileUser = profileData || user || {
        userName: 'Visitor',
        firstName: '',
        lastName: '',
        role: 'visitor',
        description: 'Just visiting',
        isProfilePublic: true,
        profileImageUrl: null
    };

    const displayName = profileData
        ? `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profileData.userName
        : user?.name || 'Visitor';
    // List Modal State
    const { getFollowers, getFollowing } = useFollow();

    const [isListOpen, setIsListOpen] = useState(false);
    const [listType, setListType] = useState<'followers' | 'following'>('followers');
    const [listUsers, setListUsers] = useState<any[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);

    const openList = async (type: 'followers' | 'following') => {
        setListType(type);
        setIsListOpen(true);
        setIsListLoading(true);
        try {
            const profileId = user?.id || (user as any)?.sub || (user as any)?.userId;
            if (!profileId) return;

            let data = [];
            if (type === 'followers') {
                data = await getFollowers(profileId);
            } else {
                data = await getFollowing(profileId);
            }
            setListUsers(data);
        } catch (error) {
            console.error("Failed to fetch user list", error);
        } finally {
            setIsListLoading(false);
        }
    };

    // Keep follow counts in sync with backend (profileData.followersCount can be missing/stale)
    useEffect(() => {
        const profileId = user?.id || (user as any)?.sub || (user as any)?.userId;
        if (!profileId) return;

        let mounted = true;
        (async () => {
            try {
                const [followers, following] = await Promise.all([
                    getFollowers(profileId),
                    getFollowing(profileId)
                ]);
                if (!mounted) return;
                setFollowersCount(Array.isArray(followers) ? followers.length : 0);
                setFollowingCount(Array.isArray(following) ? following.length : 0);
            } catch (e) {
                // keep previous numbers
            }
        })();

        return () => {
            mounted = false;
        };
    }, [user?.id, getFollowers, getFollowing]);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Lock className="h-12 w-12 mb-4" />
                <p>Please login to view profiles.</p>
                <Link to="/login" className="mt-4 text-primary hover:underline">Login</Link>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-4 border-background shadow-sm">
                        {profileUser.profileImageUrl ? (
                            <img src={normalizeAssetUrl(profileUser.profileImageUrl)} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                            <User className="h-12 w-12 text-muted-foreground" />
                        )}
                    </div>
                    {isOwnProfile && (
                        <Link to="/profile/edit" className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-md hover:opacity-90">
                            <Settings className="h-4 w-4" />
                        </Link>
                    )}
                </div>

                <div className="text-center">
                    <h1 className="text-2xl font-bold">{displayName}</h1>
                    <p className="text-muted-foreground capitalize">{profileUser.role || user?.role}</p>
                </div>

                <div className="flex gap-4 text-sm w-full justify-center">
                    <div className="flex flex-col items-center">
                        <span className="font-bold">{profileData?.posts?.length ?? '—'}</span>
                        <span className="text-muted-foreground">Postări</span>
                    </div>
                    <button onClick={() => openList('followers')} className="flex flex-col items-center hover:opacity-75 transition-opacity">
                        <span className="font-bold">{followersCount}</span>
                        <span className="text-muted-foreground">Urmăritori</span>
                    </button>
                    <button onClick={() => openList('following')} className="flex flex-col items-center hover:opacity-75 transition-opacity">
                        <span className="font-bold">{followingCount}</span>
                        <span className="text-muted-foreground">Urmăriri</span>
                    </button>
                </div>

                {!isOwnProfile && (
                    <button className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-medium text-sm flex items-center gap-2 hover:opacity-90">
                        <UserPlus className="h-4 w-4" />
                        Follow
                    </button>
                )}
            </div>

            {/* Bio */}
            <div className="bg-card border border-border rounded-lg p-4 text-sm">
                <p>{profileUser.description || profileUser.bio || "No description available."}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('posts')}
                    className={`flex-1 pb-3 text-sm font-medium transition-colors ${activeTab === 'posts' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Grid className="h-4 w-4 mx-auto mb-1" />
                    Posts
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 pb-3 text-sm font-medium transition-colors ${activeTab === 'info' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <FileText className="h-4 w-4 mx-auto mb-1" />
                    Info
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[200px]">
                {activeTab === 'posts' ? (
                    profileData?.posts && profileData.posts.length > 0 ? (
                        <div className="space-y-4">
                            {profileData.posts.map((p: any) => (
                                <PostCard key={p.postId} post={p} initialIsLiked={likedMap[p.postId]} initialLikesCount={(p.likeCount ?? p.likes?.length ?? 0)} />
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-muted-foreground">No posts yet.</div>
                    )
                ) : (
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <div className="flex justify-between border-b border-border pb-2">
                            <span>Joined</span>
                            <span className="text-foreground">Dec 2025</span>
                        </div>
                        <div className="flex justify-between border-b border-border pb-2">
                            <span>Visibility</span>
                            <span className="text-foreground">{profileUser.isPrivate ? 'Private' : 'Public'}</span>
                        </div>
                        {/* Match stats could go here for referees */}
                    </div>
                )}
            </div>

            {/* Lists Modal */}
            <UserListModal
                isOpen={isListOpen}
                onClose={() => setIsListOpen(false)}
                title={listType === 'followers' ? 'Urmăritori' : 'Urmăriri'}
                type={listType as any}
                users={listUsers}
                isLoading={isListLoading}
            />
        </div>
    );
}
