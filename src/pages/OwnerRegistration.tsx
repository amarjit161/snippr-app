import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Plus, Trash2 } from "lucide-react";

type ServiceForm = {
  name: string;
  price: string;
  duration: string;
};

type BarberForm = {
  name: string;
  chair: string;
};

export default function OwnerRegistration() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [salonName, setSalonName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [manualClosed, setManualClosed] = useState(false);

  const [services, setServices] = useState<ServiceForm[]>([{ name: "Haircut", price: "300", duration: "30" }]);
  const [barbers, setBarbers] = useState<BarberForm[]>([{ name: "", chair: "1" }]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".reg-section", {
        y: 24,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: "power2.out",
      });
    });

    return () => ctx.revert();
  }, []);

  const imagePreview = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const updateService = (index: number, field: keyof ServiceForm, value: string) => {
    setServices((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const updateBarber = (index: number, field: keyof BarberForm, value: string) => {
    setBarbers((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addService = () => setServices((prev) => [...prev, { name: "", price: "", duration: "" }]);
  const addBarber = () => setBarbers((prev) => [...prev, { name: "", chair: "1" }]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported on this device.");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        toast.success("Location detected successfully.");
        setDetectingLocation(false);
      },
      (error) => {
        toast.error(error.message || "Unable to detect location.");
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validateForm = () => {
    if (!salonName.trim() || !ownerName.trim() || !phone.trim()) {
      toast.error("Please complete all basic salon details.");
      return false;
    }

    if (!address.trim() || !city.trim() || !pincode.trim()) {
      toast.error("Please complete location details.");
      return false;
    }

    if (!openTime || !closeTime) {
      toast.error("Please select opening and closing time.");
      return false;
    }

    if (services.length === 0 || services.some((s) => !s.name.trim() || !s.price || !s.duration)) {
      toast.error("Please add valid service entries.");
      return false;
    }

    if (barbers.length === 0 || barbers.some((b) => !b.name.trim() || !b.chair)) {
      toast.error("Please add valid barber entries.");
      return false;
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const path = `${user.id}/${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage.from("salon-images").upload(path, imageFile, { upsert: true });
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from("salon-images").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }

      const location = `${address.trim()}, ${city.trim()} - ${pincode.trim()}`;
      const salonPayload = {
        name: salonName.trim(),
        owner_id: user.id,
        location,
        address: address.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        lat,
        lng,
        open_time: openTime,
        close_time: closeTime,
        status: manualClosed ? "closed" : "open",
        is_manual_closed: manualClosed,
        image_url: imageUrl,
      };

      const { data: salonData, error: salonError } = await supabase
        .from("salons")
        .insert(salonPayload as any)
        .select("id")
        .single();

      if (salonError || !salonData) throw new Error(salonError?.message || "Could not create salon.");

      const salonId = salonData.id;

      const servicesPayload = services.map((service) => ({
        salon_id: salonId,
        name: service.name.trim(),
        price: Number(service.price),
        duration: Number(service.duration),
      }));

      const { error: servicesError } = await supabase.from("services").insert(servicesPayload as any);
      if (servicesError) throw new Error(`Service creation failed: ${servicesError.message}`);

      const barbersPayload = barbers.map((barber) => {
        const payload: Record<string, unknown> = {
          salon_id: salonId,
          name: barber.name.trim(),
          chair_number: Number(barber.chair) || 1,
        };
        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) payload[key] = null;
        });
        return payload;
      });

      const { error: barbersError } = await supabase.from("barbers" as any).insert(barbersPayload as any);
      if (barbersError) throw new Error(`Barber creation failed: ${barbersError.message}`);

      const { error: profileError } = await supabase
        .from("owners")
        .update({ name: ownerName.trim(), phone: phone.trim() } as any)
        .eq("id", user.id);

      if (profileError) {
        console.warn("Profile update warning:", profileError.message);
      }

      toast.success("Salon registered successfully.");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      console.error("Salon registration error:", error);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 p-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!user) return null;

  const email = user.email || "";

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header onSignOut={signOut} userName={email || "Owner"} isAdmin={false} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
        <section className="reg-section rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
          <h1 className="font-display text-3xl font-bold text-foreground">Register Your Salon</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your Snippr storefront, add services and barbers, and start accepting live queue bookings.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="reg-section space-y-4 rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Section 1: Basic Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Salon Name" value={salonName} onChange={(e) => setSalonName(e.target.value)} />
              <Input placeholder="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              <Input value={email} disabled className="md:col-span-2 opacity-100" />
              <Input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="md:col-span-2" />
            </div>
          </section>

          <section className="reg-section space-y-4 rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Section 2: Location</h2>
            <Button type="button" onClick={detectLocation} disabled={detectingLocation} variant="outline" className="opacity-100">
              {detectingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
              Auto Detect Location
            </Button>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Full Address" value={address} onChange={(e) => setAddress(e.target.value)} className="md:col-span-2" />
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              <Input placeholder="Latitude" value={lat ?? ""} readOnly />
              <Input placeholder="Longitude" value={lng ?? ""} readOnly />
            </div>
          </section>

          <section className="reg-section space-y-4 rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Section 3: Salon Timing</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-4">
              <div>
                <p className="font-medium">Mark salon closed manually</p>
                <p className="text-xs text-muted-foreground">Enable this if the salon is temporarily unavailable.</p>
              </div>
              <Switch checked={manualClosed} onCheckedChange={setManualClosed} />
            </div>
          </section>

          <section className="reg-section space-y-4 rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Section 4: Services</h2>
              <Button type="button" variant="outline" onClick={addService} className="opacity-100">
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </div>

            <div className="space-y-4">
              {services.map((service, index) => (
                <div key={`service-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-12">
                  <Input
                    placeholder="Service Name"
                    value={service.name}
                    onChange={(e) => updateService(index, "name", e.target.value)}
                    className="md:col-span-5"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    value={service.price}
                    onChange={(e) => updateService(index, "price", e.target.value)}
                    className="md:col-span-3"
                  />
                  <Input
                    placeholder="Duration (mins)"
                    type="number"
                    value={service.duration}
                    onChange={(e) => updateService(index, "duration", e.target.value)}
                    className="md:col-span-3"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="md:col-span-1 opacity-100"
                    disabled={services.length === 1}
                    onClick={() => setServices((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="reg-section space-y-4 rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Section 5: Barbers</h2>
              <Button type="button" variant="outline" onClick={addBarber} className="opacity-100">
                <Plus className="mr-2 h-4 w-4" /> Add Barber
              </Button>
            </div>

            <div className="space-y-4">
              {barbers.map((barber, index) => (
                <div key={`barber-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-12">
                  <Input
                    placeholder="Barber Name"
                    value={barber.name}
                    onChange={(e) => updateBarber(index, "name", e.target.value)}
                    className="md:col-span-8"
                  />
                  <Input
                    placeholder="Chair Number"
                    type="number"
                    value={barber.chair}
                    onChange={(e) => updateBarber(index, "chair", e.target.value)}
                    className="md:col-span-3"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="md:col-span-1 opacity-100"
                    disabled={barbers.length === 1}
                    onClick={() => setBarbers((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="reg-section space-y-4 rounded-2xl border border-border bg-white/85 p-6 shadow-md backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Section 6: Salon Image</h2>
            <div className="rounded-xl border border-dashed border-border p-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                <Camera className="h-4 w-4" />
                Upload image (max 5MB)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {imagePreview ? (
                <img src={imagePreview} alt="Salon preview" className="mt-4 h-48 w-full rounded-xl object-cover" />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No image selected.</p>
              )}
            </div>
          </section>

          <div className="sticky bottom-4 z-20 rounded-2xl border border-border bg-white/90 p-4 shadow-md backdrop-blur-sm">
            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl opacity-100" size="lg">
              {submitting ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering Salon...
                </span>
              ) : (
                "Register Salon"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
