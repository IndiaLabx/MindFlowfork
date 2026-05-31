import { supabase } from '@/lib/supabase';
import { StudyMaterial } from '../types';

export const fetchStudyMaterials = async (): Promise<StudyMaterial[]> => {
    const { data, error } = await supabase
        .from('study_materials')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const fetchStudyMetadata = async () => {
    const { data, error } = await supabase.from('study_materials').select('subject, chapter');
    if (error) throw error;
    return data || [];
};

export const deleteStudyMaterial = async ({ id, fileUrl }: { id: string, fileUrl: string }): Promise<boolean> => {
    const bucketPath = 'study_materials/';
    const bucketIndex = fileUrl.indexOf(bucketPath);

    let filePath = '';
    if (bucketIndex !== -1) {
        filePath = fileUrl.substring(bucketIndex + bucketPath.length);
        filePath = filePath.split('?')[0];
        filePath = decodeURIComponent(filePath);
    }

    if (filePath) {
        const { error: storageError } = await supabase.storage.from('study_materials').remove([filePath]);
        if (storageError) console.error("Storage delete error:", storageError);
    }

    const { error: dbError } = await supabase.from('study_materials').delete().eq('id', id);
    if (dbError) throw dbError;

    return true;
};

export const updateStudyMaterial = async ({ id, updates }: { id: string, updates: Partial<StudyMaterial> }) => {
    const { data, error } = await supabase
        .from('study_materials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const uploadStudyMaterialFile = async ({ file, filePath }: { file: File, filePath: string }) => {
    const { error: uploadError } = await supabase.storage
        .from('study_materials')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('study_materials')
        .getPublicUrl(filePath);

    return publicUrl;
};

export const createStudyMaterialRecord = async (record: Omit<StudyMaterial, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
        .from('study_materials')
        .insert(record)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// --- GK/MCQ API ---
const buildQuery = (baseQuery: any, filters: any[]) => {
    let query = baseQuery;
    filters.forEach(f => {
        if (!f.field || !f.operator) return;
        if (f.operator === 'eq') query = query.eq(f.field, f.value);
        if (f.operator === 'neq') query = query.neq(f.field, f.value);
        if (f.operator === 'ilike') query = query.ilike(f.field, `%${f.value}%`);
        if (f.operator === 'is') {
            if (f.value.toLowerCase() === 'null') query = query.is(f.field, null);
        }
    });
    return query;
};

export const fetchQuestionsCountByFilter = async (filters: any[]) => {
    let query: any = supabase.from('questions').select('*', { count: 'exact', head: true });
    query = buildQuery(query, filters);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
};

export const performBulkUpdate = async ({ filters, targetField, targetValue }: { filters: any[], targetField: string, targetValue: string }) => {
    const updatePayload = { [targetField]: targetValue };
    let query: any = supabase.from('questions').update(updatePayload);
    query = buildQuery(query, filters);

    const { data, error } = await query.select('id');
    if (error) throw error;
    return data;
};

export const fetchQuestionsByIds = async (ids: string[]) => {
    const { data, error } = await supabase.from('questions').select('v1_id').in('v1_id', ids);
    if (error) throw error;
    return data;
};

export const insertQuestions = async (payload: any[]) => {
    const { error } = await supabase.from('questions').insert(payload);
    if (error) throw error;
    return true;
};

export const fetchQuestionByV1Id = async (v1_id: string) => {
    const { data, error } = await supabase.from('questions').select('*').eq('v1_id', v1_id).single();
    if (error) throw error;
    return data;
};

export const updateQuestion = async (payload: any) => {
    const { error } = await supabase.from('questions').update(payload).eq('v1_id', payload.v1_id);
    if (error) throw error;
    return true;
};
