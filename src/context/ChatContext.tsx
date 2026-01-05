import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { api } from './AuthContext';
import {
    ChatDto,
    ChatDtoPascalCase,
    MessageDto,
    MessageDtoPascalCase,
    CreateMessageDto,
    UpdateChatDto,
    UpdateMessageDto,
    ChatJoinRequestDto,
    CreateChatJoinRequestDto
} from '../types';

const isChatDtoPascalCase = (value: any): value is ChatDtoPascalCase => {
    return (
        value &&
        typeof value === 'object' &&
        typeof value.ChatId === 'string' &&
        typeof value.ChatType === 'string'
    );
};

const mapMessageFromPascalCase = (m: MessageDtoPascalCase): MessageDto => ({
    messageId: m.MessageId,
    chatId: m.ChatId,
    userId: m.UserId,
    content: m.Content,
    sentAt: m.SentAt,
});

const mapChatFromPascalCase = (c: ChatDtoPascalCase): ChatDto => ({
    chatId: c.ChatId,
    chatType: c.ChatType,
    createdAt: c.CreatedAt,
    name: c.Name,
    description: c.Description,
    createdByUserId: c.CreatedByUserId,
    chatUsers: (c.ChatUsers || []).map(u => ({
        chatUserId: u.ChatUserId,
        chatId: u.ChatId,
        userId: u.UserId,
    })),
    messages: c.Messages ? c.Messages.map(mapMessageFromPascalCase) : null,
});

const coerceChatsResponse = (data: any): ChatDto[] => {
    const arr = Array.isArray(data) ? data : [];
    return arr
        .map((item: any) => (isChatDtoPascalCase(item) ? mapChatFromPascalCase(item) : item))
        .map((c: any) => {
            // Defensive normalization for backend responses like:
            // chatUsers: [...] and messages: null
            const normalized: ChatDto = {
                ...c,
                name: typeof c?.name === 'string' ? c.name : '',
                chatUsers: Array.isArray(c?.chatUsers) ? c.chatUsers : [],
                messages: Array.isArray(c?.messages) ? c.messages : [],
            };
            return normalized;
        });
};

interface ChatContextType {
    chats: ChatDto[];
    allGroupChats: ChatDto[];
    currentChat: ChatDto | null;
    messages: MessageDto[];
    joinRequests: ChatJoinRequestDto[];
    myPendingRequests: ChatJoinRequestDto[];
    isLoading: boolean;
    error: string | null;
    fetchChats: () => Promise<void>;
    isMemberOfChat: (chatId: string, userId: string) => Promise<boolean>;
    fetchMessages: (chatId: string) => Promise<void>;
    sendMessage: (chatId: string, content: string) => Promise<MessageDto | null>;
    updateMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    createGroupChat: (name: string, description: string, userIds: string[]) => Promise<ChatDto | null>;
    updateChat: (chatId: string, name?: string, description?: string) => Promise<void>;
    deleteChat: (chatId: string) => Promise<void>;
    removeChatMember: (chatId: string, userId: string) => Promise<void>;
    requestJoinChat: (chatId: string) => Promise<void>;
    fetchJoinRequestsForOwner: () => Promise<void>;
    fetchJoinRequestsForChat: (chatId: string) => Promise<void>;
    fetchMyPendingRequests: () => Promise<void>;
    acceptJoinRequest: (requestId: string) => Promise<void>;
    declineJoinRequest: (requestId: string) => Promise<void>;
    cancelJoinRequest: (requestId: string) => Promise<void>;
    setCurrentChat: (chat: ChatDto | null) => void;
    clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const [chats, setChats] = useState<ChatDto[]>([]);
    const [allGroupChats, setAllGroupChats] = useState<ChatDto[]>([]);
    const [currentChat, setCurrentChat] = useState<ChatDto | null>(null);
    const [messages, setMessages] = useState<MessageDto[]>([]);
    const [joinRequests, setJoinRequests] = useState<ChatJoinRequestDto[]>([]);
    const [myPendingRequests, setMyPendingRequests] = useState<ChatJoinRequestDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cache sender profiles so we don't spam requests while scrolling in chat.
    // We store a minimal subset needed for messages.
    const senderCacheRef = useRef<Record<string, { displayName: string; profileImageUrl: string | null } | null>>({});

