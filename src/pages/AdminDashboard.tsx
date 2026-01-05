import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trash2, Users, FileText, MessageSquare, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { ChatDto, Post } from '../types';

export default function AdminDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'groups'>('users');

    const isAdmin = !!user && (
        String(user.role || '').toLowerCase() === 'admin' ||
        (Array.isArray(user.roles) && user.roles.some(r => String(r || '').toLowerCase() === 'admin'))
    );

    const [users, setUsers] = useState<any[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [groups, setGroups] = useState<ChatDto[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user && !isAdmin) {
            navigate('/');
        }
    }, [user, isAdmin, navigate]);

    useEffect(() => {
        if (!isAdmin) return;

        let mounted = true;
        setIsLoadingData(true);
        setError(null);

        (async () => {
            try {
                // Users: admin should use /Users (these IDs match delete semantics)
                const usersResp = await api.get('/Users');
                const usersData = Array.isArray(usersResp.data) ? usersResp.data : (usersResp.data?.items || []);

                // Posts: reuse PostContext endpoint
                const postsResp = await api.get('/posts');
                const postsData = Array.isArray(postsResp.data) ? postsResp.data : [];

                // Groups: reuse ChatContext endpoint (/Chats is source of truth)
                const groupsResp = await api.get('/Chats');
                const groupsData = Array.isArray(groupsResp.data)
                    ? groupsResp.data
                    : (Array.isArray(groupsResp.data?.items) ? groupsResp.data.items : []);

                if (!mounted) return;
                setUsers(usersData);
                setPosts(postsData);
                setGroups(groupsData);
            } catch (e: any) {
                console.error('Failed to load admin data', e);
                const msg = e?.response?.data?.message || e?.message || 'Failed to load admin data';
                if (mounted) setError(msg);
            } finally {
                if (mounted) setIsLoadingData(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isAdmin]);

    if (!isAdmin) {
        return null;
    }

    const handleDelete = async (type: 'user' | 'post' | 'group', id: any) => {
        if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;

        const extractErrorMessage = (err: any): string => {
            const data = err?.response?.data;
            // Handle array of errors (ASP.NET Identity often returns ["Description..."])
            if (Array.isArray(data)) {
                const joined = data.map(d => (typeof d === 'string' ? d : d.description || JSON.stringify(d))).join(', ');
                return joined || 'Request failed';
            }
            if (typeof data === 'string') {
                return data;
            }
            if (data && typeof data === 'object') {
                return data.message || data.error || data.title || JSON.stringify(data);
            }
            return err?.message || 'Request failed';
        };

        try {
            if (type === 'user') {
                const userId = String(id);
                // Use Correct PascalCase /Users endpoint
                await api.delete(`/Users/${userId}`);
                setUsers(prev => prev.filter(u => String(u?.id ?? u?.userId ?? u?.sub) !== userId));
                return;
            }

            if (type === 'post') {
                await api.delete(`/posts/${id}`);
                setPosts(prev => prev.filter((p: any) => String((p as any).postId ?? (p as any).id) !== String(id)));
                return;
            }

            if (type === 'group') {
                await api.delete(`/Chats/${id}`);
                setGroups(prev => prev.filter((g: any) => String((g as any).chatId ?? (g as any).id) !== String(id)));
                return;
            }
        } catch (err: any) {
            console.error(`Failed to delete ${type}`, err);
            if (err.response) {
                console.error('SERVER ERROR DATA:', err.response.data);
            }
            const status = err?.response?.status;
            const msg = extractErrorMessage(err);
            window.alert(`Failed to delete ${type}${status ? ` (${status})` : ''}: ${msg}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-red-600">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">Manage users and content.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center">
                    <Users className="h-6 w-6 text-primary mb-2" />
                    <span className="text-2xl font-bold">{users.length}</span>
                    <span className="text-xs text-muted-foreground">Users</span>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center">
                    <FileText className="h-6 w-6 text-primary mb-2" />
                    <span className="text-2xl font-bold">{posts.length}</span>
                    <span className="text-xs text-muted-foreground">Posts</span>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center">
                    <MessageSquare className="h-6 w-6 text-primary mb-2" />
                    <span className="text-2xl font-bold">{groups.length}</span>
                    <span className="text-xs text-muted-foreground">Groups</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Users
                </button>
                <button
                    onClick={() => setActiveTab('posts')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Posts
                </button>
                <button
                    onClick={() => setActiveTab('groups')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'groups' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Groups
                </button>
            </div>

            {/* Lists */}
            <div className="space-y-2">
                {isLoadingData ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                    </div>
                ) : error ? (
                    <div className="text-center py-8 text-red-500">{error}</div>
                ) : (
                    <>
                        {activeTab === 'users' && (
                            users.length > 0 ? users.map(u => {
                                const userId = u?.id ?? u?.userId ?? u?.sub;
                                const name = u?.fullName || u?.userName || u?.name || 'User';
                                const role = u?.role || 'User';
                                return (
                                    <div key={String(userId)} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                                        <div className="flex flex-col">
                                            <h3 className="font-medium">{name}</h3>
                                            <span className="text-xs text-muted-foreground">{role}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDelete('user', userId)}
                                            disabled={String(userId) === String(user?.id)}
                                            title={String(userId) === String(user?.id) ? "You can't delete your own account" : 'Delete user'}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div className="text-center py-8 text-muted-foreground">No users found.</div>
                            )
                        )}

                        {activeTab === 'posts' && (
                            posts.length > 0 ? posts.map((p: any) => (
                                <div key={String(p.postId)} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                                    <div className="flex flex-col max-w-[80%]">
                                        <h3 className="font-medium text-sm truncate">{p.content}</h3>
                                        <span className="text-xs text-muted-foreground">by {p.userId} • {p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</span>
                                    </div>
                                    <button onClick={() => handleDelete('post', p.postId)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-muted-foreground">No posts found.</div>
                            )
                        )}

                        {activeTab === 'groups' && (
                            groups.length > 0 ? groups.map((g: any) => (
                                <div key={String(g.chatId)} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                                    <div className="flex flex-col">
                                        <h3 className="font-medium">{g.name || g.groupName || 'Group'}</h3>
                                        <span className="text-xs text-muted-foreground">{Array.isArray(g.chatUsers) ? g.chatUsers.length : 0} members</span>
                                    </div>
                                    <button onClick={() => handleDelete('group', g.chatId)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-muted-foreground">No groups found.</div>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
