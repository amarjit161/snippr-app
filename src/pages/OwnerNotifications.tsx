import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { QueueItemSkeleton } from "@/components/design/Skeleton";
import { ErrorState } from "@/components/design/ErrorState";
import type { Tables } from "@/integrations/supabase/types";

type NotificationRow = Tables<"notifications">;

export default function OwnerNotifications() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: notifications = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["owner-notifications", user?.id],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const loadError = queryError ? "Could not load your notifications right now." : null;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    if (!user) return;

    queryClient.setQueryData<NotificationRow[]>(["owner-notifications", user.id], (prev = []) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("OWNER_NOTIFICATION_MARK_READ_ERROR", err);
      queryClient.invalidateQueries({ queryKey: ["owner-notifications", user.id] });
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;

    queryClient.setQueryData<NotificationRow[]>(["owner-notifications", user.id], (prev = []) =>
      prev.map((n) => ({ ...n, is_read: true }))
    );

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    } catch (err) {
      console.error("OWNER_NOTIFICATIONS_MARK_ALL_READ_ERROR", err);
      queryClient.invalidateQueries({ queryKey: ["owner-notifications", user.id] });
    }
  };

  const onLogout = () => {
    signOut();
    navigate("/owner-login", { replace: true });
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <OwnerShell onLogout={onLogout}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono font-bold text-xs uppercase tracking-widest text-primary mb-2 block">
                Stay In The Loop
              </span>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Notifications</h1>
              <p className="mt-1 text-sm text-muted-foreground">Bookings and cancellations for your salon, as they happen.</p>
            </div>
            {unreadCount > 0 ? (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 self-start rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            [1, 2, 3, 4].map((i) => <QueueItemSkeleton key={i} />)
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <BellOff className="h-6 w-6 text-primary" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">No notifications yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                New bookings and cancellations for your salon will show up here as they happen.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => !notification.is_read && markAsRead(notification.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  notification.is_read
                    ? "border-border bg-card"
                    : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <div className="mt-1 shrink-0">
                  {notification.is_read ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm ${
                        notification.is_read ? "font-medium text-foreground" : "font-bold text-foreground"
                      }`}
                    >
                      {notification.title || "Notification"}
                    </p>
                    {!notification.is_read ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  {notification.body ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
                  ) : null}
                  {notification.created_at ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </section>
      </div>
    </OwnerShell>
  );
}
