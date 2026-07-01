import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useNotification } from '../../../hooks/useNotification';
import { useFlashcardStore } from '../../quiz/stores/useFlashcardStore';

type VocabType = 'idiom' | 'ows' | 'synonym';

interface EditVocabParams {
    id: string;
    type: VocabType;
    updates: Record<string, any>;
}

export class AppError extends Error {
    constructor(public type: 'validation' | 'permission' | 'network' | 'unknown', message: string, public originalError?: any) {
        super(message);
        this.name = 'AppError';
    }
}

export const useAdminEditVocab = () => {
    const { showToast } = useNotification();
    const updateCard = useFlashcardStore((state) => state.updateCard);

    return useMutation({
        mutationFn: async ({ id, type, updates }: EditVocabParams) => {
            // Pre-flight check on auth if possible or let supabase handle network/auth.
            const { data: sessionData, error: authError } = await supabase.auth.getSession();
            if (authError || !sessionData.session) {
                throw new AppError('permission', 'You must be logged in as an administrator to perform this action.');
            }

            try {
                const { data, error } = await supabase
                    .from(type)
                    .update(updates)
                    .eq('id', id)
                    .select();

                // Handle explicit Supabase errors
                if (error) {
                    console.error('Supabase update error:', error);
                    // Differentiate known postgres errors if needed, fallback to generic
                    if (error.code === '42501' || error.message?.toLowerCase().includes('policy')) {
                        throw new AppError('permission', 'You do not have permission to edit this item.', error);
                    } else if (error.code === '23505') {
                         throw new AppError('validation', 'This update violates a uniqueness constraint (e.g., duplicate word).', error);
                    }
                    throw new AppError('unknown', error.message || 'An unexpected database error occurred.', error);
                }

                // Defensive row count check (replacing .single() fragility)
                if (!data || data.length === 0) {
                     // 0 rows often means RLS denied the update silently, or the ID was wrong.
                     throw new AppError('permission', 'Update failed. You may not have permission to edit this item, or the item no longer exists.');
                }
                if (data.length > 1) {
                     throw new AppError('unknown', `Unexpected condition: Updated ${data.length} rows instead of 1. Changes may be corrupted.`);
                }

                return { id, type, data: data[0] };
            } catch (e: any) {
                // If it's already our structured AppError, rethrow it
                if (e instanceof AppError) throw e;

                // Network or other fetch errors
                if (e.message?.toLowerCase().includes('fetch') || e.message?.toLowerCase().includes('network')) {
                    throw new AppError('network', 'Unable to contact server. Please check your internet connection and try again.', e);
                }

                throw new AppError('unknown', e.message || 'An unexpected error occurred.', e);
            }
        },
        onSuccess: (result) => {
            // We no longer throw global toasts on error, but success toasts are generally still desired
            // per standard behavior, or we can let the UI handle success. The prompt mentions
            // "Success closes modal OR Inline error message". We will keep the success toast for now.
            showToast({
                title: 'Success',
                message: `Successfully updated ${result.type}`,
                variant: 'success'
            });

            // Map db schema back to app model
            if (updateCard) {
                updateCard(result.id, result.type === 'idiom' ? 'idioms' : result.type === 'ows' ? 'ows' : 'synonyms', result.data);
            }
        }
        // Removing onError global toast to fulfill: "The modal should never rely on background toasts to communicate mutation failures."
    });
};
