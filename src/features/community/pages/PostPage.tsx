import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CommentThread } from '../components/CommentThread';
import { supabase } from '../../../lib/supabase';
import { fetchComments, toggleLikePost, toggleLikeComment, createComment, Post } from '../api/communityApi';
import { useAuth } from '../../auth/context/AuthContext';
import { Heart, MessageCircle, Share2, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { useNotificationStore } from '../../../stores/useNotificationStore';
import { CommentSkeleton } from '../components/CommentSkeleton';
import { ErrorState } from '../../../components/ui/ErrorState';

export const PostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useNotificationStore();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string, username: string } | null>(null);

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['community-post', id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(`*, profiles:user_id(id, full_name, username, avatar_url)`)
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return null;

      const [likesReq, commentsReq, myLikesReq] = await Promise.all([
        supabase.from('post_likes').select('post_id', { count: 'exact' }).eq('post_id', id),
        supabase.from('post_comments').select('post_id', { count: 'exact' }).eq('post_id', id),
        user ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).eq('post_id', id).maybeSingle() : Promise.resolve({ data: null })
      ]);

        return {
          ...data,
          profiles: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
          likes_count: likesReq.count || 0,
          comments_count: commentsReq.count || 0,
          is_liked_by_me: !!myLikesReq.data
        } as Post;
      } catch (err) {
        console.error('[Supabase Error - fetchPostPage]:', err);
        throw err;
      }
    },
    enabled: !!id
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['community-comments', id],
    queryFn: () => fetchComments(id!, user?.id),
    enabled: !!id
  });

  const likePostMutation = useMutation({
    mutationFn: (currentlyLiked: boolean) => toggleLikePost(id!, user!.id, currentlyLiked),
    onMutate: async (currentlyLiked) => {
      await queryClient.cancelQueries({ queryKey: ['community-post', id] });
      const previousPost = queryClient.getQueryData(['community-post', id]);

      queryClient.setQueryData(['community-post', id], (old: any) => ({
        ...old,
        is_liked_by_me: !currentlyLiked,
        likes_count: old.likes_count ? old.likes_count + (currentlyLiked ? -1 : 1) : (currentlyLiked ? 0 : 1)
      }));
      return { previousPost };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(['community-post', id], context.previousPost);
      }
    }
  });

  const submitCommentMutation = useMutation({
    mutationFn: (content: string) => createComment(id!, user!.id, content, replyingTo?.id),
    onSuccess: () => {
      setCommentText('');
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ['community-comments', id] });
      queryClient.invalidateQueries({ queryKey: ['community-post', id] });
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

  if (postLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>;
  }

  if (!post) {
    return <div className="p-4 text-center mt-20">Post not found</div>;
  }

  return (
    <div className="flex flex-col w-full max-w-[100vw] overflow-x-hidden md:max-w-2xl mx-auto pb-[140px] min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 p-4 flex items-center gap-4 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="font-semibold text-lg text-gray-900">Post</h1>
      </div>

      {/* Main Post Content */}
        <div className="bg-white p-4 mb-0 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => navigate(`/u/${post.profiles?.username || post.user_id}`)}>
          <img
            src={post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${post.profiles?.full_name || 'User'}`}
            className="w-12 h-12 rounded-full object-cover border border-gray-200"
            alt="avatar"
          />
          <div>
            <div className="font-semibold text-gray-900">{post.profiles?.full_name || 'MindFlow User'}</div>
            <div className="text-sm text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="text-gray-900 text-lg mb-4 whitespace-pre-wrap">{post.content}</div>

        {post.media_url && (
          <img src={post.media_url} alt="media" className="w-full rounded-2xl mb-4 object-cover max-h-[60vh] border border-gray-100" />
        )}

        <div className="flex items-center gap-6 mt-2 pt-4 border-t border-gray-100">
          <button
            onClick={() => user && likePostMutation.mutate(!!post.is_liked_by_me)}
            className="flex items-center gap-2 group"
          >
            <div className={cn("p-2 rounded-full transition-all duration-300", post.is_liked_by_me ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-600 hover:bg-gray-100")}>
              <Heart size={24} className={cn(post.is_liked_by_me && "fill-current")} />
            </div>
            <span className="font-medium text-gray-600">{post.likes_count || 0}</span>
          </button>
          <div className="flex items-center gap-2 text-gray-600">
            <MessageCircle size={24} className="p-1" />
            <span className="font-medium">{post.comments_count || 0}</span>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="flex-1 bg-white px-4 py-2">
        <h2 className="font-semibold text-gray-900 mb-6">Comments</h2>

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
                comment={comment}
                onReply={(id, username) => setReplyingTo({ id, username })}
                currentUserId={user?.id}
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

// Recursive Component for Threaded Comments
