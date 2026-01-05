import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { api, useAuth } from '../context/AuthContext';
import { MessageCircle, Plus, Users, Trash2, Send, Edit2, X, Check, UserPlus, Settings } from 'lucide-react';
import { ChatDto, MessageDto, ChatJoinRequestDto } from '../types';
import { useAIModeration } from '../hooks/useAIModeration';
import { normalizeAssetUrl } from '../lib/utils';

export default function Chats() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { chatId: chatIdParam } = useParams<{ chatId: string }>();
    const { checkContent } = useAIModeration();
    const {
        chats,
        currentChat,
        messages,
        joinRequests,
        myPendingRequests,
        isLoading,
        error,
        fetchChats,
        isMemberOfChat,
        fetchMessages,
        sendMessage,
        updateMessage,
        deleteMessage,
        createGroupChat,
        deleteChat,
        removeChatMember,
        setCurrentChat,
        fetchJoinRequestsForOwner,
        fetchMyPendingRequests,
        acceptJoinRequest,
        requestJoinChat,
        declineJoinRequest,
        cancelJoinRequest,
        clearError
    } = useChat();

    const [newMessage, setNewMessage] = useState('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [showCreateChat, setShowCreateChat] = useState(false);
    const [showJoinRequests, setShowJoinRequests] = useState(false);
    const [showMyRequests, setShowMyRequests] = useState(false);
    const [newChatName, setNewChatName] = useState('');
    const [newChatDescription, setNewChatDescription] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isMember, setIsMember] = useState<boolean | null>(null);
    const [showMembers, setShowMembers] = useState(false);
    const [membersByUserId, setMembersByUserId] = useState<Record<string, { displayName: string; profileImageUrl: string | null } | null>>({});
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [senderProfiles, setSenderProfiles] = useState<Record<string, { displayName: string; profileImageUrl: string | null } | null>>({});
    const effectiveUserId = React.useMemo(() => {
        if (user?.id) return user.id;
        try {
            const stored = localStorage.getItem('refconnect_user');
            const parsed = stored ? (JSON.parse(stored) as any) : null;
            return parsed?.id || parsed?.userId || parsed?.sub || null;
        } catch (e) {
            return null;
        }
    }, [user?.id]);

    const fetchSenderProfile = async (id: string) => {
        if (!id) return;

        try {
            const r = await api.get(`/profiles/${id}`);
            const prof = r?.data;
            const displayName = (
                ((prof?.firstName || prof?.lastName)
                    ? `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim()
                    : (prof?.fullName || prof?.userName || ''))
            ).trim();
            const profileImageUrl = (typeof prof?.profileImageUrl === 'string' && prof.profileImageUrl.trim())
                ? prof.profileImageUrl
                : null;

            const mapped = { displayName, profileImageUrl };
            setSenderProfiles(prev => ({ ...prev, [id]: mapped }));
        } catch (e) {
            setSenderProfiles(prev => ({ ...prev, [id]: null }));
        }
    };

    // When coming from Groups page, we may receive a chatId to auto-open.
    const requestedChatId = (location.state as { chatId?: string } | null)?.chatId;

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return;

        fetchChats();
        fetchJoinRequestsForOwner();
        fetchMyPendingRequests();
    }, [authLoading, isAuthenticated]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return;
        if (!requestedChatId) return;

        // Select the chat once it's available in the list (after fetchChats resolves).
        const requestedChat = chats.find(c => c.chatId === requestedChatId);
        if (requestedChat && currentChat?.chatId !== requestedChatId) {
            setCurrentChat(requestedChat);
        }
    }, [authLoading, isAuthenticated, requestedChatId, chats, currentChat?.chatId, setCurrentChat]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return;
        if (!chatIdParam) return;

        const requestedChat = chats.find(c => c.chatId === chatIdParam);
        if (requestedChat && currentChat?.chatId !== chatIdParam) {
            setCurrentChat(requestedChat);
        }
    }, [authLoading, isAuthenticated, chatIdParam, chats, currentChat?.chatId, setCurrentChat]);

    useEffect(() => {
        if (!currentChat) return;
        if (!isAuthenticated) return;

        let mounted = true;
        setIsMember(null);
        (async () => {
            if (!effectiveUserId) {
                // TEMP DEBUG: user id resolution
                console.log('[Chats][membership] missing effectiveUserId', {
                    authUserId: user?.id,
                    isAuthenticated,
                    hasStoredUser: !!localStorage.getItem('refconnect_user'),
                });
                if (mounted) setIsMember(false);
                return;
            }

            // TEMP DEBUG: membership check inputs
            console.log('[Chats][membership] checking', {
                chatId: currentChat.chatId,
                effectiveUserId,
                authUserId: user?.id,
            });

            const ok = await isMemberOfChat(currentChat.chatId, effectiveUserId);
            if (!mounted) return;

            // TEMP DEBUG: membership check result
            console.log('[Chats][membership] result', {
                chatId: currentChat.chatId,
                effectiveUserId,
                ok,
            });
            setIsMember(ok);
            if (ok) {
                fetchMessages(currentChat.chatId);
            }
        })();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentChat?.chatId, effectiveUserId, isAuthenticated]);

    useEffect(() => {
        // Enrich sender profiles for visible messages
        const ids = Array.from(new Set(messages.map(m => m.userId).filter(Boolean)));
        const toFetch = ids.filter(id => !Object.prototype.hasOwnProperty.call(senderProfiles, id));
        if (toFetch.length === 0) return;
        toFetch.forEach(id => fetchSenderProfile(id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    useEffect(() => {
        // Scroll to bottom when messages change
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentChat || isSending) return;

        // AI moderation check
        const moderationResult = await checkContent(newMessage.trim());
        if (!moderationResult.safe) {
            alert(moderationResult.reason || "Message has been flagged as inappropriate.");
            return;
        }

        setIsSending(true);
        try {
            await sendMessage(currentChat.chatId, newMessage.trim());
            setNewMessage('');
        } catch (err) {
            alert('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    const handleUpdateMessage = async (messageId: string) => {
        if (!editingText.trim()) return;

        // AI moderation check
        const moderationResult = await checkContent(editingText.trim());
        if (!moderationResult.safe) {
            alert(moderationResult.reason || "Message has been flagged as inappropriate.");
            return;
        }

        try {
            await updateMessage(messageId, editingText.trim());
            setEditingMessageId(null);
            setEditingText('');
        } catch (err) {
            alert('Failed to update message');
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!window.confirm('Delete this message?')) return;

        try {
            await deleteMessage(messageId);
        } catch (err) {
            alert('Failed to delete message');
        }
    };

    const handleDeleteChat = async (chatId: string) => {
        if (!window.confirm('Delete this chat? This action cannot be undone.')) return;

        try {
            await deleteChat(chatId);
        } catch (err) {
            alert('Failed to delete chat');
        }
    };

    const handleCreateGroupChat = async () => {
        if (!newChatName.trim()) {
            alert('Te rog introdu un nume pentru grup');
            return;
        }

        try {
            const chat = await createGroupChat(newChatName.trim(), newChatDescription.trim(), []);
            if (chat) {
                setShowCreateChat(false);
                setNewChatName('');
                setNewChatDescription('');
                setCurrentChat(chat);
            }
        } catch (err) {
            alert('Failed to create group chat');
        }
    };

    const handleAcceptRequest = async (requestId: string) => {
        try {
            await acceptJoinRequest(requestId);
            fetchChats(); // Refresh chats to show new member
        } catch (err) {
            alert('Failed to accept request');
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        try {
            await declineJoinRequest(requestId);
        } catch (err) {
            alert('Failed to decline request');
        }
    };

    const handleCancelRequest = async (requestId: string) => {
        try {
            await cancelJoinRequest(requestId);
        } catch (err) {
            alert('Failed to cancel request');
        }
    };

    const canDeleteChat = (chat: ChatDto) => {
        return user?.id === chat.createdByUserId || user?.role === 'admin';
    };

    const canManageMembers = (chat: ChatDto) => {
        return user?.id === chat.createdByUserId || user?.role === 'admin';
    };

    const fetchMemberProfile = async (userId: string): Promise<{ displayName: string; profileImageUrl: string | null } | null> => {
        if (!userId) return null;
        if (Object.prototype.hasOwnProperty.call(membersByUserId, userId)) {
            return membersByUserId[userId] || null;
        }
        try {
            const r = await api.get(`/profiles/${userId}`);
            const prof = r?.data;
            const displayName = (
                ((prof?.firstName || prof?.lastName)
                    ? `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim()
                    : (prof?.fullName || prof?.userName || 'User'))
            ).trim();
            const profileImageUrl = (typeof prof?.profileImageUrl === 'string' && prof.profileImageUrl.trim())
                ? prof.profileImageUrl
                : null;
            const mapped = { displayName, profileImageUrl };
            setMembersByUserId(prev => ({ ...prev, [userId]: mapped }));
            return mapped;
        } catch (e) {
            setMembersByUserId(prev => ({ ...prev, [userId]: null }));
            return null;
        }
    };

    useEffect(() => {
        if (!showMembers) return;
        if (!currentChat) return;

        const ids = Array.from(new Set((currentChat.chatUsers || []).map(u => u.userId).filter(Boolean)));
        const toFetch = ids.filter(id => !Object.prototype.hasOwnProperty.call(membersByUserId, id));
        if (toFetch.length === 0) return;
        Promise.all(toFetch.map(id => fetchMemberProfile(id))).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showMembers, currentChat?.chatId, currentChat?.chatUsers]);

    return (
        <div className="flex h-[calc(100vh-8rem)] bg-background rounded-lg border border-border overflow-hidden">
            {/* Sidebar - Chat List */}
            <div className="w-80 border-r border-border flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Chats</h2>
                    <div className="flex gap-2">
                        {joinRequests.length > 0 && (
                            <button
                                onClick={() => setShowJoinRequests(!showJoinRequests)}
                                className="p-2 hover:bg-secondary rounded-full relative"
                                title="Join Requests"
                            >
                                <UserPlus className="h-5 w-5" />
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {joinRequests.length}
                                </span>
                            </button>
                        )}
                        <button
                            onClick={() => setShowMyRequests(!showMyRequests)}
                            className="p-2 hover:bg-secondary rounded-full"
                            title="My Pending Requests"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setShowCreateChat(true)}
                            className="p-2 hover:bg-secondary rounded-full"
                            title="Create Group Chat"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Filter chats to only show those where the user is a member */}
                    {(() => {
                        const filteredChats = chats.filter(chat => {
                            if (!effectiveUserId) return false;
                            // Check rigid membership in chatUsers
                            const isMember = (chat.chatUsers || []).some(u => u.userId === effectiveUserId);
                            // Also checking creator just in case, though usually creator is added as member
                            const isCreator = chat.createdByUserId === effectiveUserId;
                            return isMember || isCreator;
                        });

                        if (isLoading && chats.length === 0) {
                            return (
                                <div className="flex justify-center items-center h-32">
                                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                                </div>
                            );
                        }

                        if (filteredChats.length === 0) {
                            return (
                                <div className="p-4 text-center text-muted-foreground">
                                    No chats found. You are not a member of any group.
                                </div>
                            );
                        }

                        return filteredChats.map((chat: ChatDto) => (
                            <button
                                key={chat.chatId}
                                onClick={() => {
                                    setCurrentChat(chat);
                                    navigate(`/chats/${chat.chatId}`);
                                }}
                                className={`w-full p-4 text-left hover:bg-secondary transition-colors border-b border-border ${currentChat?.chatId === chat.chatId ? 'bg-secondary' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Users className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">
                                            {chat.name?.trim() || `Chat ${chat.chatId.substring(0, 8)}`}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            {chat.description?.trim() || `${chat.chatUsers?.length || 0} membri`}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ));
                    })()}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {currentChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">
                                        {currentChat.name?.trim() || `Chat ${currentChat.chatId.substring(0, 8)}`}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {currentChat.description?.trim() || `${currentChat.chatUsers?.length || 0} membri`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {canManageMembers(currentChat) && (
                                    <button
                                        onClick={() => setShowMembers(true)}
                                        className="px-3 py-1.5 rounded bg-secondary hover:opacity-90 text-sm flex items-center gap-2"
                                        title="View members"
                                    >
                                        <Users className="h-4 w-4" />
                                        Members
                                    </button>
                                )}
                                {canDeleteChat(currentChat) && (
                                    <button
                                        onClick={() => handleDeleteChat(currentChat.chatId)}
                                        className="p-2 hover:bg-red-500/10 text-red-500 rounded-full"
                                        title="Delete Chat"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Members Modal */}
                        {showMembers && currentChat && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                <div className="bg-background rounded-lg border border-border w-full max-w-lg max-h-[80vh] overflow-hidden">
                                    <div className="p-4 border-b border-border flex items-center justify-between">
                                        <div>
                                            <div className="font-semibold">Members</div>
                                            <div className="text-xs text-muted-foreground">
                                                {currentChat.name?.trim() || `Chat ${currentChat.chatId.substring(0, 8)}`}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowMembers(false)}
                                            className="p-2 hover:bg-secondary rounded"
                                            title="Close"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <div className="p-4 overflow-y-auto max-h-[65vh] space-y-2">
                                        {(currentChat.chatUsers || []).length === 0 ? (
                                            <div className="text-sm text-muted-foreground">No members found.</div>
                                        ) : (
                                            (currentChat.chatUsers || []).map((cu) => {
                                                const prof = membersByUserId[cu.userId] || null;
                                                const name = (prof?.displayName || (cu.userId ? `User ${cu.userId.slice(0, 8)}` : 'User')).trim();
                                                const img = prof?.profileImageUrl || null;
                                                const isMe = !!effectiveUserId && cu.userId === effectiveUserId;
                                                return (
                                                    <div
                                                        key={cu.chatUserId || cu.userId}
                                                        className="flex items-center justify-between gap-3 p-2 rounded border border-border"
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                                                                {img ? (
                                                                    <img
                                                                        src={normalizeAssetUrl(img)}
                                                                        alt={name}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <span className="text-sm">{name.charAt(0) || '?'}</span>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium truncate">{name}{isMe ? ' (you)' : ''}</div>
                                                                <div className="text-xs text-muted-foreground truncate">{cu.userId}</div>
                                                            </div>
                                                        </div>

                                                        {canManageMembers(currentChat) && !isMe && (
                                                            <button
                                                                onClick={async () => {
                                                                    if (!window.confirm('Remove this member from the chat?')) return;
                                                                    setRemovingUserId(cu.userId);
                                                                    try {
                                                                        await removeChatMember(currentChat.chatId, cu.userId);
                                                                        await fetchChats();
                                                                    } catch (e) {
                                                                        alert('Failed to remove member');
                                                                    } finally {
                                                                        setRemovingUserId(null);
                                                                    }
                                                                }}
                                                                disabled={removingUserId === cu.userId}
                                                                className="text-xs bg-red-500/10 text-red-500 px-3 py-1.5 rounded-full hover:bg-red-500/20 disabled:opacity-50"
                                                            >
                                                                {removingUserId === cu.userId ? 'Removing…' : 'Remove'}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        {(() => {
                            if (isMember === null) {
                                return (
                                    <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
                                        Checking membership...
                                    </div>
                                );
                            }

                            if (isMember === false) {
                                return (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-3">
                                        <div className="text-lg font-semibold text-foreground">You’re not a member of this chat</div>
                                        <div className="text-sm max-w-md">
                                            To view messages, request access (or ask the owner to accept your request).
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await requestJoinChat(currentChat.chatId);
                                                    alert('Join request sent');
                                                    fetchMyPendingRequests();
                                                } catch (e) {
                                                    alert('Failed to send join request');
                                                }
                                            }}
                                            className="px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90"
                                        >
                                            Request to join
                                        </button>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    ref={messagesContainerRef}
                                    className="flex-1 overflow-y-auto p-4 space-y-4"
                                >
                                    {messages.length === 0 ? (
                                        <div className="text-center text-muted-foreground py-8">
                                            No messages yet. Start the conversation!
                                        </div>
                                    ) : (
                                        messages.map((msg: MessageDto) => {
                                            const sender = msg.userId ? senderProfiles[msg.userId] : null;
                                            const rawSenderName = (sender?.displayName || '').trim();
                                            const isMine = !!effectiveUserId && msg.userId === effectiveUserId;
                                            const myDisplayName = (
                                                `${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`.trim() ||
                                                (user as any)?.fullName ||
                                                (user as any)?.userName ||
                                                'Me'
                                            );
                                            // If profile data is missing/blank, still show *something* helpful in the UI.
                                            // We prefer a readable name, otherwise fall back to a short id-based label.
                                            const senderName = (isMine ? myDisplayName : rawSenderName).length > 0
                                                ? (isMine ? myDisplayName : rawSenderName)
                                                : msg.userId
                                                    ? `User ${msg.userId.slice(0, 8)}`
                                                    : 'User';
                                            const senderImage = sender?.profileImageUrl || null;

                                            return (
                                                <div
                                                    key={msg.messageId}
                                                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div className={`flex gap-2 max-w-[70%] ${isMine ? 'flex-row-reverse' : ''}`}>
                                                        {/* Avatar */}
                                                        <div
                                                            className={`h-8 w-8 rounded-full bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center ${!isMine ? 'cursor-pointer hover:opacity-80' : ''}`}
                                                            onClick={() => !isMine && msg.userId && navigate(`/profile/${msg.userId}`)}
                                                        >
                                                            {senderImage ? (
                                                                <img
                                                                    src={normalizeAssetUrl(senderImage)}
                                                                    alt={senderName || 'Avatar'}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="text-xs">{senderName?.charAt(0) || '?'}</span>
                                                            )}
                                                        </div>

                                                        {/* Message bubble */}
                                                        <div
                                                            className={`rounded-lg p-3 ${isMine
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-secondary'
                                                                }`}
                                                        >
                                                            <div
                                                                className={`text-xs font-semibold mb-1 ${!isMine ? 'cursor-pointer hover:underline' : ''}`}
                                                                onClick={() => !isMine && msg.userId && navigate(`/profile/${msg.userId}`)}
                                                            >
                                                                {senderName}
                                                            </div>
                                                            {editingMessageId === msg.messageId ? (
                                                                <div className="space-y-2">
                                                                    <textarea
                                                                        value={editingText}
                                                                        onChange={(e) => setEditingText(e.target.value)}
                                                                        className="w-full rounded border border-input px-2 py-1 text-foreground bg-background text-sm"
                                                                        rows={2}
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleUpdateMessage(msg.messageId)}
                                                                            className="p-1 hover:bg-green-500/20 text-green-500 rounded"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingMessageId(null);
                                                                                setEditingText('');
                                                                            }}
                                                                            className="p-1 hover:bg-red-500/20 text-red-500 rounded"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="whitespace-pre-wrap break-words text-sm">{msg.content}</div>
                                                                    <div className="flex items-center justify-between mt-1 text-xs opacity-70">
                                                                        <span>{new Date(msg.sentAt).toLocaleTimeString()}</span>
                                                                        {isMine && (
                                                                            <div className="flex gap-1 ml-2">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingMessageId(msg.messageId);
                                                                                        setEditingText(msg.content);
                                                                                    }}
                                                                                    className="p-1 hover:bg-white/20 rounded"
                                                                                >
                                                                                    <Edit2 className="h-3 w-3" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeleteMessage(msg.messageId)}
                                                                                    className="p-1 hover:bg-white/20 rounded"
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}

                                </div>
                            );
                        })()}

                        {/* Message Input */}
                        <div className="p-4 border-t border-border">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 rounded-full border border-input px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary bg-background"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim() || isSending}
                                    className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p>Select a chat to start messaging</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Chat Modal */}
            {showCreateChat && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg w-full max-w-md mx-4 shadow-lg">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-lg font-semibold">Creează Grup Chat</h3>
                            <button onClick={() => setShowCreateChat(false)} className="p-2 hover:bg-secondary rounded">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nume Grup *</label>
                                <input
                                    type="text"
                                    value={newChatName}
                                    onChange={(e) => setNewChatName(e.target.value)}
                                    placeholder="ex: Arbitri Liga 1"
                                    className="w-full rounded border border-input px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Descriere</label>
                                <textarea
                                    value={newChatDescription}
                                    onChange={(e) => setNewChatDescription(e.target.value)}
                                    placeholder="Despre ce este acest grup? (opțional)"
                                    className="w-full rounded border border-input px-3 py-2 text-sm"
                                    rows={2}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Alți utilizatori vor putea trimite cereri pentru a se alătura grupului tău.
                            </p>
                            <button
                                onClick={handleCreateGroupChat}
                                className="w-full py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            >
                                Creează Grup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Join Requests Modal (for chat owners) */}
            {showJoinRequests && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg w-full max-w-md mx-4 shadow-lg">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-lg font-semibold">Join Requests</h3>
                            <button onClick={() => setShowJoinRequests(false)} className="p-2 hover:bg-secondary rounded">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto space-y-3">
                            {joinRequests.length === 0 ? (
                                <p className="text-center text-muted-foreground">No pending requests</p>
                            ) : (
                                joinRequests.map((req: ChatJoinRequestDto) => (
                                    <div key={req.chatJoinRequestId} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                                                {req.userProfilePicture ? (
                                                    <img src={normalizeAssetUrl(req.userProfilePicture)} alt={req.userName} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-sm">{req.userName?.charAt(0) || '?'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium">{req.userName}</div>
                                                <div className="text-xs text-muted-foreground">{req.chatName}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptRequest(req.chatJoinRequestId)}
                                                className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
                                                title="Accept"
                                            >
                                                <Check className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeclineRequest(req.chatJoinRequestId)}
                                                className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
                                                title="Decline"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* My Pending Requests Modal */}
            {showMyRequests && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-lg w-full max-w-md mx-4 shadow-lg">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-lg font-semibold">My Pending Requests</h3>
                            <button onClick={() => setShowMyRequests(false)} className="p-2 hover:bg-secondary rounded">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto space-y-3">
                            {myPendingRequests.length === 0 ? (
                                <p className="text-center text-muted-foreground">No pending requests</p>
                            ) : (
                                myPendingRequests.map((req: ChatJoinRequestDto) => (
                                    <div key={req.chatJoinRequestId} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                        <div>
                                            <div className="font-medium">{req.chatName}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Status: {req.status} • Requested: {new Date(req.requestedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        {req.status === 'Pending' && (
                                            <button
                                                onClick={() => handleCancelRequest(req.chatJoinRequestId)}
                                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Error Toast */}
            {error && (
                <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                    <span>{error}</span>
                    <button onClick={clearError} className="p-1 hover:bg-white/20 rounded">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
