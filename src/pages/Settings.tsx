import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  owner_name: string;
  email: string;
  password?: string;
};

export default function Settings() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("owner");
    if (!raw) {
      navigate("/owner-login", { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OwnerRecord;
      setOwner(parsed);
      setName(parsed.owner_name || "");
      setEmail(parsed.email || "");
    } catch {
      localStorage.removeItem("owner");
      navigate("/owner-login", { replace: true });
    } finally {
      setLoading(false);
    }
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
      const payload: Record<string, unknown> = { owner_name: name.trim(), email: email.trim() };
      if (password.trim()) payload.password = password.trim();

      const { error } = await supabaseAny.from("owners").update(payload).eq("id", owner.id);
      if (error) throw error;

      const updatedOwner = { ...owner, owner_name: name.trim(), email: email.trim(), password: password.trim() || owner.password };
      localStorage.setItem("owner", JSON.stringify(updatedOwner));
      toast.success("Settings saved");
      setPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="mx-auto h-72 max-w-3xl rounded-xl bg-gray-200/70 animate-pulse" />;
  if (!owner) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-[#e3e2e5] bg-white p-6 shadow-sm">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[#494551]">Manage owner account details and password.</p>
        </section>

        <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Owner name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="password" placeholder="Change password" value={password} onChange={(e) => setPassword(e.target.value)} className="md:col-span-2" />
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/owner-dashboard")}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </OwnerShell>
  );
}
