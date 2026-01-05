import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../context/AuthContext';

function MatchCard({ ma }: { ma: any }) {
    const match = ma.match || ma;
    const assignedAt = ma.assignedAt ? new Date(ma.assignedAt).toLocaleString() : (ma.joinedAt ? new Date(ma.joinedAt).toLocaleString() : '—');
    return (
        <div className="p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-semibold">{match.homeTeam} vs {match.awayTeam}</div>
                    <div className="text-xs text-muted-foreground">{match.location} • {match.championshipId || ''}</div>
                    <div className="text-xs text-muted-foreground">{match.matchDate ? new Date(match.matchDate).toLocaleString() : ''}</div>
                </div>
                <div className="text-right text-sm">
                    <div className="font-medium">Role: {ma.role || ma.userRole || '—'}</div>
                    <div className="text-xs text-muted-foreground">Assigned: {assignedAt}</div>
                </div>
            </div>
        </div>
    );
}

export default function ProfileMatches() {
    const { id } = useParams<{ id: string }>();
    const [matchAssignments, setMatchAssignments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                // Try extended first since it contains full match assignments
                try {
                    const ext = await api.get(`/profiles/${id}/extended`);
                    if (!mounted) return;
                    setMatchAssignments(ext.data.matchAssignments || []);
                    return;
                } catch (err: any) {
                    if (err?.response?.status === 403) {
                        const basic = await api.get(`/profiles/${id}`);
                        if (!mounted) return;
                        setMatchAssignments(basic.data.matchAssignments || []);
                        return;
                    }
                    throw err;
                }
            } catch (err: any) {
                console.error('Failed to fetch match assignments', err);
                if (!mounted) return;
                setError(err?.message || 'Failed to load');
            } finally {
                if (!mounted) return;
                setIsLoading(false);
            }
        };
        fetch();
        return () => { mounted = false; };
    }, [id]);

    if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading match assignments...</div>;
    if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Match assignments</h2>
                <Link to={`/profile/${id}`} className="text-sm text-primary hover:underline">Back to profile</Link>
            </div>

            {matchAssignments.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground bg-card border border-border rounded-lg">No match assignments found.</div>
            ) : (
                <div className="space-y-4">
                    {matchAssignments.map((ma) => (
                        <MatchCard key={ma.matchAssignmentId || ma.matchId || Math.random()} ma={ma} />
                    ))}
                </div>
            )}
        </div>
    );
}
