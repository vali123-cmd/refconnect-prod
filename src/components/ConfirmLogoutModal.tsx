import React, { useEffect } from 'react';

interface Props {
    open: boolean;
    title?: string;
    description?: string;
    onConfirm: () => void;
    onClose: () => void;
}

export default function ConfirmLogoutModal({ open, title = 'Deconectare', description = 'Ești sigur că vrei să te deconectezi?', onConfirm, onClose }: Props) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (open) window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>

                <div className="mt-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-3 py-2 rounded-md bg-muted-foreground/5 hover:bg-muted-foreground/10 transition-colors"
                    >
                        Renunță
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Deconectare
                    </button>
                </div>
            </div>
        </div>
    );
}
