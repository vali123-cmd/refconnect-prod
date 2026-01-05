import React, { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { ClipboardList, UserPlus, Check, X, Shield, Calendar, MapPin, Loader2, Trash2 } from 'lucide-react';
import { MatchDto, MatchAssignmentDto, UserDto } from '../types';
import { normalizeAssetUrl, isUserActive } from '../lib/utils';

export default function Delegations() {
    const { user } = useAuth();
    const { matches, fetchMatches, delegateUser, getMatchAssignments, deleteDelegation } = useMatch();
    const [assignmentsMap, setAssignmentsMap] = useState<Record<string, MatchAssignmentDto[]>>({});
    const [isLoadingData, setIsLoadingData] = useState(false);

    // Delegation Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [availableUsers, setAvailableUsers] = useState<UserDto[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const isAdmin = user?.role?.toLowerCase() === 'admin';

    useEffect(() => {
        const load = async () => {
            setIsLoadingData(true);
            await fetchMatches();
            setIsLoadingData(false);
        };
        load();
    }, [fetchMatches]);

    // Fetch assignments for matches whenever matches change
    useEffect(() => {
        const fetchAllAssignments = async () => {
            const map: Record<string, MatchAssignmentDto[]> = {};
            // Fetch in parallel
            await Promise.all(matches.map(async (m) => {
                try {
                    const assigns = await getMatchAssignments(m.matchId);
                    map[m.matchId] = assigns;
                } catch (e) {
                    console.warn(`Could not fetch assignments for match ${m.matchId}`, e);
                    map[m.matchId] = [];
                }
            }));
            setAssignmentsMap(map);
        };
        if (matches.length > 0) {
            fetchAllAssignments();
        }
    }, [matches, getMatchAssignments]);

    const handleOpenDelegateModal = async (matchId: string) => {
        setSelectedMatchId(matchId);
        setIsModalOpen(true);
        setIsLoadingUsers(true);
        try {
            // Fetch all profiles to select from (public endpoint)
            const resp = await api.get('/profiles');
            const data = Array.isArray(resp.data) ? resp.data : (resp.data?.items || []);
            setAvailableUsers(data);
        } catch (e) {
            console.error('Failed to fetch users', e);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleDelegateUser = async (userId: string) => {
        if (!selectedMatchId) return;
        const currentAssigns = assignmentsMap[selectedMatchId] || [];

        if (currentAssigns.length >= 4) {
            alert('Maximum 4 delegations allowed per match.');
            return;
        }
        if (currentAssigns.some(a => a.userId === userId)) {
            alert('User is already delegated to this match.');
            return;
        }

        const success = await delegateUser(selectedMatchId, userId, 'Referee'); // Default role
        if (success) {
            // Refresh assignments for this match
            const updated = await getMatchAssignments(selectedMatchId);
            setAssignmentsMap(prev => ({ ...prev, [selectedMatchId]: updated }));
            setIsModalOpen(false);
            setSelectedMatchId(null);
        } else {
            alert('Failed to delegate user.');
        }
    };

    const handleRemoveDelegation = async (assignmentId: string, matchId: string) => {
        if (!window.confirm('Ești sigur că vrei să ștergi această delegare?')) return;

        const success = await deleteDelegation(assignmentId);
        if (success) {
            const updated = await getMatchAssignments(matchId);
            setAssignmentsMap(prev => ({ ...prev, [matchId]: updated }));
        } else {
            alert('Nu s-a putut șterge delegarea.');
        }
    };

    const myDelegations = matches.filter(m => {
        const assigns = assignmentsMap[m.matchId] || [];
        return assigns.some(a => a.userId === user?.id);
    });

    // Helper to filter users in modal
    const filteredUsers = availableUsers.filter(u => {
        if (!isUserActive(u)) return false;
        const q = searchQuery.toLowerCase();
        const name = (u.fullName || u.userName || '').toLowerCase();
        return name.includes(q);
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Delegări</h1>
                <p className="text-sm text-muted-foreground">Vizualizează delegările tale viitoare și trecute.</p>
            </div>

            {/* My Delegations Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Delegările Mele</h2>
                {isLoadingData ? (
                    <div className="text-sm text-muted-foreground">Se încarcă...</div>
                ) : myDelegations.length === 0 ? (
                    <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                <ClipboardList className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-lg">Nu ai delegări momentan</h3>
                            <p className="text-muted-foreground max-w-sm">
                                Când vei fi delegat la un meci, acesta va apărea aici.
                            </p>
                        </div>
                    </div>
                ) : (
                    myDelegations.map(m => (
                        <MatchCard key={m.matchId} match={m} assignments={assignmentsMap[m.matchId] || []} />
                    ))
                )}
            </div>

            {/* Admin Section: All Matches to Delegate */}
            {isAdmin && (
                <div className="space-y-4 pt-8 border-t border-border">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Shield className="h-5 w-5 text-red-600" />
                        Admin: Gestionează Delegări
                    </h2>
                    <div className="grid gap-4">
                        {matches.map(m => (
                            <MatchCard
                                key={m.matchId}
                                match={m}
                                assignments={assignmentsMap[m.matchId] || []}
                                isAdmin={isAdmin}
                                onDelegate={() => handleOpenDelegateModal(m.matchId)}
                                onRemoveDelegation={(assignId) => handleRemoveDelegation(assignId, m.matchId)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Delegation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold text-lg">Alege Arbitru</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-muted rounded-full">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-border">
                            <input
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                                placeholder="Caută arbitru..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {isLoadingUsers ? (
                                <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6" /></div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredUsers.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => handleDelegateUser(u.id)}
                                            className="w-full flex items-center gap-3 p-2 hover:bg-secondary rounded-lg text-left transition-colors"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-muted overflow-hidden shrink-0">
                                                {u.profileImageUrl ? (
                                                    <img src={normalizeAssetUrl(u.profileImageUrl)} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold">
                                                        {(u.firstName?.[0] || u.userName?.[0] || '?').toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{u.fullName || u.userName}</div>
                                                <div className="text-xs text-muted-foreground">@{u.userName}</div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredUsers.length === 0 && <div className="text-center p-4 text-sm text-muted-foreground">Nu am găsit utilizatori.</div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MatchCard({ match, assignments, isAdmin, onDelegate, onRemoveDelegation }: { match: MatchDto, assignments: MatchAssignmentDto[], isAdmin?: boolean, onDelegate?: () => void, onRemoveDelegation?: (id: string) => void }) {
    const isFull = assignments.length >= 4;

    return (
        <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-lg mb-1">{match.homeTeam} vs {match.awayTeam}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            {new Date(match.matchDate).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {match.location}
                        </div>
                    </div>
                </div>
                {isFull && (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" /> Complet
                    </span>
                )}
            </div>

            <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Oficiali Delegați ({assignments.length}/4)</span>
                    {isAdmin && !isFull && (
                        <button
                            onClick={onDelegate}
                            className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full flex items-center gap-1 hover:opacity-90"
                        >
                            <UserPlus className="h-3 w-3" /> Delegă
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {assignments.length > 0 ? assignments.map((assign, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-secondary rounded-full pl-1 pr-3 py-1 text-sm group border border-border">
                            <div className="h-6 w-6 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border/50">
                                {assign.user?.profileImageUrl ? (
                                    <img src={normalizeAssetUrl(assign.user.profileImageUrl)} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold">
                                        {(assign.user?.firstName?.[0] || assign.user?.userName?.[0] || '?').toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="font-medium">{assign.user?.fullName || assign.user?.userName || 'User'}</span>
                            {isAdmin && onRemoveDelegation && (
                                <button
                                    onClick={() => onRemoveDelegation(assign.matchAssignmentId)}
                                    className="p-1 rounded-full hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Șterge delegarea"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )) : (
                        <span className="text-sm text-muted-foreground italic">Niciun arbitru delegat încă.</span>
                    )}
                </div>
            </div>
        </div>
    );
}
