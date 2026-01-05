import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';

export default function CreateGroup() {
    const navigate = useNavigate();
    const { createGroupChat } = useChat();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            setError('Numele grupului este obligatoriu');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Create group chat with empty userIds - only creator will be added
            const result = await createGroupChat(name.trim(), description.trim(), []);
            if (result) {
                navigate('/groups');
            }
        } catch (err) {
            setError('Nu s-a putut crea grupul. Încearcă din nou.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-border pb-4">
                <button onClick={() => navigate('/groups')} className="p-2 hover:bg-secondary rounded-full">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-bold">Creează Grup</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center mb-6">
                    <div className="h-20 w-20 bg-secondary rounded-xl flex items-center justify-center">
                        <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nume Grup *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-transparent border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="ex: Arbitri Liga 1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Descriere</label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-transparent border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            placeholder="Despre ce este acest grup? (opțional)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Utilizatorii vor putea solicita să se alăture grupului tău.
                        </p>
                    </div>
                </div>

                <div className="bg-secondary/50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Cum funcționează?</h3>
                    <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Creezi grupul cu un nume și o descriere</li>
                        <li>• Alți utilizatori pot vedea grupul în lista de grupuri</li>
                        <li>• Ei pot trimite cereri de alăturare</li>
                        <li>• Tu aprobi sau respingi cererile din pagina Mesaje</li>
                    </ul>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Se creează...
                        </>
                    ) : (
                        'Creează Grup'
                    )}
                </button>
            </form>
        </div>
    );
}
