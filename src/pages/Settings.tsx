import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
  is_verified?: boolean;
  is_active?: boolean;
};

type SalonRow = {
  id: string;
  advance_booking_days: number | null;
  allow_advance_on_closed: boolean | null;
};

export default function Settings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [advanceBookingDays, setAdvanceBookingDays] = useState("30");
  const [allowAdvanceOnClosed, setAllowAdvanceOnClosed] = useState(true);
  const [savingBooking, setSavingBooking] = useState(false);

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
        setName(parsed.name || "");
        setEmail(parsed.email || "");

        const { data: ownerRow } = await supabase
          .from("owners")
          .select("email_notifications_enabled")
          .eq("id", parsed.id)
          .maybeSingle();
        if (ownerRow) setEmailNotifications(ownerRow.email_notifications_enabled);

        const { data: salonRow } = await supabase
          .from("salons")
          .select("id, advance_booking_days, allow_advance_on_closed")
          .eq("owner_id", parsed.id)
          .maybeSingle();
        if (salonRow) {
          setSalon(salonRow as SalonRow);
          setAdvanceBookingDays(String(salonRow.advance_booking_days ?? 30));
          setAllowAdvanceOnClosed(salonRow.allow_advance_on_closed ?? true);
        }
      } catch {
        localStorage.removeItem("owner");
        navigate("/owner-login", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!owner) return;

    if (!name.trim() || !email.trim()) {
      toast.error("Owner name and email are required");
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("owners")
        .update({ name: name.trim(), email: email.trim() })
        .eq("id", owner.id);

      if (profileError) throw profileError;

      if (password.trim()) {
        const { error: authError } = await supabase.auth.updateUser({
          password: password.trim(),
        });
        if (authError) throw authError;
      }

      const updatedOwner: OwnerRecord = {
        ...owner,
        name: name.trim(),
        email: email.trim(),
      };

      localStorage.setItem("owner", JSON.stringify(updatedOwner));
      setOwner(updatedOwner);
      toast.success("Settings saved");
      setPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmailNotifications = async (checked: boolean) => {
    if (!owner) return;
    setEmailNotifications(checked);
    const { error } = await supabase
      .from("owners")
      .update({ email_notifications_enabled: checked })
      .eq("id", owner.id);
    if (error) {
      setEmailNotifications(!checked);
      toast.error("Failed to update notification preference");
    } else {
      toast.success(checked ? "Email notifications enabled" : "Email notifications disabled");
    }
  };

  const handleSaveBookingSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!salon) return;

    const days = parseInt(advanceBookingDays, 10);
    if (Number.isNaN(days) || days < 1 || days > 90) {
      toast.error("Advance booking window must be between 1 and 90 days");
      return;
    }

    setSavingBooking(true);
    try {
      const { error } = await supabase
        .from("salons")
        .update({ advance_booking_days: days, allow_advance_on_closed: allowAdvanceOnClosed })
        .eq("id", salon.id);
      if (error) throw error;
      toast.success("Booking settings saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save booking settings";
      toast.error(message);
    } finally {
      setSavingBooking(false);
    }
  };

  const onLogout = () => {
    localStorage.removeItem("owner");
    navigate("/owner-login", { replace: true });
  };

  if (loading) {
    return (
      <OwnerShell onLogout={onLogout}>
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </OwnerShell>
    );
  }
  if (!owner) return null;

  return (
    <OwnerShell onLogout={onLogout}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account, booking rules, and notifications.</p>
        </section>

        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="booking">Booking</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                  <Input placeholder="Owner name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input
                    type="password"
                    placeholder="Change password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="md:col-span-2"
                  />
                  <div className="md:col-span-2 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => navigate("/owner-dashboard")}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Settings
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="booking" className="mt-4">
            <Card>
              <CardContent className="space-y-5 p-6">
                {!salon ? (
                  <p className="text-sm text-muted-foreground">Register a salon first to manage booking settings.</p>
                ) : (
                  <form onSubmit={handleSaveBookingSettings} className="space-y-5">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-foreground">Advance booking window</label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        How many days ahead customers can book a slot at your salon (1–90).
                      </p>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        value={advanceBookingDays}
                        onChange={(e) => setAdvanceBookingDays(e.target.value)}
                        className="max-w-[160px]"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border p-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Allow advance booking when closed</p>
                        <p className="text-xs text-muted-foreground">
                          Let customers schedule a future visit even while your salon is currently marked closed.
                        </p>
                      </div>
                      <Switch checked={allowAdvanceOnClosed} onCheckedChange={setAllowAdvanceOnClosed} />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={savingBooking}>
                        {savingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Booking Settings
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Email notifications</p>
                      <p className="text-xs text-muted-foreground">Booking confirmations and updates sent to your email.</p>
                    </div>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={handleToggleEmailNotifications} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4 opacity-60">
                  <div>
                    <p className="text-sm font-semibold text-foreground">SMS notifications</p>
                    <p className="text-xs text-muted-foreground">Coming soon.</p>
                  </div>
                  <Switch disabled checked={false} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4 opacity-60">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Push notifications</p>
                    <p className="text-xs text-muted-foreground">Coming soon.</p>
                  </div>
                  <Switch disabled checked={false} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="danger" className="mt-4">
            <Card className="border-destructive/30">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Delete salon or account</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deleting your salon or account permanently removes your services, staff, and booking history. This
                      cannot be undone, so it's handled by our support team rather than a self-serve button here.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    window.location.href = `mailto:support@snippr.app?subject=${encodeURIComponent(
                      "Request to delete my salon/account"
                    )}&body=${encodeURIComponent(
                      `Owner: ${owner.name} (${owner.email})\nSalon ID: ${salon?.id ?? "unknown"}\n\nPlease permanently delete my account and salon data.`
                    )}`;
                  }}
                >
                  Contact support to delete my account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </OwnerShell>
  );
}
