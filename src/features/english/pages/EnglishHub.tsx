import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CentralizedTabbedPage } from '../../../components/common/CentralizedTabbedPage';
import { ENGLISH_TABS } from '../constants/EnglishTabs';
import { useQuizContext } from '../../../features/quiz';

export const EnglishHub: React.FC = () => {
    const navigate = useNavigate();
    const { enterHome } = useQuizContext();

    const handleBack = useCallback(() => {
        enterHome();
        navigate('/dashboard');
    }, [enterHome, navigate]);

    const handleTabChange = useCallback((tabKey: string) => {
        // Analytics hook placeholder
        // trackEnglishTabVisit(tabKey);
        console.log(`[Analytics] Tab visited: ${tabKey}`);
    }, []);

    return (
        <CentralizedTabbedPage
            tabs={ENGLISH_TABS}
            defaultTab="vocabidiom"
            baseRoute="/english"
            onTabChange={handleTabChange}
            headerTitle={
                <>
                    English{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500">
                        Proficiency
                    </span>
                </>
            }
            headerDescription="Master vocabulary, grammar, and comprehension with targeted modules."
            onBack={handleBack}
            backLabel="Back to Dashboard"
        />
    );
};
