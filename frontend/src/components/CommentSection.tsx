"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

interface CommentSectionProps {
  taskId: string;
}

export default function CommentSection({ taskId }: CommentSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const loadComments = async () => {
    try {
      const res = await api.get(`/api/comments/${taskId}`);
      setComments(res.data);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/comments/", { task_id: taskId, content: content.trim() });
      setContent("");
      toast.success("Comment added");
      loadComments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await api.delete(`/api/comments/${commentId}`);
      toast.success("Comment deleted");
      loadComments();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to delete comment");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare size={16} className="text-emerald-600" />
        Comments ({comments.length})
      </h3>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[40px] text-sm"
          rows={2}
        />
        <Button type="submit" size="icon" disabled={submitting || !content.trim()} className="shrink-0 self-start">
          <Send size={16} />
        </Button>
      </form>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3 p-3 rounded-xl bg-muted">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="text-xs">{c.user_name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{c.user_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("en-IN")}
                    </span>
                    {(user?.id === c.user_id || user?.role === "admin") && (
                      <button onClick={() => handleDelete(c.id)} className="text-muted-foreground hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
