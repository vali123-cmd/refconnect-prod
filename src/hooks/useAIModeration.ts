import { useState } from 'react';
import { api } from '../context/AuthContext';

export function useAIModeration() {
    const [isChecking, setIsChecking] = useState(false);

    // AI moderation check using /AI/appropriate-content endpoint
    const checkContent = async (text: string): Promise<{ safe: boolean; reason?: string }> => {
        if (!text.trim()) {
            return { safe: true };
        }

        setIsChecking(true);
        try {
            // The endpoint expects raw JSON string body
            const response = await api.post('/AI/appropriate-content', JSON.stringify(text), {
                headers: { 'Content-Type': 'application/json' }
            });
            
            const isAppropriate = response.data === true || response.data === 'true';
            
            if (isAppropriate) {
                return { safe: true };
            } else {
                return { safe: false, reason: 'Content has been flagged as inappropriate by AI moderation.' };
            }
        } catch (err: any) {
            console.error('AI moderation check failed:', err);
            // On error, allow the content (fail open) but log the error
            return { safe: true };
        } finally {
            setIsChecking(false);
        }
    };

    return { checkContent, isChecking };
}
