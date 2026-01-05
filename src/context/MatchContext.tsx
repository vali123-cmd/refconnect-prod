import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { api, useAuth } from './AuthContext';
import { Match, MatchDto, CreateMatchDto, UpdateMatchDto, MatchAssignmentDto, CreateMatchAssignmentDto } from '../types';

interface MatchContextType {
    matches: MatchDto[];
    isLoading: boolean;
    error: string | null;
    fetchMatches: () => Promise<void>;
    createMatch: (data: CreateMatchDto) => Promise<MatchDto | null>;
    updateMatch: (id: string, data: UpdateMatchDto) => Promise<boolean>;
    deleteMatch: (id: string) => Promise<boolean>;
    delegateUser: (matchId: string, userId: string, role: string) => Promise<boolean>;
    getMatchAssignments: (matchId: string) => Promise<MatchAssignmentDto[]>;
    deleteDelegation: (assignmentId: string) => Promise<boolean>;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export const MatchProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [matches, setMatches] = useState<MatchDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper to parse score string: "Team A 2 - 1 Team B"
    // Limitations: If team name has numbers at the end, regex needs to be careful.
    // Assuming format: "{HomeTeamName} {HomeScore} - {AwayScore} {AwayTeamName}"
    const parseTeamsFromScore = (score: string): { home: string, away: string } => {
        if (!score) return { home: 'Unknown Home', away: 'Unknown Away' };

        try {
            const parts = score.split(' - ');
            if (parts.length !== 2) return { home: score, away: '' };

            const left = parts[0].trim(); // "Team Name 1"
            const right = parts[1].trim(); // "1 Team Name"

            // Regex Last digit for home score
            const homeMatch = left.match(/^(.*?)(\d+)$/);
            const homeTeam = homeMatch ? homeMatch[1].trim() : left;

            // Regex First digit for away score
            const awayMatch = right.match(/^(\d+)(.*)$/);
            const awayTeam = awayMatch ? awayMatch[2].trim() : right;

            return { home: homeTeam, away: awayTeam };
        } catch (e) {
            console.error('Error parsing score:', score, e);
            return { home: 'Parse Error', away: 'Parse Error' };
        }
    };

    const fetchMatches = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get('/Matches');
            const data = response.data || [];

            // Transform data to include parsed teams
            const transformedMatches = data.map((m: any) => {
                const { home, away } = parseTeamsFromScore(m.score || m.Score || '');
                return {
                    ...m,
                    homeTeam: home,
                    awayTeam: away
                };
            });

            setMatches(transformedMatches);
        } catch (err: any) {
            console.error('Failed to fetch matches', err);
            setError(err.message || 'Failed to fetch matches');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createMatch = async (data: CreateMatchDto): Promise<MatchDto | null> => {
        try {
            const response = await api.post('/Matches', data);
            const newMatch = response.data;
            setMatches(prev => [...prev, newMatch]);
            return newMatch;
        } catch (err: any) {
            console.error('Failed to create match', err);
            return null;
        }
    };

    const updateMatch = async (id: string, data: UpdateMatchDto): Promise<boolean> => {
        try {
            await api.put(`/Matches/${id}`, data);
            setMatches(prev => prev.map(m => m.matchId === id ? { ...m, ...data } : m));
            return true;
        } catch (err: any) {
            console.error('Failed to update match', err);
            return false;
        }
    };

    const deleteMatch = async (id: string): Promise<boolean> => {
        try {
            await api.delete(`/Matches/${id}`);
            setMatches(prev => prev.filter(m => m.matchId !== id));
            return true;
        } catch (err: any) {
            console.error('Failed to delete match', err);
            return false;
        }
    };

    // Assumes endpoint POST /api/MatchAssignments
    const delegateUser = async (matchId: string, userId: string, role: string): Promise<boolean> => {
        try {
            const payload: CreateMatchAssignmentDto = { matchId, userId, RoleInMatch: role };
            await api.post('/MatchAssignments', payload);
            return true;
        } catch (err: any) {
            console.error('Failed to delegate user', err);
            if (err.response) {
                console.error('Server error:', err.response.data);
                throw new Error(err.response.data?.message || JSON.stringify(err.response.data));
            }
            return false;
        }
    };

    // Assumes endpoint GET /api/MatchAssignments/match/{matchId} OR we filter locally if simpler
    // Based on user request "adminul sa poata delega", we need to know existing delegations.
    // If MatchesController doesn't include it, maybe there's a MatchAssignmentsController.
    // I will try GET /MatchAssignments/match/{matchId} or similar standard pattern.
    // Backend does not have /match/{id} endpoint yet.
    // We fetch ALL assignments and filter locally.
    // Also, the backend DTO does not include the User object, so we must fetch it separately to show names.
    const getMatchAssignments = async (matchId: string): Promise<MatchAssignmentDto[]> => {
        try {
            // 1. Fetch all assignments
            const response = await api.get('/MatchAssignments');
            const allAssignments: MatchAssignmentDto[] = response.data || [];

            // 2. Filter for this match
            const matchAssignments = allAssignments.filter(a => a.matchId === matchId);

            // 3. Enrich with User details (fetch names)
            // We need to fetch user info for each assignment because the DTO only has userId.
            const enrichedAssignments = await Promise.all(matchAssignments.map(async (assign) => {
                try {
                    // Try fetch user by ID. Assuming /Users/{id} or /profile/{id} works.
                    // Previous context showed profile fetching works.
                    const userResp = await api.get(`/profiles/${assign.userId}`);
                    return { ...assign, user: userResp.data };
                } catch (e) {
                    console.warn(`Failed to fetch user ${assign.userId} for assignment`, e);
                    // Return assignment without user details if fetch fails
                    return assign;
                }
            }));

            return enrichedAssignments;
        } catch (err: any) {
            console.error('Failed to fetch assignments', err);
            return [];
        }
    };

    const deleteDelegation = async (assignmentId: string): Promise<boolean> => {
        try {
            await api.delete(`/MatchAssignments/${assignmentId}`);
            return true;
        } catch (err: any) {
            console.error('Failed to delete assignment', err);
            return false;
        }
    };

    return (
        <MatchContext.Provider value={{
            matches,
            isLoading,
            error,
            fetchMatches,
            createMatch,
            updateMatch,
            deleteMatch,
            delegateUser,
            getMatchAssignments,
            deleteDelegation
        }}>
            {children}
        </MatchContext.Provider>
    );
};

export const useMatch = () => {
    const context = useContext(MatchContext);
    if (context === undefined) {
        throw new Error('useMatch must be used within a MatchProvider');
    }
    return context;
};
