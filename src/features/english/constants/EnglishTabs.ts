import { lazy } from 'react';
import { TabConfig } from '../../../components/common/CentralizedTabbedPage';
import { GrammarComingSoon } from '../components/placeholders/GrammarComingSoon';
import { MockComingSoon } from '../components/placeholders/MockComingSoon';

// Lazy load the full page modules to ensure code splitting
const LazyIdiomsPage = lazy(() => import('../../vocab/idioms/IdiomsHub').then(m => ({ default: m.IdiomsHub })));
const LazyOWSPage = lazy(() => import('../../vocab/ows/OWSHub').then(m => ({ default: m.OWSHub })));
const LazySynonymsPage = lazy(() => import('../../vocab/synonyms/SynonymsHub').then(m => ({ default: m.SynonymsHub })));

export const ENGLISH_TABS: Record<string, TabConfig> = {
    vocabidiom: {
        key: 'vocabidiom',
        label: "Idioms & Phrases",
        component: LazyIdiomsPage,
        legacyRoutes: ["/vocab/idioms"]
    },
    vocabows: {
        key: 'vocabows',
        label: "One Word Substitution",
        component: LazyOWSPage,
        legacyRoutes: ["/vocab/ows"]
    },
    vocabsynonyms: {
        key: 'vocabsynonyms',
        label: "Synonyms",
        component: LazySynonymsPage,
        legacyRoutes: ["/vocab/synonyms"]
    },
    enggrammar: {
        key: 'enggrammar',
        label: "Grammar",
        component: GrammarComingSoon
    },
    engmock: {
        key: 'engmock',
        label: "Mock Test",
        component: MockComingSoon
    }
};
