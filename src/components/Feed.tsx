import React, { useEffect } from 'react';
import PostCard from './PostCard';
import { usePost } from '../context/PostContext';

export default function Feed() {
    const { posts, fetchPosts, isLoading, error } = usePost();

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    if (isLoading && posts.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">Loading posts...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-500">Error: {error}</div>;
    }

    return (
        <div>
            {posts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">
                    No posts yet. Be the first to share something!
                </div>
            ) : (
                posts.map(post => (
                    <PostCard key={post.postId} post={post} />
                ))
            )}
        </div>
    );
}
