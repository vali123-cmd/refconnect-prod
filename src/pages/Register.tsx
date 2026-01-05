import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({
        userName: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { register } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert('Parolele nu coincid');
            return;
        }
        setIsLoading(true);
        try {
            setFormError(null);
            await register(
                formData.userName,
                formData.firstName,
                formData.lastName,
                formData.email,
                formData.password
            );
            // After successful register, navigate to home
            navigate('/');
        } catch (err: any) {
            console.error('Register failed', err);
            // Try to extract a helpful message from the server response
            const serverMsg = err?.response?.data?.message || err?.response?.data || err?.message;
            setFormError(typeof serverMsg === 'string' ? serverMsg : JSON.stringify(serverMsg));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[80vh] flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl shadow-lg border border-border">
                <div className="flex flex-col items-center">
                    <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-foreground">
                        Creează un cont
                    </h2>
                    <p className="mt-2 text-center text-sm text-muted-foreground">
                        Alătură-te comunității RefConnect
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label htmlFor="userName" className="block text-sm font-medium text-muted-foreground mb-1">
                                Nume de utilizator
                            </label>
                            <input
                                id="userName"
                                name="userName"
                                type="text"
                                required
                                className="relative block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
                                placeholder="johndoe"
                                value={formData.userName}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-muted-foreground mb-1">
                                    Prenume
                                </label>
                                <input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    required
                                    className="relative block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
                                    placeholder="John"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-muted-foreground mb-1">
                                    Nume
                                </label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    required
                                    className="relative block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
                                    placeholder="Doe"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email-address" className="block text-sm font-medium text-muted-foreground mb-1">
                                Adresă de email
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
                                placeholder="arbitru@exemplu.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        {/* role selection removed - backend assigns default role */}

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">
                                Parolă
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="relative block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground mb-1">
                                Confirmă parola
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                className="relative block w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground placeholder-muted-foreground focus:z-10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm transition-colors"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {formError && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative flex w-full justify-center rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? 'Se creează contul...' : 'Înregistrează-te'}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-muted-foreground">Ai deja un cont? </span>
                        <Link to="/login" className="font-medium text-primary hover:text-primary/80">
                            Conectează-te
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
