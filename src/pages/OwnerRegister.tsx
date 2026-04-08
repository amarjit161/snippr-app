import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import imageCompression from "browser-image-compression";
import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
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

const triggerOwnerVerificationEmail = async (ownerEmail: string, name: string) => {
  const verificationEndpoint = import.meta.env.VITE_OWNER_VERIFICATION_ENDPOINT as string | undefined;

  if (!verificationEndpoint) {
    return { sent: false, reason: "no-endpoint" as const };
  }

  try {
    await fetch(verificationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, name }),
    });
    return { sent: true, reason: null };
  } catch {
    return { sent: false, reason: "request-failed" as const };
  }
};

export default function OwnerRegister() {
  const navigate = useNavigate();


  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);

  const [name, setName] = useState("");
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
    turnstileRef.current?.reset();
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const removeBarber = (index: number) => {
    setBarbers((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
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
    if (submitting || uploadingImage || verifyingCaptcha) return;
    if (!validateForm()) return;

    setVerifyingCaptcha(true);

    const token = turnstileRef.current?.getResponse() || "";
    if (!token) {
      toast.error("Invalid or expired captcha");
      resetCaptcha();
      setVerifyingCaptcha(false);
      return;
    }

    const captchaResult = await verifyTurnstileToken(token);
    if (!captchaResult.success) {
      toast.error(captchaResult.message || "Captcha verification failed");
      resetCaptcha();
      setVerifyingCaptcha(false);
      return;
    }

    resetCaptcha();
    setVerifyingCaptcha(false);

    setSubmitting(true);

    try {
      // 1. SIGNUP
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      console.log("Signup:", data);
      if (error) throw error;

      // 2. WAIT FOR AUTH PROPAGATION
      await new Promise(res => setTimeout(res, 1500));

      // 3. GET USER FROM SIGNUP DATA
      const user = data.user;
      console.log("User:", user);

      if (!user) {
        toast.info("Please check your email and verify account");
        setSubmitting(false);
        return;
      }

      console.log("Upserting owner profile for UID:", user.id);
      const { data: ownerData, error: upsertError } = await supabase.from("owners").upsert({
        id: user.id,
        email: user.email!,
        name: name.trim(),
        phone: phone.trim(),
        is_verified: true,
        is_active: true,
      }, { onConflict: "id" }).select("*").single();

      console.log("Owner insert:", ownerData);

      if (upsertError) throw upsertError;
      if (!ownerData) throw new Error("Could not retrieve owner profile");

      const normalizedOwner = ownerData;

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

      const payload = {
        name: salonName.trim(),
        owner_id: normalizedOwner.id,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        pincode: pincode.trim() || null,
        open_time: openTime || null,
        close_time: closeTime || null,
        image_url: imagePath || null,
        location: address.trim() || null,
      };

      const { data: salonData, error: salonError } = await supabase
        .from("salons")
        .insert([payload])
        .select("id")
        .single();
 
      console.log("Salon:", salonData);
      if (salonError) throw salonError;
      if (!salonData) throw new Error("Salon creation failed");
 
      const { error: servicesError } = await supabase.from("services").insert(
        services.map((service) => ({
          salon_id: salonData.id,
          name: service.name.trim(),
          price: Number(service.price),
          duration: Number(service.duration),
        }))
      );

      console.log("Services:", servicesError === null ? "Success" : servicesError);
      if (servicesError) throw servicesError;

      const barberPayloads = barbers.map((barber) => ({
        salon_id: salonData.id,
        name: barber.name.trim(),
        chair_number: Number(barber.chair) || 1,
        specialization: barber.specialization.trim(),
      }));

      const { error: barbersError } = await supabase.from("barbers").insert(barberPayloads);

      console.log("Barbers:", barbersError === null ? "Success" : barbersError);
      if (barbersError) throw barbersError;

      const verificationResult = await triggerOwnerVerificationEmail(normalizedOwner.email, normalizedOwner.name);

      localStorage.setItem("owner", JSON.stringify(normalizedOwner));
      toast.success("Account created and salon registered");
      if (!verificationResult.sent) {
        toast.info("Verification email disabled for local development.");
      }
      navigate("/owner-dashboard", { replace: true });
    } catch (error: any) {
      console.error("DEBUG ERROR:", error);
      const message = error?.message || "Something went wrong during registration";
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
              <Input placeholder="Owner name" value={name} onChange={(e) => setName(e.target.value)} required />
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
            <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} className="min-h-[78px]" />
          </section>

          <Button
            type="submit"
            disabled={submitting || uploadingImage || verifyingCaptcha || !captchaToken}
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
