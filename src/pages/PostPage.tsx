import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import { Post } from '../types';
import { ArrowLeft } from 'lucide-react';

export default function PostPage() {
    const { postId } = useParams<{ postId: string }>();
    const navigate = useNavigate();
    const [post, setPost] = useState<Post | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) return;
            setIsLoading(true);
            try {
                const res = await api.get(`/posts/${postId}`);
                setPost(res.data);
            } catch (err) {
                console.error("Failed to fetch post", err);
                setError('Post not found or could not be loaded.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPost();
    }, [postId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
                <p className="text-xl font-semibold mb-2">Oops!</p>
                <p className="text-muted-foreground mb-4">{error || 'Post not found'}</p>
                <button onClick={() => navigate(-1)} className="text-primary hover:underline">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-xl mx-auto p-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back
            </button>
            <PostCard post={post} />
        </div>
    );
}
