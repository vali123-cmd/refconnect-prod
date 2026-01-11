import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmLogoutModal from '../components/ConfirmLogoutModal';
import { Home, Search, Users, Shield, User, Menu, LogOut, Bell, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { BackgroundGradientAnimation } from '../components/ui/background-gradient-animation';
import { useNotification } from '../context/NotificationContext';

export const Layout = () => {
    const { user, logout } = useAuth();
    const { unreadCount } = useNotification();
    const location = useLocation();
    const navigate = useNavigate();
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);


    const isActive = (path: string) => location.pathname === path;
    const isAdmin = !!user && (
        String(user.role || '').toLowerCase() === 'admin' ||
        (Array.isArray(user.roles) && user.roles.some(r => String(r || '').toLowerCase() === 'admin'))
    );

    return (
        <BackgroundGradientAnimation>
            <div className="min-h-screen text-foreground pb-16 md:pb-0">
                {/* Desktop Header */}
                <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-black/20 backdrop-blur-md z-50">
                    <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-yellow-500">
                        RefConnect
                    </Link>

                    <nav className="flex items-center gap-6">
                        <Link to="/" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/') ? "text-yellow-500" : "text-gray-300")}>Acasă</Link>
                        <Link to="/search" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/search') ? "text-yellow-500" : "text-gray-300")}>Caută</Link>
                        {user && (
                            <>
                                <Link to="/matches" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/matches') ? "text-yellow-500" : "text-gray-300")}>Meciuri</Link>
                                <Link to="/delegations" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/delegations') ? "text-yellow-500" : "text-gray-300")}>Delegări</Link>
                                <Link to="/groups" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/groups') ? "text-yellow-500" : "text-gray-300")}>Grupuri</Link>
                                <Link to="/notifications" className={cn("text-sm font-medium transition-colors hover:text-yellow-500 relative", isActive('/notifications') ? "text-yellow-500" : "text-gray-300")}>
                                    Notificări
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-2 -right-3 h-4 w-4 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </Link>
                                <Link to="/chats" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/chats') ? "text-yellow-500" : "text-gray-300")}>Mesaje</Link>
                            </>
                        )}
                        {isAdmin && (
                            <Link to="/admin" className={cn("text-sm font-medium transition-colors hover:text-yellow-500", isActive('/admin') ? "text-yellow-500" : "text-gray-300")}>Admin</Link>
                        )}
                    </nav>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-3">
                                <Link to="/profile" className="flex items-center gap-2 text-white">
                                    <span className="text-sm font-medium hidden md:block">{user.name}</span>
                                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                                        {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-white" />}
                                    </div>
                                </Link>
                                <button
                                    onClick={() => setShowLogoutModal(true)}
                                    className="hidden md:inline-flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
                                    aria-label="Deconectare"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>Deconectare</span>
                                </button>
                            </div>
                        ) : (
                            <Link to="/login" className="text-sm font-medium px-4 py-2 rounded-full bg-yellow-500 text-black hover:bg-yellow-400 transition-opacity">
                                Conectează-te
                            </Link>
                        )}
                    </div>
                </header>

                {/* Logout modal */}
                <ConfirmLogoutModal
                    open={showLogoutModal}
                    onClose={() => setShowLogoutModal(false)}
                    onConfirm={() => {
                        setShowLogoutModal(false);
                        logout();
                        navigate('/login');
                    }}
                />

                {/* Main Content */}
                <main className="container mx-auto max-w-2xl px-4 py-6 relative z-30">
                    <Outlet />
                </main>

                {/* Mobile Bottom Navigation */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-white/10 flex justify-around items-center p-3 z-50 safe-area-bottom">
                    <Link to="/" className={cn("flex flex-col items-center gap-1", isActive('/') ? "text-yellow-500" : "text-gray-400")}>
                        <Home className="h-6 w-6" />
                        <span className="text-[10px]">Acasă</span>
                    </Link>
                    <Link to="/search" className={cn("flex flex-col items-center gap-1", isActive('/search') ? "text-yellow-500" : "text-gray-400")}>
                        <Search className="h-6 w-6" />
                        <span className="text-[10px]">Caută</span>
                    </Link>
                    {user ? (
                        <>
                            <Link to="/groups" className={cn("flex flex-col items-center gap-1", isActive('/groups') ? "text-yellow-500" : "text-gray-400")}>
                                <Users className="h-6 w-6" />
                                <span className="text-[10px]">Grupuri</span>
                            </Link>
                            <Link to="/notifications" className={cn("flex flex-col items-center gap-1 relative", isActive('/notifications') ? "text-yellow-500" : "text-gray-400")}>
                                <div className="relative">
                                    <Bell className="h-6 w-6" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-500 text-black text-[8px] font-bold flex items-center justify-center">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px]">Notificări</span>
                            </Link>
                            <Link to="/chats" className={cn("flex flex-col items-center gap-1", isActive('/chats') ? "text-yellow-500" : "text-gray-400")}>
                                <MessageCircle className="h-6 w-6" />
                                <span className="text-[10px]">Mesaje</span>
                            </Link>
                            <Link to="/profile" className={cn("flex flex-col items-center gap-1", isActive('/profile') ? "text-yellow-500" : "text-gray-400")}>
                                <User className="h-6 w-6" />
                                <span className="text-[10px]">Profil</span>
                            </Link>
                            <button onClick={() => setShowLogoutModal(true)} className={cn("flex flex-col items-center gap-1 text-gray-400")}>
                                <LogOut className="h-6 w-6" />
                                <span className="text-[10px]">Ieșire</span>
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className={cn("flex flex-col items-center gap-1", isActive('/login') ? "text-yellow-500" : "text-gray-400")}>
                            <User className="h-6 w-6" />
                            <span className="text-[10px]">Conectează-te</span>
                        </Link>
                    )}
                </nav>
            </div>
        </BackgroundGradientAnimation>
    );
};

// Mount modal outside component return to ensure hooks are in same component
export default Layout;
