export type MaterialType = 'NCERT Textbook' | 'Study Notes' | 'MCQ Test' | 'Chapter Test' | 'Other Test' | 'Answer Key';

export interface StudyMaterial {
    id: string;
    class: string;
    subject: string;
    chapter: string;
    type: MaterialType;
    title: string;
    file_url: string;
    status: boolean;
    parts?: string | null;
    created_at?: string;
}

export interface UploadGKPayload {
    questions: any[];
}
