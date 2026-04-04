import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import TurnstileCaptcha from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";

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

const triggerOwnerVerificationEmail = async (ownerEmail: string, ownerName: string) => {
  const verificationEndpoint = import.meta.env.VITE_OWNER_VERIFICATION_ENDPOINT as string | undefined;

  if (!verificationEndpoint) {
    return { sent: false, reason: "no-endpoint" as const };
  }

  try {
    await fetch(verificationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, ownerName }),
    });
    return { sent: true, reason: null };
  } catch {
    return { sent: false, reason: "request-failed" as const };
  }
};

export default function OwnerRegister() {
  const navigate = useNavigate();
  const supabaseAny = supabase as any;

  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [salonName, setSalonName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [services, setServices] = useState<ServiceForm[]>([{ name: "Haircut", price: "300", duration: "30" }]);
  const [barbers, setBarbers] = useState<BarberForm[]>([{ name: "", chair: "1", specialization: "Haircut" }]);

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

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const removeBarber = (index: number) => {
    setBarbers((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!ownerName.trim() || !email.trim() || !password.trim()) {
      toast.error("Please complete owner info");
      return false;
    }

    if (!salonName.trim() || !address.trim() || !city.trim() || !pincode.trim() || !phone.trim()) {
      toast.error("Please complete salon info");
      return false;
    }

    if (!openTime || !closeTime) {
      toast.error("Please select salon timings");
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
      toast.error("Image size should be 5MB or less");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || uploadingImage) return;
    if (!validateForm()) return;

    if (!captchaToken) {
      toast.error("Please complete the captcha");
      return;
    }

    const captchaResult = await verifyTurnstileToken(captchaToken);
    if (!captchaResult.success) {
      toast.error(captchaResult.message || "Captcha verification failed");
      resetCaptcha();
      return;
    }

    resetCaptcha();

    setSubmitting(true);

    try {
      const { data: existingOwner, error: existingOwnerError } = await supabaseAny
        .from("owners")
        .select("id")
        .eq("email", email.trim())
        .maybeSingle();

      if (existingOwnerError) {
        throw new Error(existingOwnerError.message || "Failed to validate owner account");
      }

      if (existingOwner) {
        toast.error("Owner with this email already exists");
        return;
      }

      let owner: any = null;
      let ownerError: any = null;

      const primaryInsert = await supabaseAny
        .from("owners")
        .insert([
          {
            name: ownerName.trim(),
            email: email.trim(),
            password,
            is_verified: false,
          },
        ])
        .select("*")
        .single();

      owner = primaryInsert.data;
      ownerError = primaryInsert.error;

      // Backward-compatibility fallback for legacy owner_name schema variants.
      if (ownerError && !owner) {
        const fallbackInsert = await supabaseAny
          .from("owners")
          .insert([
            {
              owner_name: ownerName.trim(),
              email: email.trim(),
              password,
              phone: phone.trim(),
              is_verified: false,
            },
          ])
          .select("*")
          .single();

        owner = fallbackInsert.data;
        ownerError = fallbackInsert.error;
      }

      if (ownerError || !owner) {
        throw new Error(ownerError?.message || "Failed to create owner");
      }

      const normalizedOwner = {
        ...owner,
        owner_name: owner.owner_name || owner.name || ownerName.trim(),
      };

      let imagePath: string | null = null;

      if (imageFile) {
        setUploadingImage(true);
        try {
          const compressedFile = await imageCompression(imageFile, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1024,
            useWebWorker: true,
          });

          const fileName = `salons/${Date.now()}-${compressedFile.name}`;
          const { data: imageData, error: uploadError } = await supabase.storage
            .from("salon-images")
            .upload(fileName, compressedFile, { upsert: true });

          if (!uploadError && imageData) {
            imagePath = imageData.path;
          } else {
            console.warn("Image upload skipped:", uploadError?.message);
            toast.warning("Image upload failed. Using default image.");
          }
        } finally {
          setUploadingImage(false);
        }
      }

      const payload: Record<string, unknown> = {
        name: salonName.trim(),
        owner_id: normalizedOwner.id,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        pincode: pincode.trim() || null,
        open_time: openTime || null,
        close_time: closeTime || null,
        image_url: imagePath || null,
      };

      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          payload[key] = null;
        }
      });

      const { data: salon, error: salonError } = await supabaseAny
        .from("salons")
        .insert([payload])
        .select("id")
        .single();

      if (salonError || !salon) {
        throw new Error(salonError?.message || "Failed to create salon");
      }

      const { error: servicesError } = await supabaseAny.from("services").insert(
        services.map((service) => ({
          salon_id: salon.id,
          name: service.name.trim(),
          price: Number(service.price),
          duration: Number(service.duration),
        }))
      );

      if (servicesError) {
        throw new Error(servicesError.message || "Failed to save services");
      }

      const barberPayloads = barbers.map((barber) => {
        const payload: Record<string, unknown> = {
          salon_id: salon.id,
          name: barber.name.trim(),
          chair_number: Number(barber.chair) || 1,
          specialization: barber.specialization.trim(),
        };
        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) payload[key] = null;
        });
        return payload;
      });

      const { error: barbersError } = await supabaseAny.from("barbers").insert(barberPayloads);

      if (barbersError) {
        throw new Error(barbersError.message || "Failed to save barbers");
      }

      const verificationResult = await triggerOwnerVerificationEmail(normalizedOwner.email, normalizedOwner.owner_name);

      localStorage.setItem("owner", JSON.stringify(normalizedOwner));
      toast.success("Account created and salon registered");
      if (!verificationResult.sent) {
        toast.info("Verification email endpoint not configured. Mark owner as verified manually or configure endpoint.");
      }
      navigate("/owner-dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Owner signup failed";
      console.error("Owner register error:", error);
      if (message.includes("public.owners") || message.includes("PGRST205")) {
        toast.error("Owners table missing in Supabase public schema. Apply migration 0009_fix_owners_schema_cache.sql.");
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header userName="Owner" isAdmin={false} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="font-display text-3xl font-bold">Create Owner Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign up as a salon owner and set up your salon in one flow.</p>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Owner Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="md:col-span-2" required />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Salon Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Salon name" value={salonName} onChange={(e) => setSalonName(e.target.value)} required />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className="md:col-span-2" required />
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required />
              <Input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">Timing</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} required />
              <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} required />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Services</h2>
              <Button type="button" variant="outline" onClick={addService}>
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </div>

            <div className="space-y-3">
              {services.map((service, index) => (
                <div key={`service-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-12">
                  <Input
                    placeholder="Service name"
                    value={service.name}
                    onChange={(e) => updateService(index, "name", e.target.value)}
                    className="md:col-span-5"
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={service.price}
                    onChange={(e) => updateService(index, "price", e.target.value)}
                    className="md:col-span-3"
                  />
                  <Input
                    type="number"
                    placeholder="Duration"
                    value={service.duration}
                    onChange={(e) => updateService(index, "duration", e.target.value)}
                    className="md:col-span-3"
                  />
                  <Button type="button" variant="outline" className="md:col-span-1" onClick={() => removeService(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Barbers</h2>
              <Button type="button" variant="outline" onClick={addBarber}>
                <Plus className="mr-2 h-4 w-4" /> Add Barber
              </Button>
            </div>

            <div className="space-y-3">
              {barbers.map((barber, index) => (
                <div key={`barber-${index}`} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-12">
                  <Input
                    placeholder="Name"
                    value={barber.name}
                    onChange={(e) => updateBarber(index, "name", e.target.value)}
                    className="md:col-span-4"
                  />
                  <Input
                    type="number"
                    placeholder="Chair Number"
                    value={barber.chair}
                    onChange={(e) => updateBarber(index, "chair", e.target.value)}
                    className="md:col-span-3"
                  />
                  <Input
                    placeholder="Specialization"
                    value={barber.specialization}
                    onChange={(e) => updateBarber(index, "specialization", e.target.value)}
                    className="md:col-span-4"
                  />
                  <Button type="button" variant="outline" className="md:col-span-1" onClick={() => removeBarber(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-md space-y-4">
            <h2 className="text-lg font-semibold">Salon Image</h2>
            <div className="rounded-xl border border-dashed border-border p-4">
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
                <img src={imagePreview} alt="Salon preview" className="mt-4 h-56 w-full rounded-xl object-cover" />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No image selected.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-md space-y-4">
            <h2 className="text-lg font-semibold">Verification</h2>
            <TurnstileCaptcha key={captchaResetKey} onTokenChange={setCaptchaToken} className="min-h-[78px]" />
          </section>

          <Button
            type="submit"
            disabled={submitting || uploadingImage || !captchaToken}
            className="h-12 w-full rounded-xl bg-primary transition-transform duration-200 hover:scale-105"
          >
            {submitting || uploadingImage ? (
              <span className="inline-flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadingImage ? "Uploading image..." : "Creating account..."}
              </span>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
