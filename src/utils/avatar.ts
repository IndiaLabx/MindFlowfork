export const getCanonicalAvatarUrl = (
  profile: { avatar_url?: string | null; updated_at?: string | null } | null | undefined,
  user: { user_metadata?: { avatar_url?: string | null, full_name?: string | null }; email?: string | null } | null | undefined,
  options?: { fallbackSeed?: string }
): string => {
  const defaultSeed = profile?.avatar_url ? 'User' : (user?.user_metadata?.full_name || user?.email || options?.fallbackSeed || 'User');
  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(defaultSeed)}&backgroundColor=e2e8f0`;

  let avatarUrl = defaultAvatar;

  // 1. Prioritize profile avatar (database/storage)
  if (profile?.avatar_url) {
    avatarUrl = profile.avatar_url;
  }
  // 2. Fallback to auth metadata (e.g., from Google Sign-In)
  else if (user?.user_metadata?.avatar_url) {
     avatarUrl = user.user_metadata.avatar_url;
  }

  // Safe empty string/null check (should be caught above, but just in case)
  if (!avatarUrl || avatarUrl.trim() === '') {
    avatarUrl = defaultAvatar;
  }

  // 3. Capacitor caching fix: Append updated_at timestamp (deterministic)
  // Only if it's not the default avatar to avoid breaking dicebear URLs
  // And ONLY use updated_at to prevent Date.now() network spam
  if (avatarUrl !== defaultAvatar && profile?.updated_at) {
     const cacheBuster = new Date(profile.updated_at).getTime();

     // Check if it's a Supabase storage URL (public URL)
     // Signed URLs might break if we randomly append query params without care,
     // but currently the app uses public URLs for avatars.
     try {
       const urlObj = new URL(avatarUrl);
       // Only append if it doesn't already have our exact cache buster
       if (urlObj.searchParams.get('t') !== cacheBuster.toString()) {
           urlObj.searchParams.set('t', cacheBuster.toString());
           avatarUrl = urlObj.toString();
       }
     } catch (e) {
       // Fallback if URL parsing fails (e.g., relative URLs, though avatars shouldn't be relative)
       const separator = avatarUrl.includes('?') ? '&' : '?';
       if (!avatarUrl.includes(`t=${cacheBuster}`)) {
          // Remove any existing 't=' param if we're fallback parsing to avoid ?t=123&t=456
          avatarUrl = avatarUrl.replace(/([?&])t=[^&]+/, '$1');
          avatarUrl = `${avatarUrl}${avatarUrl.endsWith('?') || avatarUrl.endsWith('&') ? '' : separator}t=${cacheBuster}`;
       }
     }
  }

  return avatarUrl;
};

export const getDeterministicFallback = (seed?: string | null): string => {
  const safeSeed = seed || 'User';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(safeSeed)}&backgroundColor=e2e8f0`;
};
