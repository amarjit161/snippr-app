import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Loader2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerShell } from "@/components/dashboard/OwnerShell";
import { toast } from "sonner";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
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
  is_manual_closed: boolean;
  image_url: string | null;
};

export default function SalonProfile() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [salon, setSalon] = useState<SalonRow | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [phone, setPhone] = useState("");
  const [isManualClosed, setIsManualClosed] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const imagePreview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);

  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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

        const { data, error } = await supabaseAny.from("salons").select("*").eq("owner_id", parsed.id).maybeSingle();
        if (error) throw error;
        if (!data) {
          toast.error("No salon found for this owner");
          navigate("/owner-dashboard", { replace: true });
          return;
        }

        const row = data as SalonRow;
        setSalon(row);
        setName(row.name || "");
        setAddress(row.address || "");
        setCity(row.city || "");
        setPincode(row.pincode || "");
        setOpenTime(row.open_time || "09:00");
        setCloseTime(row.close_time || "20:00");
        setPhone(parsed.phone || "");
        setIsManualClosed(row.is_manual_closed || false);
      } catch (error) {
        console.error(error);
        localStorage.removeItem("owner");
        navigate("/owner-login", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate, supabaseAny]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!salon) return;

    if (!name.trim() || !address.trim() || !city.trim() || !pincode.trim() || !phone.trim()) {
      toast.error("Please complete all salon details");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = salon.image_url;

      if (imageFile) {
        setUploading(true);
        const compressedFile = await imageCompression(imageFile, { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true });
        const fileName = `salons/${Date.now()}-${compressedFile.name}`;
        const { data, error } = await supabase.storage.from("salon-images").upload(fileName, compressedFile, { upsert: true });
        setUploading(false);

        if (error) throw error;
        imageUrl = data?.path || imageUrl;
      }

      const location = `${address.trim()}, ${city.trim()} - ${pincode.trim()}`;
      const { error } = await supabaseAny
        .from("salons")
        .update({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          pincode: pincode.trim(),
          open_time: openTime,
          close_time: closeTime,
          location,
          is_manual_closed: isManualClosed,
          image_url: imageUrl,
        })
        .eq("id", salon.id);

      if (error) throw error;
      toast.success("Salon profile saved");
      console.log("SALON_PROFILE_SAVE_SUCCESS", { is_manual_closed: isManualClosed });
      navigate("/owner-dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save salon profile";
      toast.error(message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </OwnerShell>
    );
  }

  if (!owner || !salon) return null;

  return (
    <OwnerShell onLogout={() => { localStorage.removeItem("owner"); navigate("/owner-login", { replace: true }); }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-elevation-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Salon Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Update your salon identity and operating details.</p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="font-display text-xl font-bold text-foreground">Basic Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Salon name" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="md:col-span-2" />
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
                <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Pincode" />
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Open / Close Toggle</p>
                    <p className="text-xs text-muted-foreground">Toggle on to manually close, off to keep open.</p>
                  </div>
                  <Switch checked={isManualClosed} onCheckedChange={(checked) => setIsManualClosed(checked)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-5">
              <h2 className="font-display text-xl font-bold text-foreground">Timing & Image</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <div className="rounded-xl border border-dashed border-border p-4 transition-colors hover:border-primary/40">
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                    <Camera className="h-4 w-4 text-primary" /> Upload image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {uploading && <p className="mt-3 inline-flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</p>}
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={imagePreview || salon?.image_url || "/default-salon.jpg"}
                    alt={salon?.name ?? "Salon"}
                    loading="lazy"
                    decoding="async"
                    className="h-40 w-full object-cover"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 rounded-2xl border border-border bg-card/95 p-4 shadow-elevation-2 backdrop-blur">
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={saving || uploading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/owner-dashboard")}>Cancel</Button>
            </div>
          </div>
        </form>
      </div>
    </OwnerShell>
  );
}

