import React from 'react';
import { motion } from 'framer-motion';

export const ComingSoonPlaceholder: React.FC<{ title: string; description: string }> = ({ title, description }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[400px] bg-white/50 dark:bg-slate-800/50 rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm shadow-sm"
        >
            <div className="w-16 h-16 mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                {description}
            </p>
        </motion.div>
    );
};
