import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { normalizeAssetUrl } from '../lib/utils';
import { UpdateUserDto } from '../types';
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Define types for User and AuthContext
export type UserRole = 'visitor' | 'referee' | 'admin';


export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    roles?: UserRole[];
    avatarUrl?: string;
    bio?: string;
    isPrivate?: boolean;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password?: string) => Promise<void>;
    register: (userName: string, firstName: string, lastName: string, email: string, password: string) => Promise<void>;
    updateProfile: (payload: UpdateUserDto) => Promise<any>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a shared axios instance for the app; baseURL can be set via environment variable
export const api: AxiosInstance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || undefined,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [expiryTimeoutId, setExpiryTimeoutId] = useState<number | null>(null);

    // aici am cautat cum sa parsam jwt-uri ca sa extragem data de expirare si sa programam logout automat
    const parseJwt = (jwt: string): any | null => {
        try {
            const parts = jwt.split('.');
            if (parts.length < 2) return null;
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload;
        } catch (e) {
            console.warn('Failed to parse JWT', e);
            return null;
        }
    };

    const updateProfile = async (payload: UpdateUserDto) => {
        setIsLoading(true);
        try {
            if (process.env.REACT_APP_API_URL) {
                if (!user?.id) throw new Error('User ID is required to update profile');

                // Send update to backend using PUT /Users/{id}
                const resp = await api.put(`/Users/${user.id}`, payload);
                const updated = resp?.data?.user || resp?.data;
                if (updated) {
                    // merge into our simpler User shape if needed
                    const newUser: User = {
                        id: updated.id || user?.id || '',
                        name: updated.fullName || `${updated.firstName || ''} ${updated.lastName || ''}`.trim() || updated.userName || (user?.name || ''),
                        email: updated.email || user?.email || '',
                        role: (user?.role as UserRole) || 'referee',
                        avatarUrl: normalizeAssetUrl(updated.profileImageUrl) || updated.avatarUrl || user?.avatarUrl,
                        bio: updated.description || user?.bio,
                        isPrivate: typeof updated.isProfilePublic === 'boolean' ? updated.isProfilePublic : user?.isPrivate,
                    };
                    setUser(newUser);
                    try {
                        localStorage.setItem('refconnect_user', JSON.stringify(newUser));
                    } catch (e) { }
                    return newUser;
                }
                return resp?.data;
            } else {

                const newUser: any = {
                    ...user,
                    name: `${payload.firstName} ${payload.lastName}`.trim() || payload.userName || user?.name,
                    avatarUrl: normalizeAssetUrl(payload.profileImageUrl) || user?.avatarUrl,
                    bio: payload.description || user?.bio,
                    isPrivate: payload.isProfilePublic,
                };
                setUser(newUser as User);
                try { localStorage.setItem('refconnect_user', JSON.stringify(newUser)); } catch (e) { }
                return newUser;
            }
        } finally {
            setIsLoading(false);
        }
    };

    const getTokenExpiry = (jwt: string): number | null => {
        const payload = parseJwt(jwt);
        if (!payload) return null;
        if (typeof payload.exp === 'number') return payload.exp;
        if (typeof payload.exp === 'string') return parseInt(payload.exp, 10) || null;
        return null;
    };

    const scheduleExpiryLogout = (jwt: string) => {
        const exp = getTokenExpiry(jwt);
        if (!exp) return;
        const msUntil = exp * 1000 - Date.now();
        if (expiryTimeoutId) {
            window.clearTimeout(expiryTimeoutId);
            setExpiryTimeoutId(null);
        }
        if (msUntil <= 0) {

            logoutLocal();
            return;
        }
        const id = window.setTimeout(() => {
            logoutLocal();
        }, msUntil);
        setExpiryTimeoutId(id);
    };

    const logoutLocal = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('refconnect_token');
        localStorage.removeItem('refconnect_user');
        if (expiryTimeoutId) {
            window.clearTimeout(expiryTimeoutId);
            setExpiryTimeoutId(null);
        }
        delete api.defaults.headers.common['Authorization'];
    };

    useEffect(() => {

        console.debug('REACT_APP_API_URL =', process.env.REACT_APP_API_URL);
        //daca am token salvat in localstorage, il folosesc pentru a seta userul si tokenul in context
        const storedUser = localStorage.getItem('refconnect_user');
        const storedToken = localStorage.getItem('refconnect_token');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                // Normalize any stored profile image paths to absolute URLs
                if (parsed?.profileImageUrl) {
                    try { parsed.profileImageUrl = normalizeAssetUrl(parsed.profileImageUrl); } catch (e) { }
                }
                if (parsed?.avatarUrl) {
                    try { parsed.avatarUrl = normalizeAssetUrl(parsed.avatarUrl); } catch (e) { }
                }
                setUser(parsed);
            } catch (e) {
                console.warn('Failed to parse stored user', e);
            }
        }
        if (storedToken) {
            setToken(storedToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

            if (!storedUser) {
                const payload = parseJwt(storedToken);
                if (payload) {

                    const claimName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.name || payload.fullname || payload.preferred_username || '';
                    const claimId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload.sub || payload.id || '';

                    let rolesRaw: any = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.roles || payload.role || payload['roles'];
                    let rolesArr: string[] = [];
                    if (rolesRaw) {
                        rolesArr = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
                    }
                    const primaryRoleStr = (rolesArr[0] || payload.role || 'referee') as string;
                    const primaryRole = (primaryRoleStr.toLowerCase()) as UserRole;
                    const derivedUser: User = {
                        id: claimId,
                        name: claimName,
                        email: payload.email || claimName || '',
                        role: primaryRole,
                        roles: (rolesArr as UserRole[])
                    };
                    setUser(derivedUser);
                    try {
                        localStorage.setItem('refconnect_user', JSON.stringify(derivedUser));
                    } catch (e) {

                    }
                }
            }

            try {
                scheduleExpiryLogout(storedToken);
            } catch (e) {

            }
        }

        setIsLoading(false);

        // Request interceptor: ensure token is attached to every request (reads latest token from localStorage)
        const reqInterceptor = api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
            const t = localStorage.getItem('refconnect_token');
            if (t && config) {
                // Axios' InternalAxiosRequestConfig.headers type is compatible with assignment like below
                config.headers = config.headers || {};
                (config.headers as any)['Authorization'] = `Bearer ${t}`;
            }
            return config;
        });


        const resInterceptor = api.interceptors.response.use(
            (response: AxiosResponse) => response,
            (error) => {
                if (error?.response?.status === 401) {
                    // If we don't have a token, don't aggressively clear storage.
                    // This avoids a race where an unauthenticated call (or missing token)
                    // nukes a valid session before hydration finishes.
                    const existing = localStorage.getItem('refconnect_token');
                    if (existing) {
                        setUser(null);
                        setToken(null);
                        localStorage.removeItem('refconnect_token');
                        localStorage.removeItem('refconnect_user');
                        delete api.defaults.headers.common['Authorization'];
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.request.eject(reqInterceptor);
            api.interceptors.response.eject(resInterceptor);
        };
    }, []);


    const login = async (email: string, password?: string) => {
        setIsLoading(true);
        try {
            if (process.env.REACT_APP_API_URL) {

                const resp = await api.post('/account/login', { email, password });
                const { token: receivedToken, user: receivedUser } = resp.data;
                if (!receivedToken) throw new Error('No token returned from API');

                setToken(receivedToken);
                localStorage.setItem('refconnect_token', receivedToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
                // schedule auto-logout on token expiry (server sets expires +1 hour)
                try {
                    scheduleExpiryLogout(receivedToken);
                } catch (e) {
                    /* ignore */
                }

                if (receivedUser) {
                    // Normalize any returned profile image URL
                    if (receivedUser.profileImageUrl) {
                        try { receivedUser.profileImageUrl = normalizeAssetUrl(receivedUser.profileImageUrl); } catch (e) { }
                    }
                    setUser(receivedUser);
                    try {
                        localStorage.setItem('refconnect_user', JSON.stringify(receivedUser));
                    } catch (e) {
                        /* ignore */
                    }
                } else {
                    // Backend didn't return user object: try to derive from JWT
                    const payload = parseJwt(receivedToken);
                    if (payload) {
                        const claimName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.name || payload.fullname || payload.preferred_username || '';
                        const claimId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload.sub || payload.id || '';
                        let rolesRaw: any = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.roles || payload.role || payload['roles'];
                        let rolesArr: string[] = [];
                        if (rolesRaw) rolesArr = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
                        const primaryRoleStr = (rolesArr[0] || payload.role || 'referee') as string;
                        const primaryRole = (primaryRoleStr.toLowerCase()) as UserRole;
                        const derivedUser: User = {
                            id: claimId,
                            name: claimName,
                            email: payload.email || claimName || '',
                            role: primaryRole,
                            roles: (rolesArr as UserRole[])
                        };
                        setUser(derivedUser);
                        try {
                            localStorage.setItem('refconnect_user', JSON.stringify(derivedUser));
                        } catch (e) {
                            /* ignore */
                        }
                    } else {
                        setUser(null);
                    }
                }
            } else {
                // Mock behavior (keeps existing app behavior while providing a token)
                await new Promise((resolve) => setTimeout(resolve, 400));
                const mockToken = 'mock-jwt-token-' + Math.random().toString(36).slice(2);
                const mockUser: User = {
                    id: '1',
                    name: 'John Doe',
                    email,
                    role: 'referee',
                    avatarUrl: 'https://github.com/shadcn.png',
                    bio: 'Professional Referee | FIFA Badge',
                    isPrivate: false,
                };

                setToken(mockToken);
                setUser(mockUser);
                localStorage.setItem('refconnect_token', mockToken);
                localStorage.setItem('refconnect_user', JSON.stringify(mockUser));
                api.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
            }
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userName: string, firstName: string, lastName: string, email: string, password: string) => {
        setIsLoading(true);
        try {
            if (process.env.REACT_APP_API_URL) {
                const payload = {
                    userName,
                    email,
                    password,
                    firstName,
                    lastName,
                    description: '',
                    profileImageUrl: ''
                };
                // Debug: log payload about to be sent
                // eslint-disable-next-line no-console
                console.debug('Register payload', payload);
                let resp;
                try {
                    resp = await api.post('/account/register', payload);
                } catch (err: any) {
                    // Log axios error details to help debugging
                    // eslint-disable-next-line no-console
                    console.error('Register request failed', err?.response?.status, err?.response?.data || err.message || err);
                    throw err;
                }
                // Expecting { token } (or { token, user })
                const { token: receivedToken, user: receivedUser } = resp.data;
                if (!receivedToken) throw new Error('No token returned from register');

                setToken(receivedToken);
                localStorage.setItem('refconnect_token', receivedToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
                try {
                    scheduleExpiryLogout(receivedToken);
                } catch (e) {
                    /* ignore */
                }

                if (receivedUser) {
                    setUser(receivedUser);
                    try {
                        localStorage.setItem('refconnect_user', JSON.stringify(receivedUser));
                    } catch (e) { }
                } else {
                    const payload = parseJwt(receivedToken);
                    if (payload) {
                        const claimName = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || payload.name || payload.fullname || payload.preferred_username || `${firstName} ${lastName}` || '';
                        const claimId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload.sub || payload.id || '';
                        let rolesRaw: any = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || payload.roles || payload.role || payload['roles'];
                        let rolesArr: string[] = [];
                        if (rolesRaw) rolesArr = Array.isArray(rolesRaw) ? rolesRaw : [rolesRaw];
                        const primaryRoleStr = (rolesArr[0] || payload.role || 'referee') as string;
                        const primaryRole = (primaryRoleStr.toLowerCase()) as UserRole;
                        const derivedUser: User = {
                            id: claimId,
                            name: claimName,
                            email: payload.email || email,
                            role: primaryRole,
                            roles: (rolesArr as UserRole[])
                        };
                        setUser(derivedUser);
                        try { localStorage.setItem('refconnect_user', JSON.stringify(derivedUser)); } catch (e) { }
                    }
                }
            } else {
                // fallback mock behavior
                await new Promise((resolve) => setTimeout(resolve, 400));
                const mockToken = 'mock-jwt-token-' + Math.random().toString(36).slice(2);
                const mockUser: User = {
                    id: '1',
                    name: `${firstName} ${lastName}`,
                    email,
                    role: 'referee',
                };
                setToken(mockToken);
                setUser(mockUser);
                localStorage.setItem('refconnect_token', mockToken);
                localStorage.setItem('refconnect_user', JSON.stringify(mockUser));
                api.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
            }
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('refconnect_token');
        localStorage.removeItem('refconnect_user');
        delete api.defaults.headers.common['Authorization'];
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, updateProfile, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
