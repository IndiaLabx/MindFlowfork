import React from 'react';
import { AlertCircle, WifiOff, ShieldAlert, AlertTriangle } from 'lucide-react';
import { AppError } from '../../vocab/hooks/useAdminEditVocab';

interface MutationErrorBannerProps {
  error: Error | AppError | null;
  onRetry?: () => void;
}

export const MutationErrorBanner: React.FC<MutationErrorBannerProps> = ({ error, onRetry }) => {
  if (!error) return null;

  let title = 'Failed to save changes';
  let message = error.message;
  let Icon = AlertCircle;
  let colorClass = 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50';
  let iconClass = 'text-red-500 dark:text-red-400';

  if (error instanceof AppError) {
    switch (error.type) {
      case 'permission':
        title = 'Permission Denied';
        Icon = ShieldAlert;
        colorClass = 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50';
        iconClass = 'text-orange-500 dark:text-orange-400';
        break;
      case 'network':
        title = 'Connection Error';
        Icon = WifiOff;
        colorClass = 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/50';
        iconClass = 'text-yellow-500 dark:text-yellow-400';
        break;
      case 'validation':
        title = 'Validation Error';
        Icon = AlertTriangle;
        break;
      default:
        title = 'System Error';
        Icon = AlertCircle;
        break;
    }
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-3 p-4 rounded-xl border ${colorClass} shadow-sm animate-in fade-in slide-in-from-top-2 duration-300`}>
      <div className="shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${iconClass}`} />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1">{title}</h4>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      {onRetry && (
        <div className="shrink-0 pt-2 sm:pt-0 sm:pl-3 flex items-center">
          <button
            onClick={onRetry}
            type="button"
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5 border-current/20`}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
