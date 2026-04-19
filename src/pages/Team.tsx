import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type SalonRow = { id: string };
type BarberRow = { id: string; name: string; chair_number: number | null; specialization: string | null };
type OwnerRecord = { id: string; name: string; email: string };

export default function Team() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [barbers, setBarbers] = useState<BarberRow[]>([]);
  const [newMember, setNewMember] = useState({ name: "", chair: "1", specialization: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", chair: "1", specialization: "" });

  const salonId = salon?.id;

  const fetchBarbers = async (id: string) => {
    if (import.meta.env.DEV) console.log("🔥 FETCHING BARBERS for salon:", id);

    try {
      const { data, error } = await supabaseAny
        .from("barbers")
        .select("*")
        .eq("salon_id", id)
        .order("name");

      if (error) {
        if (import.meta.env.DEV) console.error("❌ FETCH ERROR:", error);
        return;
      }

      if (import.meta.env.DEV) console.log("✅ FETCH_BARBERS_RESULT:", data);
      setBarbers((data as BarberRow[]) || []);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("❌ FETCH ERROR:", error);
      toast.error(error.message || "Failed to load team members");
    }
  };

  useEffect(() => {
    if (!salonId) {
      console.log("❌ salonId not ready yet");
      return;
    }

    console.log("✅ salonId ready:", salonId);
    fetchBarbers(salonId);
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
        toast.error("Failed to initialize team settings");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!salonId) {
      console.error("❌ salonId missing during insert");
      toast.error("Salon identification missing. Please refresh.");
      return;
    }

    if (!newMember.name.trim() || !newMember.chair) {
      toast.error("Please enter valid barber details");
      return;
    }

    try {
      console.log("INSERT_TEAM_MEMBER_START", salonId);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Owner session expired. Please re-login.");

      const { error } = await (supabase.from("barbers") as any).insert({
        salon_id: salonId,
        name: newMember.name.trim(),
        chair_number: Number(newMember.chair) || 1,
        specialization: newMember.specialization.trim() || null
      });

      if (error) {
        console.error("TEAM_INSERT_ERROR:", error);
        throw error;
      }

      console.log("✅ INSERT SUCCESS");
      setNewMember({ name: "", chair: "1", specialization: "" });
      toast.success("Team member added");
      await fetchBarbers(salonId);
    } catch (error: any) {
      console.error("❌ INSERT ERROR", error);
      toast.error(error.message || "Failed to add member");
    }
  };

  const saveMember = async () => {
    if (!editingId || !salonId) return;
    
    try {
      const { error } = await supabaseAny
        .from("barbers")
        .update({
          name: draft.name.trim(),
          chair_number: Number(draft.chair) || 1,
          specialization: draft.specialization.trim() || null
        })
        .eq("id", editingId);

      if (error) throw error;

      console.log("✅ UPDATE SUCCESS");
      setEditingId(null);
      toast.success("Team member updated");
      await fetchBarbers(salonId);
    } catch (error: any) {
      console.error("❌ UPDATE_ERROR:", error);
      toast.error(error.message || "Failed to update member");
    }
  };

  const deleteMember = async (id: string) => {
    if (!salonId) return;
    try {
      const { error } = await supabaseAny.from("barbers").delete().eq("id", id);
      if (error) throw error;
      
      console.log("✅ DELETE SUCCESS");
      toast.success("Team member deleted");
      await fetchBarbers(salonId);
    } catch (error: any) {
      console.error("❌ DELETE_ERROR:", error);
      toast.error(error.message || "Failed to delete member");
    }
  };

  if (loading) return <div className="mx-auto h-72 max-w-4xl rounded-xl bg-gray-200/70 animate-pulse" />;
  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl border border-[#e3e2e5] bg-white p-6 shadow-sm">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-[#494551]">Manage your stylists and chair assignments.</p>
        </section>

        <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={addMember} className="grid gap-3 md:grid-cols-12">
              <Input placeholder="Name" value={newMember.name} onChange={(e) => setNewMember((prev) => ({ ...prev, name: e.target.value }))} className="md:col-span-4" />
              <Input placeholder="Chair Number" type="number" value={newMember.chair} onChange={(e) => setNewMember((prev) => ({ ...prev, chair: e.target.value }))} className="md:col-span-3" />
              <Input placeholder="Specialization" value={newMember.specialization} onChange={(e) => setNewMember((prev) => ({ ...prev, specialization: e.target.value }))} className="md:col-span-4" />
              <Button type="submit" className="md:col-span-1 rounded-xl"><Plus className="h-4 w-4" /></Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {barbers.length === 0 ? (
            <Card className="rounded-xl border border-dashed border-[#e3e2e5] bg-white shadow-sm md:col-span-2">
              <CardContent className="p-8 text-center text-sm text-[#494551]">No data yet.</CardContent>
            </Card>
          ) : (
            barbers.map((member) => (
              <Card key={member.id} className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
                <CardContent className="p-5 space-y-3">
                  {editingId === member.id ? (
                    <>
                      <Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" value={draft.chair} onChange={(e) => setDraft((prev) => ({ ...prev, chair: e.target.value }))} />
                        <Input value={draft.specialization} onChange={(e) => setDraft((prev) => ({ ...prev, specialization: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={saveMember} className="rounded-xl">Save</Button>
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{member.name}</p>
                          <p className="text-sm text-[#494551]">Chair {member.chair_number ?? 1} • {member.specialization || "General"}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => { 
                          setEditingId(member.id); 
                          setDraft({ 
                            name: member.name, 
                            chair: String(member.chair_number ?? 1), 
                            specialization: member.specialization || "" 
                          }); 
                        }}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => deleteMember(member.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </OwnerShell>
  );
}