    const clearError = () => setError(null);

    const isMemberOfChat = async (chatId: string, userId: string): Promise<boolean> => {
        if (!chatId || !userId) return false;
        try {
            // TEMP DEBUG: confirm inputs sent to membership endpoint
            console.log('[Chats][isMemberOfChat] checking', {
                chatId,
                userId,
                hasToken: !!localStorage.getItem('refconnect_token'),
            });

            const resp = await api.get(`/Chats/${chatId}/is-member/${userId}`);

            // TEMP DEBUG: inspect backend response shape
            console.log('[Chats][isMemberOfChat] response', {
                chatId,
                userId,
                status: resp?.status,
                data: resp?.data,
            });

            // Accept either boolean or { isMember: boolean }
            const computed =
                typeof resp.data === 'boolean'
                    ? resp.data
                    : resp.data && typeof resp.data.isMember === 'boolean'
                        ? resp.data.isMember
                        : !!resp.data;

            // TEMP DEBUG: show computed boolean
            console.log('[Chats][isMemberOfChat] computed', { chatId, userId, computed });
            return computed;
        } catch (e: any) {
            console.log('[Chats][isMemberOfChat] error', {
                chatId,
                userId,
                status: e?.response?.status,
                data: e?.response?.data,
            });
            return false;
        }
    };

    const getSenderProfile = async (userId: string): Promise<{ displayName: string; profileImageUrl: string | null } | null> => {
        if (!userId) return null;
        if (Object.prototype.hasOwnProperty.call(senderCacheRef.current, userId)) {
            return senderCacheRef.current[userId] || null;
        }

        try {
            // Same endpoint used elsewhere in the app (PostCard, Comments, ProfileView)
            const r = await api.get(`/profiles/${userId}`);
            const prof = r?.data;
            const displayName =
                (prof?.firstName || prof?.lastName)
                    ? `${prof?.firstName || ''} ${prof?.lastName || ''}`.trim()
                    : (prof?.fullName || prof?.userName || 'Utilizator');
            const profileImageUrl = (typeof prof?.profileImageUrl === 'string' && prof.profileImageUrl.trim())
                ? prof.profileImageUrl
                : null;

            const mapped = { displayName, profileImageUrl };
            senderCacheRef.current[userId] = mapped;
            return mapped;
        } catch (e) {
            senderCacheRef.current[userId] = null;
            return null;
        }
    };

    const enrichMessagesWithSenders = async (list: MessageDto[]) => {
        if (!Array.isArray(list) || list.length === 0) return;

        const missing = Array.from(new Set(list.map(m => m?.userId).filter(Boolean))) as string[];

        const toFetch = missing.filter(id => !Object.prototype.hasOwnProperty.call(senderCacheRef.current, id));
        if (toFetch.length === 0) return;

        await Promise.all(toFetch.map(id => getSenderProfile(id)));

        // No-op here: the UI will pick up cached sender info by userId.
    };

