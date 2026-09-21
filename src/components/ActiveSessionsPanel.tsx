import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCurrentSessionId,
  listUserSessions,
  removeSessionRecord,
  type UserSessionRow,
} from '@/lib/sessionRegistry';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Always phrased around when last_seen_at was recorded — never implies a
// live/persistent connection. Recent gaps read as "Active …ago" (still
// plausibly open); anything an hour or older switches to "Last active
// …ago", which reads as a point-in-time fact rather than a current status.
const formatLastActive = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Last active: unknown';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 2) return 'Active now';
  if (minutes < 60) return `Active ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last active ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Last active ${days} day${days === 1 ? '' : 's'} ago`;
};

interface Props {
  userId: string;
}

export function ActiveSessionsPanel({ userId }: Props) {
  const { signOutOtherDevices, signOutEverywhere } = useAuth();

  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [registryUnavailable, setRegistryUnavailable] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  const [loggingOutEverywhere, setLoggingOutEverywhere] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const [sessionId, rows] = await Promise.all([getCurrentSessionId(), listUserSessions(userId)]);
      setCurrentSessionId(sessionId);
      setSessions(rows);
      // listUserSessions swallows errors and returns [] — if we also have no
      // current session id, the registry table most likely doesn't exist yet
      // (migration not applied), rather than the account genuinely having
      // zero sessions (that can't happen while this page is rendering).
      setRegistryUnavailable(rows.length === 0 && !sessionId);
    } finally {
      setLoadingSessions(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRemove = async (rowId: string) => {
    if (removingId) return;
    setRemovingId(rowId);
    try {
      const { error } = await removeSessionRecord(userId, rowId);
      if (error) {
        toast.error('Could not remove that device from the list.');
      } else {
        setSessions((prev) => prev.filter((s) => s.id !== rowId));
      }
    } finally {
      setRemovingId(null);
    }
  };

  const handleLogOutOtherDevices = async () => {
    if (loggingOutOthers) return;
    setLoggingOutOthers(true);
    try {
      const { error } = await signOutOtherDevices();
      if (error) {
        toast.error(error || 'Could not log out other devices. Please try again.');
      } else {
        toast.success('Other devices signed out. They lose access next time their session is checked.');
        await loadSessions();
      }
    } finally {
      setLoggingOutOthers(false);
    }
  };

  const handleLogOutEverywhere = async () => {
    if (loggingOutEverywhere) return;
    setLoggingOutEverywhere(true);
    const { error } = await signOutEverywhere();
    if (error) {
      toast.error(error || 'Could not log out everywhere. Please try again.');
      setLoggingOutEverywhere(false);
    }
    // On success signOutEverywhere() redirects to /login itself.
  };

  return (
    <div className="bg-card rounded-3xl shadow-elevation-2 border border-border p-8 mb-6">
      <h2 className="font-display text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <Monitor className="w-5 h-5 text-primary" />
        Login sessions
      </h2>
      <p className="text-muted-foreground text-sm mb-6">
        Devices currently signed in to your account. Ending a session revokes it in Supabase, but a device
        that's already fetched its access token stays signed in there until that token is next refreshed or
        checked — not necessarily instantly.
      </p>

      {loadingSessions ? (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : registryUnavailable ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-4">
          Session details aren't available right now.
        </p>
      ) : (
        <div className="space-y-2 mb-6">
          {sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {s.device_name || `${s.browser || 'Browser'} · ${s.platform || 'Unknown device'}`}
                    {isCurrent && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatLastActive(s.last_seen_at)}</p>
                </div>
                {!isCurrent && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleRemove(s.id)}
                      disabled={removingId === s.id}
                      aria-label={`Remove ${s.device_name || 'this device'} from your session list — this does not sign it out`}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      {removingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Remove from list
                    </button>
                    <p className="max-w-[9.5rem] text-right text-[10px] leading-snug text-muted-foreground">
                      Doesn't sign this device out
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Log out of other devices</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revokes every other session. This device stays signed in.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogOutOtherDevices}
            disabled={loggingOutOthers}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {loggingOutOthers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />}
            {loggingOutOthers ? 'Logging out…' : 'Log out other devices'}
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Log out everywhere</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ends every session, including this one. You'll need to sign in again.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={loggingOutEverywhere}
                className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {loggingOutEverywhere ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                {loggingOutEverywhere ? 'Logging out…' : 'Log out everywhere'}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Log out everywhere?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will end every active session for your account, including this device. You'll be taken
                  back to the login screen. Other devices lose access once their session is next refreshed or
                  checked, not necessarily immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogOutEverywhere}>Log out everywhere</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export default ActiveSessionsPanel;
