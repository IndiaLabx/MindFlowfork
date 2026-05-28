import React from 'react';
import { cn } from '../../utils/cn';
import { getDeterministicFallback } from '../../utils/avatar';

interface PresenceAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  altText?: string;
  className?: string; // used to control width and height
}

export const PresenceAvatar: React.FC<PresenceAvatarProps> = ({
  userId,
  avatarUrl,
  altText = 'User',
  className = 'w-10 h-10'
}) => {
  return (
    <div className={cn("relative inline-block", className)}>
      <div className="w-full h-full rounded-full bg-indigo-500 overflow-hidden shadow-sm flex items-center justify-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={altText}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const fallback = getDeterministicFallback(altText);
              if (target.src !== fallback) {
                target.src = fallback;
              }
            }}
          />
        ) : (
          <span className="text-white font-bold text-sm uppercase">
            {altText.charAt(0)}
          </span>
        )}
      </div>
    </div>
  );
};
