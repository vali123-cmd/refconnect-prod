import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CreatePost from '../components/CreatePost';
import Feed from '../components/Feed';
import { ClipboardList, Trophy, MessageSquare } from 'lucide-react';

export default function Home() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Acasă</h1>
                <p className="text-sm text-muted-foreground">Ultimele noutăți din rețeaua ta.</p>
            </div>

            {user && (
                <div className="grid grid-cols-3 gap-4">
                    <Link to="/matches" className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent/50 transition-colors gap-2">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-xs font-medium">Meciuri</span>
                    </Link>
                    <Link to="/delegations" className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent/50 transition-colors gap-2">
                        <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                            <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-xs font-medium">Delegări</span>
                    </Link>
                    <Link to="/groups" className="flex flex-col items-center justify-center p-4 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent/50 transition-colors gap-2">
                        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                            <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-medium">Grupuri</span>
                    </Link>
                </div>
            )}

            {user && <CreatePost />}

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Noutăți</h2>
                <Feed />
            </div>
        </div>
    );
}
