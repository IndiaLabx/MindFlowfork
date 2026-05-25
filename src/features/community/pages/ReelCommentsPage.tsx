import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchReelComments, toggleLikeReel, createReelComment, Reel } from '../api/communityApi';
import { useAuth } from '../../auth/context/AuthContext';
import { Heart, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useNotificationStore } from '../../../stores/useNotificationStore';
import { CommentSkeleton } from '../components/CommentSkeleton';
import { CommentThread } from '../components/CommentThread';
import { ErrorState } from '../../../components/ui/ErrorState';

export const ReelCommentsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useNotificationStore();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string, username: string } | null>(null);

  const { data: reel, isLoading: reelLoading } = useQuery({
    queryKey: ['community-reel', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('reels')
          .select(`*, profiles:user_id(id, full_name, username, avatar_url)`)
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;

      const [likesReq, commentsReq, myLikesReq] = await Promise.all([
        supabase.from('reel_likes').select('reel_id', { count: 'exact' }).eq('reel_id', id),
        supabase.from('reel_comments').select('reel_id', { count: 'exact' }).eq('reel_id', id),
        user ? supabase.from('reel_likes').select('reel_id').eq('user_id', user.id).eq('reel_id', id).maybeSingle() : Promise.resolve({ data: null })
      ]);

        return {
          ...data,
          profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
          likes_count: likesReq.count || 0,
          comments_count: commentsReq.count || 0,
          is_liked_by_me: !!myLikesReq.data
        } as Reel;
      } catch (err) {
        console.error('[Supabase Error - fetchReelPage]:', err);
        throw err;
      }
    },
    enabled: !!id
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['community-reel-comments', id],
    queryFn: () => fetchReelComments(id!, user?.id),
    enabled: !!id
  });

  const likeReelMutation = useMutation({
    mutationFn: (currentlyLiked: boolean) => toggleLikeReel(id!, user!.id, currentlyLiked),
    onMutate: async (currentlyLiked) => {
      await queryClient.cancelQueries({ queryKey: ['community-reel', id] });
      const previousReel = queryClient.getQueryData(['community-reel', id]);

      queryClient.setQueryData(['community-reel', id], (old: any) => ({
        ...old,
        is_liked_by_me: !currentlyLiked,
        likes_count: old.likes_count ? old.likes_count + (currentlyLiked ? -1 : 1) : (currentlyLiked ? 0 : 1)
      }));
      return { previousReel };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousReel) {
        queryClient.setQueryData(['community-reel', id], context.previousReel);
      }
    }
  });

  const submitCommentMutation = useMutation({
    mutationFn: (content: string) => createReelComment(id!, user!.id, content, replyingTo?.id),
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['community-reel-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['community-reel', id] });
      showToast({ title: 'Success', message: 'Comment posted', variant: 'success' });
    },
    onError: () => {
      showToast({ title: 'Error', message: 'Failed to post comment', variant: 'error' });
    }
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    submitCommentMutation.mutate(commentText);
  };

  if (reelLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>;
  }

  if (!reel) {
    return <div className="p-4 text-center mt-20">Reel not found</div>;
  }

  return (
    <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden md:max-w-2xl mx-auto pb-[140px] min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 p-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="font-semibold text-lg text-gray-900">Comments</h1>
      </div>

      {/* Reel Info Header (NO VIDEO) */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2 cursor-pointer" onClick={() => navigate(`/u/${reel.profiles?.username || reel.user_id}`)}>
          <img
            src={reel.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${reel.profiles?.full_name || 'User'}`}
            className="w-12 h-12 rounded-full object-cover border border-gray-200"
            alt="avatar"
          />
          <div>
            <div className="font-semibold text-gray-900">{reel.profiles?.full_name || reel.profiles?.username || 'MindFlow User'}</div>
            <div className="text-xs text-gray-500">{new Date(reel.created_at).toLocaleString()}</div>
          </div>
        </div>

        {reel.caption && (
          <div className="text-gray-800 text-sm mb-3 whitespace-pre-wrap">{reel.caption}</div>
        )}

        <div className="flex items-center gap-6 mt-2">
          <button
            onClick={() => user && likeReelMutation.mutate(!!reel.is_liked_by_me)}
            className="flex items-center gap-2 group"
          >
            <div className={cn("p-1.5 rounded-full transition-all duration-300", reel.is_liked_by_me ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-600 hover:bg-gray-100")}>
              <Heart size={20} className={cn(reel.is_liked_by_me && "fill-current")} />
            </div>
            <span className="font-medium text-gray-600 text-sm">{reel.likes_count || 0}</span>
          </button>
          <div className="text-sm font-medium text-gray-500">{reel.comments_count || 0} comments</div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="flex-1 bg-white px-4 py-4">
        {commentsLoading ? (
          <div className="space-y-6">
            <CommentSkeleton />
            <CommentSkeleton />
            <CommentSkeleton isReply />
          </div>
        ) : (
          <div className="space-y-6">
            {comments?.map(comment => (
              <CommentThread
                key={comment.id}
                comment={comment as any} // Cast because CommentThread expects PostComment currently
                onReply={(id, username) => setReplyingTo({ id, username })}
                currentUserId={user?.id}
                isReelComment={true}
              />
            ))}
            {(!comments || comments.length === 0) && (
              <div className="text-center text-gray-500 py-8">No comments yet. Be the first to reply!</div>
            )}
          </div>
        )}
      </div>

      {/* Comment Input Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 max-w-3xl mx-auto bg-white border-t border-gray-200 p-3 z-40 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] shadow-[0_-10px_20px_rgba(255,255,255,1)]">
        {replyingTo && (
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-t-lg mb-2 -mt-3 mx-1 border border-gray-100 border-b-0">
            <span className="text-xs text-gray-500">Replying to <span className="font-semibold text-gray-900">{replyingTo.username}</span></span>
            <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-900 text-xs font-bold px-2 py-1">Cancel</button>
          </div>
        )}
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-3">
          <img
            src={user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email}`}
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-100"
            alt="avatar"
          />
          <div className="flex-1 flex items-center bg-transparent relative">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyingTo ? "Add a reply..." : "Add a comment..."}
              className="w-full bg-gray-100/80 border-none rounded-full px-4 py-2.5 pr-[70px] text-sm text-gray-900 placeholder-gray-500 focus:ring-0 focus:outline-none focus:bg-gray-100 transition-colors"
              disabled={submitCommentMutation.isPending}
            />
            {commentText.trim() && (
              <button
                type="submit"
                disabled={submitCommentMutation.isPending}
                className="absolute right-1 px-3 py-1 text-sm font-semibold text-blue-500 hover:text-blue-700 disabled:opacity-50"
              >
                {submitCommentMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Post'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
