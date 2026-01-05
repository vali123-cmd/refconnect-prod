import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, Search, UserPlus, Clock, Check, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { ChatDto } from '../types';

export default function Groups() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { 
        chats, 
        myPendingRequests,
        fetchChats,
        fetchMyPendingRequests,
        requestJoinChat,
        isMemberOfChat,
        isLoading 
    } = useChat();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [requestingChatId, setRequestingChatId] = useState<string | null>(null);
    const [membershipByChatId, setMembershipByChatId] = useState<Record<string, boolean>>({});
    const [checkingMembership, setCheckingMembership] = useState(false);

    const effectiveUserId = React.useMemo(() => {
        if (user?.id) return user.id;
        try {
            const stored = localStorage.getItem('refconnect_user');
            const parsed = stored ? (JSON.parse(stored) as any) : null;
            return parsed?.id || parsed?.userId || parsed?.sub || null;
        } catch {
            return null;
        }
    }, [user?.id]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return;

        // As requested: show groups returned by /Chats
        fetchChats();
        fetchMyPendingRequests();
    }, [authLoading, isAuthenticated]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return;
        if (!effectiveUserId) return;
        if (!Array.isArray(chats) || chats.length === 0) return;

        let mounted = true;
        setCheckingMembership(true);

        (async () => {
            const next: Record<string, boolean> = {};
            await Promise.all(
                chats.map(async (c) => {
                    try {
                        next[c.chatId] = await isMemberOfChat(c.chatId, effectiveUserId);
                    } catch {
                        next[c.chatId] = false;
                    }
                })
            );

            if (!mounted) return;
            setMembershipByChatId(next);
            setCheckingMembership(false);
        })();

        return () => {
            mounted = false;
        };
        // We intentionally avoid adding `isMemberOfChat` to keep this stable (it's from context).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, isAuthenticated, effectiveUserId, chats]);

    // What we render in this page: chats from /Chats (client-side filtered by search term)
    const displayedGroups = chats.filter(group => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;

        const haystack = `${group.name || ''} ${group.description || ''}`.toLowerCase();
        return haystack.includes(q);
    });

    const handleOpenGroup = (chatId: string) => {
        navigate(`/chats/${chatId}`);
    };

    // Check if user is already a member of a chat (source of truth is backend endpoint)
    const isMember = (chatId: string) => {
        if (!effectiveUserId) return false;
        return membershipByChatId[chatId] === true;
    };

    // Check if user has a pending request for a chat
    const hasPendingRequest = (chatId: string) => {
        return myPendingRequests.some(req => req.chatId === chatId && req.status === 'Pending');
    };

    // Check if user is the creator of a chat
    const isCreator = (chat: ChatDto) => {
        return chat.createdByUserId === user?.id;
    };

    const handleRequestJoin = async (chatId: string) => {
        setRequestingChatId(chatId);
        try {
            await requestJoinChat(chatId);
            await fetchMyPendingRequests(); // Refresh pending requests
            alert('Join request sent successfully!');
        } catch (err) {
            alert('Failed to send join request');
        } finally {
            setRequestingChatId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Grupuri</h1>
                {user && (
                    <Link to="/groups/create" className="bg-primary text-primary-foreground p-2 rounded-full hover:opacity-90 transition-opacity">
                        <Plus className="h-5 w-5" />
                    </Link>
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Caută grupuri..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-secondary/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : checkingMembership && isAuthenticated ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificăm dacă ești membru…
                </div>
            ) : displayedGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{searchTerm ? 'Nu s-au găsit grupuri' : 'Nu există grupuri disponibile'}</p>
                    {user && !searchTerm && (
                        <Link to="/groups/create" className="text-primary hover:underline mt-2 inline-block">
                            Creează primul grup
                        </Link>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {displayedGroups.map(group => (
                        <div 
                            key={group.chatId} 
                            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() => handleOpenGroup(group.chatId)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    <h3 className="font-semibold">
                                        {group.name?.trim() || 'Grup fără nume'}
                                    </h3>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {group.chatUsers?.length || 0} membri
                                </span>
                            </div>

                            {group.description?.trim() && (
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {group.description}
                                </p>
                            )}
                            
                            <p className="text-xs text-muted-foreground mb-3">
                                Creat la: {new Date(group.createdAt).toLocaleDateString('ro-RO')}
                            </p>

                            <div className="flex items-center justify-end gap-2">
                                {isCreator(group) ? (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Creatorul grupului
                                    </span>
                                ) : isMember(group.chatId) ? (
                                    <Link 
                                        to={`/chats/${group.chatId}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/chats/${group.chatId}`);
                                        }}
                                        className="text-xs bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-green-500/20 transition-colors"
                                    >
                                        <Check className="h-3 w-3" />
                                        Membru - Vezi mesaje
                                    </Link>
                                ) : hasPendingRequest(group.chatId) ? (
                                    <span className="text-xs bg-yellow-500/10 text-yellow-500 px-3 py-1.5 rounded-full flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Cerere în așteptare
                                    </span>
                                ) : user ? (
                                    <button
                                        onClick={() => handleRequestJoin(group.chatId)}
                                        disabled={requestingChatId === group.chatId}
                                        className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {requestingChatId === group.chatId ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <UserPlus className="h-3 w-3" />
                                        )}
                                        Cere să te alături
                                    </button>
                                ) : (
                                    <Link 
                                        to="/login" 
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs text-muted-foreground hover:text-primary"
                                    >
                                        Conectează-te pentru a te alătura
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
