import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type SalonRow = { id: string };
type ServiceRow = { id: string; name: string; price: number; duration: number };
type OwnerRecord = { id: string; name: string; email: string };

export default function Services() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [newService, setNewService] = useState({ name: "", price: "", duration: "" });
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceDraft, setServiceDraft] = useState({ name: "", price: "", duration: "" });

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
        
        const validatedSalon = salonData as SalonRow | null;
        setSalon(validatedSalon);

        if (validatedSalon?.id) {
          console.log("SALON_ID_READY:", validatedSalon.id);
          const { data, error: fetchError } = await supabaseAny
            .from("services")
            .select("*")
            .eq("salon_id", validatedSalon.id)
            .order("name");
          
          if (fetchError) throw fetchError;
          setServices((data as ServiceRow[]) || []);
        }
      } catch (error: any) {
        console.error("❌ SERVICES_INIT_ERROR:", error);
        toast.error("Failed to initialize services");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate, supabaseAny]);

  const refresh = async () => {
    if (!salon?.id) return;
    try {
      const { data, error } = await supabaseAny.from("services").select("*").eq("salon_id", salon.id).order("name");
      if (error) throw error;
      setServices((data as ServiceRow[]) || []);
    } catch (error: any) {
      console.error("❌ REFRESH_ERROR:", error);
    }
  };

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!salon?.id) {
      toast.error("Salon identification missing");
      return;
    }
    if (!newService.name.trim() || !newService.price || !newService.duration) {
      toast.error("Please enter valid service details");
      return;
    }
    try {
      console.log("ADD_SERVICE_START", salon.id);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Owner session expired. Please re-login.");

      const { error } = await (supabase.from("services") as any).insert({ 
        salon_id: salon.id, 
        name: newService.name.trim(), 
        price: Number(newService.price), 
        duration: Number(newService.duration) 
      });

      if (error) {
        console.error("SERVICE_INSERT_ERROR:", error);
        throw error;
      }

      setNewService({ name: "", price: "", duration: "" });
      toast.success("Service added");
      await refresh();
    } catch (error: any) {
      console.error("❌ ADD_ERROR:", error);
      toast.error(error.message || "Failed to add service");
    }
  };

  const handleSave = async () => {
    if (!editingServiceId) return;
    try {
      const { error } = await supabaseAny.from("services").update({ 
        name: serviceDraft.name.trim(), 
        price: Number(serviceDraft.price), 
        duration: Number(serviceDraft.duration) 
      }).eq("id", editingServiceId);
      
      if (error) throw error;
      setEditingServiceId(null);
      toast.success("Service updated");
      await refresh();
    } catch (error: any) {
      console.error("❌ SAVE_ERROR:", error);
      toast.error(error.message || "Failed to update service");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseAny.from("services").delete().eq("id", id);
      if (error) throw error;
      toast.success("Service deleted");
      setServices((prev) => prev.filter((item) => item.id !== id));
    } catch (error: any) {
      console.error("❌ DELETE_ERROR:", error);
      toast.error(error.message || "Failed to delete service");
    }
  };

  if (loading) return <div className="mx-auto h-72 max-w-4xl rounded-xl bg-gray-200/70 animate-pulse" />;
  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl border border-[#e3e2e5] bg-white p-6 shadow-sm">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-[#494551]">Manage your salon services and pricing.</p>
        </section>

        <Card className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleAdd} className="grid gap-3 md:grid-cols-12">
              <Input placeholder="Service name" value={newService.name} onChange={(e) => setNewService((prev) => ({ ...prev, name: e.target.value }))} className="md:col-span-5" />
              <Input placeholder="Price" type="number" value={newService.price} onChange={(e) => setNewService((prev) => ({ ...prev, price: e.target.value }))} className="md:col-span-3" />
              <Input placeholder="Duration" type="number" value={newService.duration} onChange={(e) => setNewService((prev) => ({ ...prev, duration: e.target.value }))} className="md:col-span-3" />
              <Button type="submit" className="md:col-span-1 rounded-xl"><Plus className="h-4 w-4" /></Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {services.length === 0 ? (
            <Card className="rounded-xl border border-dashed border-[#e3e2e5] bg-white shadow-sm md:col-span-2"><CardContent className="p-8 text-center text-sm text-[#494551]">No data yet.</CardContent></Card>
          ) : services.map((service) => (
            <Card key={service.id} className="rounded-xl border border-[#e3e2e5] bg-white shadow-sm">
              <CardContent className="p-5 space-y-3">
                {editingServiceId === service.id ? (
                  <>
                    <Input value={serviceDraft.name} onChange={(e) => setServiceDraft((prev) => ({ ...prev, name: e.target.value }))} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="number" value={serviceDraft.price} onChange={(e) => setServiceDraft((prev) => ({ ...prev, price: e.target.value }))} />
                      <Input type="number" value={serviceDraft.duration} onChange={(e) => setServiceDraft((prev) => ({ ...prev, duration: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} className="rounded-xl"><Loader2 className="mr-2 h-4 w-4 opacity-0" />Save</Button>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditingServiceId(null)}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-sm text-[#494551]">INR {service.price} • {service.duration} mins</p>
                      </div>
                      <BadgeActions setEditingServiceId={setEditingServiceId} setServiceDraft={setServiceDraft} service={service} onDelete={handleDelete} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </OwnerShell>
  );
}

function BadgeActions({ service, setEditingServiceId, setServiceDraft, onDelete }: any) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setEditingServiceId(service.id); setServiceDraft({ name: service.name, price: String(service.price), duration: String(service.duration) }); }}><Pencil className="h-4 w-4" /></Button>
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => onDelete(service.id)}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}
