import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStudyMaterials, fetchStudyMetadata, deleteStudyMaterial, updateStudyMaterial, uploadStudyMaterialFile, createStudyMaterialRecord } from '../api/adminApi';
import { StudyMaterial } from '../types';

export const useAdminMaterials = () => {
    return useQuery({
        queryKey: ['admin-study-materials'],
        queryFn: fetchStudyMaterials
    });
};

export const useAdminMetadata = () => {
    return useQuery({
        queryKey: ['admin-study-metadata'],
        queryFn: fetchStudyMetadata
    });
};

export const useDeleteMaterial = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteStudyMaterial,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-study-materials'] });
        }
    });
};

export const useUpdateMaterial = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateStudyMaterial,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-study-materials'] });
        }
    });
};

export const useUploadMaterial = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ file, record }: { file: File, record: Omit<StudyMaterial, 'id' | 'file_url' | 'created_at'> }) => {
            const ext = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const filePath = `${record.class}/${record.subject}/${fileName}`;

            const publicUrl = await uploadStudyMaterialFile({ file, filePath });

            return createStudyMaterialRecord({
                ...record,
                file_url: publicUrl
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-study-materials'] });
        }
    });
};