    // Fetch all chats for current user
    const fetchChats = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/Chats');
            const normalized = coerceChatsResponse(response.data);
            setChats(normalized);
            // `/Chats` is the only source of truth for group chats now.
            // Keep `allGroupChats` in sync for any UI that still relies on it.
            setAllGroupChats(normalized);
        } catch (err: any) {
            console.error('Failed to fetch chats:', err);
            setError('Failed to load chats');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch messages for a specific chat
    const fetchMessages = async (chatId: string) => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('refconnect_token');
            if (!token) {
                setError('Not authenticated. Please login again.');
                setMessages([]);
                return;
            }
            // Backend endpoint: GET /Messages/Chat/{chatId}
            const response = await api.get(`/Messages/Chat/${chatId}`);
            const raw = Array.isArray(response.data) ? response.data : [];
            // Some backends may return PascalCase despite DTO updates, so coerce a bit defensively.
            const normalized: MessageDto[] = raw.map((m: any) => {
                if (m && typeof m === 'object' && typeof m.MessageId === 'string') {
                    return mapMessageFromPascalCase(m as MessageDtoPascalCase);
                }
                // camelCase fallback
                return {
                    messageId: m.messageId,
                    chatId: m.chatId,
                    userId: m.userId,
                    content: m.content,
                    sentAt: m.sentAt,
                } as MessageDto;
            });
            // Sort by Date Ascending (oldest first)
            normalized.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
            setMessages(normalized);
            // Fire-and-forget enrichment (awaited here so immediate render improves quickly).
            await enrichMessagesWithSenders(normalized);
        } catch (err: any) {
            console.error('Failed to fetch messages:', err);
            const status = err?.response?.status;
            if (status === 403) {
                setError('Forbidden (403): you may not be a member of this chat or your session expired.');
            } else if (status === 401) {
                setError('Unauthorized (401): please login again.');
            } else {
                setError('Failed to load messages');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Send a new message
    const sendMessage = async (chatId: string, content: string): Promise<MessageDto | null> => {
        try {
            const storedUser = localStorage.getItem('refconnect_user');
            const parsedUser = storedUser ? (JSON.parse(storedUser) as { id?: string } | null) : null;
            const userId = parsedUser?.id;

            if (!userId) {
                throw new Error('Missing user id. Please re-login.');
            }

            const payload: CreateMessageDto = { chatId, content, userId };
            const response = await api.post('/Messages', payload);

            if (response.data) {
                const raw = response.data;
                const normalized: MessageDto = (raw && typeof raw === 'object' && typeof raw.MessageId === 'string')
                    ? mapMessageFromPascalCase(raw as MessageDtoPascalCase)
                    : ({
                        messageId: raw.messageId,
                        chatId: raw.chatId,
                        userId: raw.userId,
                        content: raw.content,
                        sentAt: raw.sentAt,
                    } as MessageDto);

                // Warm the profile cache for the current sender so UI can show name/avatar.
                await getSenderProfile(userId);

                setMessages(prev => [...prev, normalized]);
                return normalized;
            }
            return null;
        } catch (err: any) {
            console.error('Failed to send message:', err);
            setError('Failed to send message');
            throw err;
        }
    };

    // Update a message
    const updateMessage = async (messageId: string, content: string) => {
        try {
            const payload: UpdateMessageDto = { content };
            await api.put(`/Messages/${messageId}`, payload);

            setMessages(prev => prev.map(msg =>
                msg.messageId === messageId
                    ? { ...msg, content }
                    : msg
            ));
        } catch (err: any) {
            console.error('Failed to update message:', err);
            setError('Failed to update message');
            throw err;
        }
    };

    // Delete a message
    const deleteMessage = async (messageId: string) => {
        try {
            await api.delete(`/Messages/${messageId}`);
            setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
        } catch (err: any) {
            console.error('Failed to delete message:', err);
            setError('Failed to delete message');
            throw err;
        }
    };

    // Create a group chat
    const createGroupChat = async (name: string, description: string, userIds: string[]): Promise<ChatDto | null> => {
        try {
            // NOTE: Backend validation expects `GroupName` (not `name`).
            // We'll keep the UI-friendly function signature and map to backend DTO here.
            const payload = {
                GroupName: name,
                Description: description || undefined,
                InitialUserIds: userIds,
            };
            console.log('Creating group chat with payload:', JSON.stringify(payload, null, 2));
            const response = await api.post('/Chats/group', payload);
            console.log('Group chat created:', response.data);

            if (response.data) {
                setChats(prev => [...prev, response.data]);
                return response.data;
            }
            return null;
        } catch (err: any) {
            console.error('Failed to create group chat:', err);
            console.error('Error response:', err.response?.data);
            console.error('Error status:', err.response?.status);
            setError('Failed to create group chat');
            throw err;
        }
    };

    // Update a chat
    const updateChat = async (chatId: string, name?: string, description?: string) => {
        try {
            const payload: UpdateChatDto = { name, description };
            await api.put(`/Chats/${chatId}`, payload);

            setChats(prev => prev.map(chat =>
                chat.chatId === chatId
                    ? { ...chat, ...(name && { name }), ...(description && { description }) }
                    : chat
            ));

            if (currentChat?.chatId === chatId) {
                setCurrentChat(prev => prev ? { ...prev, ...(name && { name }), ...(description && { description }) } : null);
            }
        } catch (err: any) {
            console.error('Failed to update chat:', err);
            setError('Failed to update chat');
            throw err;
        }
    };

    // Delete a chat
    const deleteChat = async (chatId: string) => {
        try {
            await api.delete(`/Chats/${chatId}`);
            setChats(prev => prev.filter(chat => chat.chatId !== chatId));

            if (currentChat?.chatId === chatId) {
                setCurrentChat(null);
                setMessages([]);
            }
        } catch (err: any) {
            console.error('Failed to delete chat:', err);
            setError('Failed to delete chat');
            throw err;
        }
    };

    // Remove a member from a chat (admin/creator)
    const removeChatMember = async (chatId: string, userId: string) => {
        try {
            await api.delete(`/Chats/${chatId}/members/${userId}`);

            // Best-effort local state update: remove the user from the chatUsers list.
            setChats(prev => prev.map(c => {
                if (c.chatId !== chatId) return c;
                return {
                    ...c,
                    chatUsers: Array.isArray(c.chatUsers) ? c.chatUsers.filter(u => u.userId !== userId) : [],
                };
            }));

            if (currentChat?.chatId === chatId) {
                setCurrentChat(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        chatUsers: Array.isArray(prev.chatUsers) ? prev.chatUsers.filter(u => u.userId !== userId) : [],
                    };
                });
            }
        } catch (err: any) {
            console.error('Failed to remove chat member:', err);
            setError('Failed to remove member');
            throw err;
        }
    };

    // Request to join a chat
    const requestJoinChat = async (chatId: string) => {
        try {
            const payload: CreateChatJoinRequestDto = { chatId };
            await api.post('/ChatJoinRequests', payload);
        } catch (err: any) {
            console.error('Failed to request join chat:', err);
            setError('Failed to send join request');
            throw err;
        }
    };

    // Fetch join requests for chats you own
    const fetchJoinRequestsForOwner = async () => {
        try {
            const response = await api.get('/ChatJoinRequests/owner');
            setJoinRequests(response.data || []);
        } catch (err: any) {
            console.error('Failed to fetch join requests:', err);
        }
    };

    // Fetch join requests for a specific chat
    const fetchJoinRequestsForChat = async (chatId: string) => {
        try {
            const response = await api.get(`/ChatJoinRequests/chat/${chatId}`);
            setJoinRequests(response.data || []);
        } catch (err: any) {
            console.error('Failed to fetch join requests for chat:', err);
        }
    };

    // Fetch your own pending requests
    const fetchMyPendingRequests = async () => {
        try {
            const response = await api.get('/ChatJoinRequests/my-requests');
            setMyPendingRequests(response.data || []);
        } catch (err: any) {
            console.error('Failed to fetch my pending requests:', err);
        }
    };

    // Accept a join request
    const acceptJoinRequest = async (requestId: string) => {
        try {
            await api.post(`/ChatJoinRequests/${requestId}/accept`);
            setJoinRequests(prev => prev.filter(req => req.chatJoinRequestId !== requestId));
        } catch (err: any) {
            console.error('Failed to accept join request:', err);
            setError('Failed to accept request');
            throw err;
        }
    };

    // Decline a join request
    const declineJoinRequest = async (requestId: string) => {
        try {
            await api.post(`/ChatJoinRequests/${requestId}/decline`);
            setJoinRequests(prev => prev.filter(req => req.chatJoinRequestId !== requestId));
        } catch (err: any) {
            console.error('Failed to decline join request:', err);
            setError('Failed to decline request');
            throw err;
        }
    };

    // Cancel your own pending request
    const cancelJoinRequest = async (requestId: string) => {
        try {
            await api.delete(`/ChatJoinRequests/${requestId}`);
            setMyPendingRequests(prev => prev.filter(req => req.chatJoinRequestId !== requestId));
        } catch (err: any) {
            console.error('Failed to cancel join request:', err);
            setError('Failed to cancel request');
            throw err;
        }
    };

    return (
        <ChatContext.Provider value={{
            chats,
            allGroupChats,
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
            updateChat,
            deleteChat,
            removeChatMember,
            requestJoinChat,
            fetchJoinRequestsForOwner,
            fetchJoinRequestsForChat,
            fetchMyPendingRequests,
            acceptJoinRequest,
            declineJoinRequest,
            cancelJoinRequest,
            setCurrentChat,
            clearError
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
