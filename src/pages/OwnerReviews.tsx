import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/design/Skeleton";
import { toast } from "sonner";

type OwnerRecord = { id: string; name: string; email: string };
type SalonRow = { id: string };

type ReviewRow = {
  id: string;
  customer_id: string;
  salon_id: string;
  booking_id: string | null;
  rating: number;
  comment: string | null;
  owner_reply: string | null;
  owner_replied_at: string | null;
  created_at: string;
};

type ProfileRow = { id: string; first_name: string | null; last_name: string | null };

function StarRow({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${star <= rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function OwnerReviews() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;

  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);

  const salonId = salon?.id;

  const fetchReviews = async (id: string) => {
    try {
      const { data, error } = await supabaseAny
        .from("salon_reviews")
        .select("*")
        .eq("salon_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data as ReviewRow[]) || [];
      setReviews(rows);

      const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter(Boolean)));
      if (customerIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabaseAny
          .from("customer_profiles")
          .select("id, first_name, last_name")
          .in("id", customerIds);

        if (!profileError) {
          const lookup = ((profileRows || []) as ProfileRow[]).reduce<Record<string, ProfileRow>>((acc, row) => {
            acc[row.id] = row;
            return acc;
          }, {});
          setProfileMap(lookup);
        }
      } else {
        setProfileMap({});
      }
    } catch (error: any) {
      console.error("❌ REVIEWS_FETCH_ERROR:", error);
      toast.error(error.message || "Failed to load reviews");
    }
  };

  useEffect(() => {
    if (!salonId) return;
    fetchReviews(salonId);
  }, [salonId]);

  useEffect(() => {
    const init = async () => {
      const raw = localStorage.getItem("owner");
      if (!raw) {
        navigate("/owner-login", { replace: true });
        return;
      }
      try {
        const parsed = JSON.parse(raw) as OwnerRecord;
        setOwner(parsed);
        const { data: salonData, error: salonError } = await supabaseAny
          .from("salons")
          .select("id")
          .eq("owner_id", parsed.id)
          .maybeSingle();

        if (salonError) throw salonError;
        setSalon(salonData as SalonRow | null);
      } catch (error: any) {
        console.error("❌ INIT_ERROR:", error);
        toast.error("Failed to initialize reviews");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const average = total > 0 ? sum / total : 0;
    const histogram = [0, 0, 0, 0, 0]; // index 0 = 1-star ... index 4 = 5-star
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) histogram[r.rating - 1] += 1;
    });
    return { total, average, histogram };
  }, [reviews]);

  const submitReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] || "").trim();
    if (!text) {
      toast.error("Please write a reply before submitting");
      return;
    }

    setSavingReplyId(reviewId);
    try {
      const repliedAt = new Date().toISOString();
      const { error } = await supabaseAny
        .from("salon_reviews")
        .update({ owner_reply: text, owner_replied_at: repliedAt })
        .eq("id", reviewId);

      if (error) throw error;

      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, owner_reply: text, owner_replied_at: repliedAt } : r))
      );
      setReplyingId(null);
      toast.success("Reply posted");
    } catch (error: any) {
      console.error("❌ REVIEW_REPLY_ERROR:", error);
      toast.error(error.message || "Failed to post reply");
    } finally {
      setSavingReplyId(null);
    }
  };

  if (loading) {
    return (
      <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="mt-3 h-4 w-64 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="rounded-2xl border border-border bg-card p-5 shadow-elevation-1">
                <Skeleton width="40%" height={16} />
                <div className="mt-2.5">
                  <Skeleton width="80%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </OwnerShell>
    );
  }

  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">See what customers are saying and reply to their feedback.</p>
        </section>

        <Card className="rounded-2xl border-border bg-card shadow-elevation-1">
          <CardContent className="grid gap-6 p-6 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-8 py-6 sm:items-start">
              <p className="font-display text-5xl font-extrabold text-foreground">
                {stats.total > 0 ? stats.average.toFixed(1) : "—"}
              </p>
              <StarRow rating={Math.round(stats.average)} />
              <p className="font-mono text-xs text-muted-foreground">
                {stats.total} review{stats.total === 1 ? "" : "s"}
              </p>
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.histogram[star - 1];
                const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 font-mono text-xs font-semibold text-muted-foreground">{star}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {reviews.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border bg-card shadow-none">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <p className="font-display text-lg font-semibold text-foreground">No reviews yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Reviews from customers with completed bookings will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const profile = profileMap[review.customer_id];
              const customerName = profile?.first_name || profile?.last_name
                ? `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim()
                : "Guest customer";
              const initials = customerName.split(" ").slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "G";
              const isReplying = replyingId === review.id;

              return (
                <Card key={review.id} className="rounded-2xl border-border bg-card shadow-elevation-1">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {initials}
                        </div>
                        <div>
                          <p className="font-display text-base font-bold text-foreground">{customerName}</p>
                          <StarRow rating={review.rating} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </p>
                    </div>

                    {review.comment ? (
                      <p className="text-sm text-foreground/90">{review.comment}</p>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">No written comment.</p>
                    )}

                    {review.owner_reply ? (
                      <div className="ml-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:ml-8">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Owner reply</p>
                        <p className="mt-1 text-sm text-foreground/90">{review.owner_reply}</p>
                        {review.owner_replied_at ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.owner_replied_at), { addSuffix: true })}
                          </p>
                        ) : null}
                      </div>
                    ) : isReplying ? (
                      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
                        <Textarea
                          autoFocus
                          placeholder="Write a reply to this review..."
                          value={replyDrafts[review.id] || ""}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                          className="min-h-[80px] bg-card"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={savingReplyId === review.id}
                            onClick={() => submitReply(review.id)}
                          >
                            {savingReplyId === review.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Post reply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingReplyId === review.id}
                            onClick={() => setReplyingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setReplyingId(review.id);
                          setReplyDrafts((prev) => ({ ...prev, [review.id]: prev[review.id] || "" }));
                        }}
                      >
                        <MessageSquare className="h-4 w-4" /> Reply
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </OwnerShell>
  );
}
