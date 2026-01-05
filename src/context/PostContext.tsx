import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { api, useAuth } from './AuthContext'; // Reuse the axios instance with interceptors
import { Post, CreatePostDto, Comment, CreateCommentDto, LikeDto } from '../types';

interface PostContextType {
    posts: Post[];
    isLoading: boolean;
    error: string | null;
    fetchPosts: () => Promise<void>;
    createPost: (data: Omit<CreatePostDto, 'userId'>) => Promise<Post | null>;
    deletePost: (postId: string) => Promise<boolean>;
    likePost: (postId: string) => Promise<boolean>;
    unlikePost: (postId: string) => Promise<boolean>;
    isPostLiked: (postId: string) => Promise<boolean>;
    addComment: (postId: string, content: string, parentCommentId?: string) => Promise<Comment | null>;
    deleteComment: (commentId: string) => Promise<void>;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

export const PostProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPosts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('Fetching posts from:', api.defaults.baseURL);

            const response = await api.get('/posts');
            const postsData: Post[] = response.data || [];
            // Fetch comments for each post using comments/post/{postId}
            try {
                const withComments = await Promise.all(postsData.map(async (p) => {
                    try {
                        const cResp = await api.get(`/comments/post/${p.postId}`);
                        return { ...p, comments: cResp?.data || [] } as Post;
                    } catch (e) {
                        const errAny = e as any;
                        console.debug('Failed to fetch comments for post', p.postId, errAny?.response?.status || errAny?.message || errAny);
                        return { ...p, comments: p.comments || [] } as Post;
                    }
                }));
                setPosts(withComments);
            } catch (e) {
                console.debug('Failed to batch fetch comments', e);
                setPosts(postsData);
            }
        } catch (err: any) {
            console.error('Failed to fetch posts', err);
            if (err.response) {
                console.error('Server responded with error:', err.response.status, err.response.data);
                setError(`Fetch Error (${err.response.status}): ${JSON.stringify(err.response.data)}`);
            } else if (err.request) {
                console.error('No response received:', err.request);
                setError('Network Error: No response received from server.');
            } else {
                console.error('Error setting up request:', err.message);
                setError(`Error: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createPost = async (data: Omit<CreatePostDto, 'userId'>): Promise<Post | null> => {
        if (!user) {
            setError('User not authenticated');
            return null;
        }
        setIsLoading(true);
        setError(null);
        try {
            const payload: CreatePostDto = { ...data, userId: user.id };
            console.log('Creating post with payload:', payload);
            const response = await api.post('/posts', payload);
            const newPost = response.data;
           
            setPosts((prev) => [newPost, ...prev]);
            return newPost;
        } catch (err: any) {
            console.error('Failed to create post', err);
            if (err.response) {
                console.error('Server responded with error:', err.response.status, err.response.data);
                setError(`Server Error (${err.response.status}): ${JSON.stringify(err.response.data)}`);
            } else if (err.request) {
                console.error('No response received:', err.request);
                setError('Network Error: No response received from server.');
            } else {
                console.error('Error setting up request:', err.message);
                setError(`Error: ${err.message}`);
            }
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const deletePost = async (postId: string): Promise<boolean> => {
        try {
            await api.delete(`/posts/${postId}`);
            setPosts((prev) => prev.filter((p) => p.postId !== postId));
            return true;
        } catch (err: any) {
            console.error('Failed to delete post', err);
            return false;
        }
    };

    const likePost = async (postId: string): Promise<boolean> => {
        if (!user) {
            console.error('likePost: unauthenticated');
            return false;
        }
        const payload: LikeDto = { userId: user.id, postId, likedAt: new Date() };
        try {
            await api.post('/Like', payload);
            setPosts((prev) => prev.map(p => {
                if (p.postId === postId) {
                    const newLikeCount = (p.likeCount ?? p.likes?.length ?? 0) + 1;
                    const newLikes = p.likes ? [...p.likes] : [];
                    newLikes.push({ userId: user.id, postId, likedAt: new Date() } as any);
                    return { ...p, likeCount: newLikeCount, likes: newLikes } as Post;
                }
                return p;
            }));
            return true;
        } catch (err: any) {
            if (err?.response) {
                console.error(`Like failed: status=${err.response.status} data=`, err.response.data);
            } else if (err?.request) {
                console.error('Like failed: no response received, request=', err.request);
            } else {
                console.error('Like failed:', err.message || err);
            }
            return false;
        }
    };

    const unlikePost = async (postId: string): Promise<boolean> => {
        if (!user) {
            console.error('unlikePost: unauthenticated');
            return false;
        }
        const payload: LikeDto = { userId: user.id, postId, likedAt: new Date() };
        try {
            await api.delete('/Like', { data: payload });
            setPosts((prev) => prev.map(p => {
                if (p.postId === postId) {
                    const current = p.likeCount ?? p.likes?.length ?? 0;
                    const newLikeCount = Math.max(0, current - 1);
                    const newLikes = (p.likes || []).filter(l => l.userId !== user?.id);
                    return { ...p, likeCount: newLikeCount, likes: newLikes } as Post;
                }
                return p;
            }));
            return true;
        } catch (err: any) {
            if (err?.response) {
                console.error(`Unlike failed: status=${err.response.status} data=`, err.response.data);
            } else if (err?.request) {
                console.error('Unlike failed: no response received, request=', err.request);
            } else {
                console.error('Unlike failed:', err.message || err);
            }
            return false;
        }
    };

    const isPostLiked = async (postId: string): Promise<boolean> => {
        if (!user) return false;
        const payload: LikeDto = { userId: user.id, postId, likedAt: new Date() };
        try {
            const resp = await api.post('/Like/exists', payload);
            if (typeof resp.data === 'boolean') return resp.data;
            if (resp.data && typeof resp.data.exists === 'boolean') return resp.data.exists;
            return !!resp.data;
        } catch (err: any) {
            // fallback to GET if POST not supported
            if (err?.response && err.response.status === 405) {
                try {
                    const resp2 = await api.get('/Like/exists', { params: { postId, userId: user.id } });
                    if (typeof resp2.data === 'boolean') return resp2.data;
                    if (resp2.data && typeof resp2.data.exists === 'boolean') return resp2.data.exists;
                    return !!resp2.data;
                } catch (e: any) {
                    if (e?.response) console.error(`Check-like exists (GET) failed: status=${e.response.status} data=`, e.response.data);
                    else if (e?.request) console.error('Check-like exists (GET) failed: no response received, request=', e.request);
                    else console.error('Check-like exists (GET) failed:', e.message || e);
                    return false;
                }
            }
            if (err?.response) console.error(`Check-like exists (POST) failed: status=${err.response.status} data=`, err.response.data);
            else if (err?.request) console.error('Check-like exists (POST) failed: no response received, request=', err.request);
            else console.error('Check-like exists (POST) failed:', err.message || err);
            return false;
        }
    };

    const addComment = async (postId: string, content: string, parentCommentId?: string): Promise<Comment | null> => {
        if (!user) return null;
        try {
            const payload: CreateCommentDto = { postId, content, parentCommentId, userId: user.id };
            // Adjust endpoint if needed. Maybe POST /comments or POST /posts/:id/comments
            const response = await api.post('/comments', payload);
            const created = response.data;
            // Update local posts cache so feed reflects new comment immediately
            setPosts(prev => prev.map(p => {
                if (p.postId === postId) {
                    const existingComments = Array.isArray(p.comments) ? [...p.comments] : [];
                    // prepend the created comment
                    const newComments = [created, ...existingComments];
                    return { ...p, comments: newComments } as Post;
                }
                return p;
            }));
            return created;
        } catch (err: any) {
            console.error('Failed to add comment', err);
            if (err.response) {
                console.error('Server responded with error:', err.response.status, err.response.data);
                setError(`Comment Error (${err.response.status}): ${JSON.stringify(err.response.data)}`);
            } else {
                setError(`Comment Error: ${err.message}`);
            }
            return null;
        }
    };

    const deleteComment = async (commentId: string) => {
        try {
            await api.delete(`/comments/${commentId}`);
            // remove comment from any post in local cache
            setPosts(prev => prev.map(p => {
                if (!p.comments) return p;
                const newComments = (p.comments || []).filter((c: any) => c.commentId !== commentId);
                return { ...p, comments: newComments } as Post;
            }));
        } catch (err: any) {
            console.error('Failed to delete comment', err);
        }
    };

    return (
        <PostContext.Provider value={{
            posts,
            isLoading,
            error,
            fetchPosts,
            createPost,
            deletePost,
            likePost,
            unlikePost,
            isPostLiked,
            addComment,
            deleteComment
        }}>
            {children}
        </PostContext.Provider>
    );
};

export const usePost = () => {
    const context = useContext(PostContext);
    if (context === undefined) {
        throw new Error('usePost must be used within a PostProvider');
    }
    return context;
};
