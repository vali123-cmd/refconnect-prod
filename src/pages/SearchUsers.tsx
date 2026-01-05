import React, { useState } from 'react';
import { Search as SearchIcon, UserPlus, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { isUserActive, normalizeAssetUrl } from '../lib/utils';

export default function SearchUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch users (server-side search)
    React.useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                // If no search term, fetch all profiles; otherwise search
                const targetUrl = searchTerm
                    ? `/Profiles/search?query=${encodeURIComponent(searchTerm)}`
                    : `/profiles`;
                const response = await api.get(targetUrl);



                const mappedData = Array.isArray(response.data)
                    ? response.data.map((user: any) => ({
                        ...user,

                        id: user.id
                    }))
                    : [];

                if (Array.isArray(response.data)) {
                    setUsers(mappedData);
                } else if (response.data && Array.isArray(response.data.items)) {
                    setUsers(response.data.items);
                } else {
                    setUsers([]);
                }
                setError(null);
            } catch (err: any) {
                console.error('Failed to load users', err);
                setError('Failed to load users');
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce to avoid too many requests
        const timeoutId = setTimeout(() => {
            fetchUsers();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    // Filter deleted users
    const filteredUsers = users.filter(isUserActive);

    return (
        <div className="space-y-6">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                    type="text"
                    className="block w-full rounded-full border border-input bg-secondary/50 py-2.5 pl-10 pr-4 text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background transition-colors"
                    placeholder="Search referees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground px-1">
                    {searchTerm ? 'Results' : 'All Users'}
                </h2>

                <div className="flex flex-col gap-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">
                            {error}
                        </div>
                    ) : filteredUsers.length > 0 ? filteredUsers.map(user => {
                        console.log('Rendering user:', user.id, user.userName, user.fullName);
                        return (
                            <div key={user.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                                        {user.profileImageUrl ? (
                                            <img src={user.profileImageUrl} alt={user.userName} className="h-full w-full object-cover" />
                                        ) : (
                                            <User className="h-5 w-5 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <Link to={`/profile/${user.id}`} className="font-medium hover:underline text-sm block">
                                            {user.fullName || user.userName}
                                        </Link>
                                        <span className="text-xs text-muted-foreground lowercase">{user.role || 'User'}</span>
                                        {user.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-1">{user.description}</p>
                                        )}
                                    </div>
                                </div>
                                <Link to={`/profile/${user.id}`} className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors">
                                    <UserPlus className="h-4 w-4" />
                                </Link>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No users found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
