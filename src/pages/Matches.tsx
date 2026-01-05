import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { Calendar, MapPin, CheckCircle } from 'lucide-react';

export default function Matches() {
    const { user } = useAuth();
    const { matches, fetchMatches, isLoading, error } = useMatch();

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const isAdmin = user?.role?.toLowerCase() === 'admin';

    // Helper to format date
    const formatDate = (dateStr: string | Date | undefined) => {
        if (!dateStr) return 'TBA';
        return new Date(dateStr).toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Matches</h1>
                <p className="text-sm text-muted-foreground">Upcoming fixtures.</p>
            </div>

            <div className="space-y-4">
                {matches.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        No matches scheduled yet.
                    </div>
                ) : (
                    matches.map(match => (
                        <div key={match.matchId} className="bg-card border border-border rounded-lg p-5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg mb-1">{match.homeTeam} vs {match.awayTeam}</h3>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-4 w-4" />
                                            {formatDate(match.matchDate)}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-4 w-4" />
                                            {match.location}
                                        </div>
                                    </div>
                                    {match.score && (
                                        <div className="mt-2 text-sm font-semibold">
                                            Score: {match.score}
                                        </div>
                                    )}
                                </div>
                                {match.status === 'Completed' && (
                                    <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" /> Completed
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
