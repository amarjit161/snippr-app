import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import imageCompression from "browser-image-compression";

type OwnerRecord = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
};

type ServiceForm = {
  name: string;
  price: string;
  duration: string;
};

type BarberForm = {
  name: string;
  chair: string;
  specialization: string;
};

export default function RegisterSalon() {
  const navigate = useNavigate();
  const [owner, setOwner] = useState<OwnerRecord | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const [salonName, setSalonName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [autoClose, setAutoClose] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [services, setServices] = useState<ServiceForm[]>([{ name: "Haircut", price: "300", duration: "30" }]);
  const [barbers, setBarbers] = useState<BarberForm[]>([{ name: "", chair: "1", specialization: "Haircut" }]);

  useEffect(() => {
    const raw = localStorage.getItem("owner");
    if (!raw) {
      navigate("/owner-login", { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OwnerRecord;
      setOwner(parsed);
      setOwnerName(parsed.name || "");
      setEmail(parsed.email || "");
      setPhone(parsed.phone || "");
    } catch {
      localStorage.removeItem("owner");
      navigate("/owner-login", { replace: true });
    } finally {
      setLoadingOwner(false);
    }
  }, [navigate]);

  const imagePreview = useMemo(() => {
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile]);

  useEffect(() => {
    if (!imagePreview) return;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          );
          if (!res.ok) return;
          const data = await res.json();
          if (!address.trim() && data?.display_name) {
            setAddress(data.display_name);
          }
        } catch (geoError) {
          console.warn("Reverse geocode failed", geoError);
        }
      },
      () => {
        console.log("Location denied");
      }
    );
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location detected");
        setDetectingLocation(false);
      },
      (error) => {
        toast.error(error.message || "Unable to detect location");
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const updateService = (index: number, field: keyof ServiceForm, value: string) => {
    setServices((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const updateBarber = (index: number, field: keyof BarberForm, value: string) => {
    setBarbers((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addService = () => {
    setServices((prev) => [...prev, { name: "", price: "", duration: "" }]);
  };

  const addBarber = () => {
    setBarbers((prev) => [...prev, { name: "", chair: "1", specialization: "Haircut" }]);
  };

  const validate = () => {
    if (!owner || !salonName.trim() || !ownerName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Please complete basic details");
      return false;
    }

    if (!address.trim() || !city.trim() || !pincode.trim()) {
      toast.error("Please complete location details");
      return false;
    }

    if (!openTime || !closeTime) {
      toast.error("Please select salon timing");
      return false;
    }

    if (services.length === 0 || services.some((s) => !s.name.trim() || !s.price || !s.duration)) {
      toast.error("Please add valid services");
      return false;
    }

    if (barbers.length === 0 || barbers.some((b) => !b.name.trim() || !b.chair || !b.specialization.trim())) {
      toast.error("Please add valid barbers");
      return false;
    }

    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      toast.error("Image should be <= 5MB");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || uploadingImage) return;
    if (!validate() || !owner) return;

    setSubmitting(true);
 
    try {
      console.log("STEP 1: START");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("User session not found. Please login again.");
      }

      const ownerId = user.id;
      let imageUrl: string | null = null;
 
      if (imageFile) {
        setUploadingImage(true);
        try {
          const compressedFile = await imageCompression(imageFile, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
          });
 
          const fileName = `salons/${Date.now()}-${compressedFile.name}`;
          const { data, error: uploadError } = await supabase.storage
            .from("salon-images")
            .upload(fileName, compressedFile, { upsert: true });
 
          if (!uploadError && data) {
            imageUrl = data.path;
          } else {
            console.warn("Image upload skipped:", uploadError?.message);
          }
        } finally {
          setUploadingImage(false);
        }
      }
 
      console.log("STEP 2: INSERT SALON");
      
      const { data: { user: freshAuthUser } } = await supabase.auth.getUser();
      if (!freshAuthUser) throw new Error("Authentication session expired. Please login again.");

      const { data: salon, error: salonError } = await supabase
        .from("salons")
        .insert({
          name: salonName.trim(),
          owner_id: freshAuthUser.id,
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          pincode: pincode.trim() || null,
          open_time: openTime || null,
          close_time: closeTime || null,
          image_url: imageUrl || null,
          location: address.trim() || null,
        })
        .select()
        .maybeSingle();
 
      if (salonError) throw salonError;
      if (!salon) throw new Error("Failed to create salon record or permissions denied.");

      if (import.meta.env.DEV) console.log("SALON_CREATED", salon.id, "OWNER", user.id);

      // Insert services
      if (services.length > 0) {
        if (import.meta.env.DEV) console.log("STEP 3: INSERT SERVICES");
        const { error: servicesError } = await supabase.from("services").insert(
          services.map((s) => ({
            salon_id: salon.id,
            name: (s.name || "").trim() || "Service",
            price: Number(s.price) || 0,
            duration: Number(s.duration) || 30,
          }))
        );

        if (servicesError) throw servicesError;
      }

      // Insert barbers
      if (barbers.length > 0) {
        if (import.meta.env.DEV) console.log("STEP 4: INSERT BARBERS");
        const { error: barbersError } = await supabase.from("barbers").insert(
          barbers.map((b) => ({
            salon_id: salon.id,
            name: (b.name || "").trim() || "Barber",
            chair_number: Number(b.chair) || 1,
            specialization: (b.specialization || "").trim() || "General",
          }))
        );

        if (barbersError) throw barbersError;
      }

      if (import.meta.env.DEV) console.log("STEP 5: COMPLETE");
      toast.success("Salon registered successfully");
      navigate("/owner-dashboard", { replace: true });
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("REGISTER_ERROR", error);
      alert(error.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOwner) {
    return (
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 p-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!owner) return null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header userName={owner.name || owner.email} isAdmin={false} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="font-display text-3xl font-bold">Register Salon</h1>
          <p className="mt-2 text-sm text-muted-foreground">Set up your salon profile, services, and team.</p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Basic Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Salon Name" value={salonName} onChange={(e) => setSalonName(e.target.value)} />
              <Input placeholder="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              <Input value={email} readOnly className="md:col-span-2" />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="md:col-span-2" />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Location</h2>
            <Button type="button" variant="outline" onClick={detectLocation} disabled={detectingLocation}>
              {detectingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />} Auto detect
            </Button>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Full address" value={address} onChange={(e) => setAddress(e.target.value)} className="md:col-span-2" />
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Salon Timing</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <p className="font-medium">Auto close toggle</p>
                <p className="text-xs text-muted-foreground">Mark salon closed manually for now.</p>
              </div>
              <Switch checked={autoClose} onCheckedChange={setAutoClose} />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Services</h2>
              <Button type="button" variant="outline" onClick={addService}>
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </div>
            <div className="space-y-4">
              {services.map((service, index) => (
                <div key={`service-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-12">
                  <Input placeholder="Service name" value={service.name} onChange={(e) => updateService(index, "name", e.target.value)} className="md:col-span-5" />
                  <Input type="number" placeholder="Price" value={service.price} onChange={(e) => updateService(index, "price", e.target.value)} className="md:col-span-3" />
                  <Input type="number" placeholder="Duration" value={service.duration} onChange={(e) => updateService(index, "duration", e.target.value)} className="md:col-span-3" />
                  <Button type="button" variant="outline" className="md:col-span-1" onClick={() => setServices((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Barbers</h2>
              <Button type="button" variant="outline" onClick={addBarber}>
                <Plus className="mr-2 h-4 w-4" /> Add Barber
              </Button>
            </div>
            <div className="space-y-4">
              {barbers.map((barber, index) => (
                <div key={`barber-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-12">
                  <Input placeholder="Name" value={barber.name} onChange={(e) => updateBarber(index, "name", e.target.value)} className="md:col-span-4" />
                  <Input type="number" placeholder="Chair Number" value={barber.chair} onChange={(e) => updateBarber(index, "chair", e.target.value)} className="md:col-span-3" />
                  <Input placeholder="Specialization" value={barber.specialization} onChange={(e) => updateBarber(index, "specialization", e.target.value)} className="md:col-span-4" />
                  <Button type="button" variant="outline" className="md:col-span-1" onClick={() => setBarbers((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Salon Image</h2>
            <div className="rounded-xl border border-dashed border-gray-200 p-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
                <Camera className="h-4 w-4" /> Upload image (optional, max 5MB)
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </label>
              {uploadingImage && (
                <p className="mt-3 inline-flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading image...
                </p>
              )}
              {imagePreview ? (
                <img src={imagePreview} alt="Salon preview" className="mt-4 h-48 w-full rounded-xl object-cover" />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No image selected.</p>
              )}
            </div>
          </section>

          <div className="sticky bottom-4 z-20 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <Button type="submit" disabled={submitting || uploadingImage} className="h-12 w-full rounded-xl">
              {submitting || uploadingImage ? (
                <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadingImage ? "Uploading image..." : "Saving..."}</span>
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

