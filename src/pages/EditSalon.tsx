import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
};

type SalonRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  pincode: string | null;
  open_time: string | null;
  close_time: string | null;
  location: string | null;
};

export default function EditSalon() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;

  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("20:00");

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate("/owner-login", { replace: true });
        return;
      }

      setOwner({ id: authUser.id, email: authUser.email || "", name: authUser.user_metadata?.name || "" });

      const { data: salonData, error } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", authUser.id)
        .maybeSingle();

      if (error) {
        toast.error(error.message || "Failed to fetch salon");
        navigate("/owner-dashboard", { replace: true });
        return;
      }

      if (!salonData) {
        toast.error("No salon found to edit");
        navigate("/owner-dashboard", { replace: true });
        return;
      }

      const row = salonData as SalonRow;
      setSalon(row);
      setName(row.name || "");
      setAddress(row.address || "");
      setCity(row.city || "");
      setPincode(row.pincode || "");
      setOpenTime(row.open_time || "09:00");
      setCloseTime(row.close_time || "20:00");
      setLoading(false);
    };

    init();
  }, [navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!salon) return;

    if (!name.trim() || !address.trim() || !openTime || !closeTime) {
      toast.error("Please complete required fields");
      return;
    }

    setSaving(true);

    const location = city.trim() && pincode.trim()
      ? `${address.trim()}, ${city.trim()} - ${pincode.trim()}`
      : address.trim();

    const { error } = await supabaseAny
      .from("salons")
      .update({
        name: name.trim(),
        address: address.trim(),
        city: city.trim() || null,
        pincode: pincode.trim() || null,
        open_time: openTime,
        close_time: closeTime,
        location,
      })
      .eq("id", salon.id);

    setSaving(false);

    if (error) {
      toast.error(error.message || "Failed to update salon");
      return;
    }

    toast.success("Salon profile updated");
    navigate("/owner-dashboard", { replace: true });
  };

  if (loading) {
    return (
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 p-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!owner) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header userName={owner.name || owner.email} isAdmin={false} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
        <section className="rounded-2xl bg-white p-6 shadow-md">
          <h1 className="font-display text-3xl font-bold">Edit Salon</h1>
          <p className="mt-2 text-sm text-muted-foreground">Update your salon profile details.</p>
        </section>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-md space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Salon name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} required />
            <Input placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
            <Input placeholder="Pincode" value={pincode} onChange={(event) => setPincode(event.target.value)} />
            <Input type="time" value={openTime} onChange={(event) => setOpenTime(event.target.value)} required />
            <Input type="time" value={closeTime} onChange={(event) => setCloseTime(event.target.value)} required />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/owner-dashboard")}>Cancel</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
