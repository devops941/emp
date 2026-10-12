"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Info, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/socket";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  entity_type?: string;
  created_at: string;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "success") return <CheckCircle size={16} className="text-emerald-500 shrink-0" />;
  if (type === "error") return <XCircle size={16} className="text-red-500 shrink-0" />;
  if (type === "warning") return <AlertCircle size={16} className="text-amber-500 shrink-0" />;
  return <Info size={16} className="text-blue-500 shrink-0" />;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/api/notifications/");
      setNotifications(res.data.items);
      setUnread(res.data.unread);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const onNotif = (data: any) => {
      setUnread((u) => u + 1);
      setNotifications((prev) => [{ id: data.id, title: data.title, message: data.message, type: data.type, is_read: false, created_at: new Date().toISOString() }, ...prev]);
    };
    socket.on("notification", onNotif);
    return () => { socket.off("notification", onNotif); };
  }, [token]);

  const markRead = async (id: string) => {
    await api.put(`/api/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await api.put("/api/notifications/read-all").catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-muted-foreground" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-80 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-blue-50/50" : ""}`}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                >
                  <NotifIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
