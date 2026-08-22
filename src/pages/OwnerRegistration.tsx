import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, ChevronLeft, Clock, Loader2, Plus, Scissors, Store, Trash2, User, Users } from "lucide-react";
import imageCompression from "browser-image-compression";
import TurnstileCaptcha, { type TurnstileCaptchaHandle } from "@/components/TurnstileCaptcha";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { V, VA, BG, DISP, BODY } from "@/components/landing/tokens";

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

const fieldStyle: React.CSSProperties = {
  padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, outline: "none",
  fontFamily: BODY, boxSizing: "border-box", width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)", marginBottom: 6, display: "block",
};

const cardStyle: React.CSSProperties = {
  borderRadius: 24, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  padding: 28, backdropFilter: "blur(20px)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: DISP, fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16,
  display: "flex", alignItems: "center", gap: 8,
};

const rowCardStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end",
  borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 14,
};

const removeBtnStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
  color: "#F87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
};

const addBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
  border: `1px solid ${V}40`, background: `${V}14`, color: VA, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: BODY,
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

export default function OwnerRegistration() {
  const navigate = useNavigate();


  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);

  const { user, profile, loading: authLoading, signOut } = useAuth();
  const STORAGE_KEY = "snippr_pending_setup";

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

  // Persistence: Restore on Mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (data.salonName) setSalonName(data.salonName);
        if (data.address) setAddress(data.address);
        if (data.city) setCity(data.city);
        if (data.pincode) setPincode(data.pincode);
        if (data.phone) setPhone(data.phone);
        if (data.openTime) setOpenTime(data.openTime);
        if (data.closeTime) setCloseTime(data.closeTime);
        if (data.services) setServices(data.services);
        if (data.barbers) setBarbers(data.barbers);
      } catch (e) {
        console.warn("Failed to restore registration state", e);
      }
    }
  }, []);

  // Persistence: Save on Change
  useEffect(() => {
    const data = {
      name, email, salonName, address, city, pincode, phone, openTime, closeTime, services, barbers
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [name, email, salonName, address, city, pincode, phone, openTime, closeTime, services, barbers]);

  // Auth: Pre-fill and Redirect
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      navigate("/owner-signup");
      return;
    }

    if (!user.email_confirmed_at) {
      toast.error("Please verify your email before registering your salon.");
      navigate("/owner-signup");
      return;
    }

    if (profile) {
      navigate("/owner-dashboard");
      return;
    }

    if (user && !name) setName(user.user_metadata?.full_name || "");
    if (user && !email) setEmail(user.email || "");
  }, [user, profile, authLoading, navigate]);

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

  const renderSteps = (active: 1 | 2 | 3) => (
    <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
      <span className="h-2 w-2 rounded-full" style={{ background: active === 1 ? V : "rgba(255,255,255,0.15)" }} />
      <span style={active === 1 ? { color: "#fff" } : undefined}>Create Account</span>
      <span>→</span>
      <span className="h-2 w-2 rounded-full" style={{ background: active === 2 ? V : "rgba(255,255,255,0.15)" }} />
      <span style={active === 2 ? { color: "#fff" } : undefined}>Verify Email</span>
      <span>→</span>
      <span className="h-2 w-2 rounded-full" style={{ background: active === 3 ? V : "rgba(255,255,255,0.15)" }} />
      <span style={active === 3 ? { color: "#fff" } : undefined}>Setup Salon</span>
    </div>
  );

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const removeBarber = (index: number) => {
    setBarbers((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    // If logged in, password is not required
    if (!name.trim() || !email.trim() || (!user && !password.trim())) {
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
      // 1. SIGNUP / SESSION CHECK
      let currentUser = user;
      
      if (!currentUser) {
        console.log("STEP 1: START SIGNUP");
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (signUpError) {
          console.error("SIGNUP_ERROR:", signUpError);
          throw signUpError;
        }

        const session = signUpData.session;
        console.log("USER_OBJECT:", signUpData.user);
        console.log("SESSION_OBJECT:", session);

        // If session is null, it means email confirmation is required
        if (!session) {
          console.log("STEP 1.5: EMAIL CONFIRMATION REQUIRED (SESSION IS NULL)");
          toast.info("Account created! Please check your email to verify your account.", {
            duration: 10000,
            description: "For local development, you can disable email confirmation in Supabase (Authentication -> Settings) to skip this step."
          });
          setSubmitting(false);
          return;
        }
        currentUser = signUpData.user;
      } else {
        console.log("STEP 1: SKIPPING SIGNUP (ALREADY AUTHENTICATED)");
      }

      if (!currentUser) {
        toast.error("User identification failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // 2. OWNER UPSERT (Check then Skip)
      console.log("STEP 2.0 (RESCUE_ACTIVE): CHECKING IF OWNER PROFILE EXISTS", currentUser.id);
      
      let finalOwner = profile; // Start with the cached profile from AuthContext

      if (finalOwner) {
        console.log("STEP 2.0.1: USING CACHED PROFILE FROM CONTEXT");
      } else {
        console.log("STEP 2.0.2: CONTEXT PROFILE MISSING, QUERYING DB...");
        try {
          const checkPromise = supabase
            .from("owners")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

          const timeoutPromise = new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error("Profile Check Timeout (5s)")), 5000)
          );

          const { data: dbProfile, error: checkError } = await Promise.race([checkPromise, timeoutPromise]);

          if (checkError) {
            console.warn("PROFILE_CHECK_WARN:", checkError.message);
          }
          finalOwner = dbProfile;
        } catch (checkErr: any) {
          console.warn("PROFILE_CHECK_FAILED:", checkErr.message);
        }
      }

      if (finalOwner) {
        console.log("STEP 2: SKIPPING UPSERT - Profile found:", finalOwner.id);
      } else {
        console.log("STEP 2: OWNER UPSERT START", currentUser.id);
        
        const ownerPayload = {
          id: currentUser.id,
          email: currentUser.email!,
          name: name.trim(),
          phone: phone.trim(),
          is_verified: true,
          is_active: true,
        };
        
        console.log("STEP 2.1: PAYLOAD_READY", ownerPayload);

        // Add a 10s timeout to the upsert to prevent infinite hangs
        const upsertPromise = supabase.from("owners").upsert(ownerPayload, { onConflict: "id" }).select("*").maybeSingle();
        const timeoutPromise = new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Database timeout (10s) while saving Owner Profile")), 10000)
        );

        try {
          const { data: ownerData, error: ownerError } = await Promise.race([upsertPromise, timeoutPromise]);

          if (ownerError) {
            console.error("OWNER_INSERT_ERROR:", ownerError);
            throw ownerError;
          }
          finalOwner = ownerData;
          console.log("STEP 2: UPSERT_SUCCESS");
        } catch (upsertErr: any) {
          console.error("UPSERT_CRITICAL_FAILURE:", upsertErr.message);
          
          // EMEGENCY FALLBACK: If upsert hangs/fails, but we are authenticated, 
          // we might already have a record or are being blocked by a firewall.
          // We will attempt to move forward using just the user ID.
          console.log("STEP 2: EMERGENCY FALLBACK - Proceeding with current user ID");
          finalOwner = { id: currentUser.id, email: currentUser.email!, name: name.trim() } as any;
        }
      }

      if (!finalOwner) {
        throw new Error("Could not retrieve owner profile. Please try again.");
      }

      // 3. STORAGE UPLOAD (Optional)
      let imagePath: string | null = null;
      if (imageFile) {
        setUploadingImage(true);
        console.log("STEP 3: IMAGE COMPRESSION & UPLOAD START");
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
            console.log("STEP 3: IMAGE UPLOAD SUCCESS", imagePath);
          } else {
            console.warn("STEP 3: IMAGE_UPLOAD_SKIPPED:", uploadError?.message);
            toast.warning("Image upload failed. Using default image.");
          }
        } finally {
          setUploadingImage(false);
        }
      }

      // 4. SALON INSERT
      console.log("STEP 4: SALON INSERT START");
      
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (!freshUser) throw new Error("Authentication session expired. Please refresh and try again.");

      const { data: salonData, error: salonError } = await supabase
        .from("salons")
        .insert({
          name: salonName.trim(),
          owner_id: freshUser.id,
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          pincode: pincode.trim() || null,
          open_time: openTime || "09:00",
          close_time: closeTime || "20:00",
          image_url: imagePath || null,
          location: address.trim() || null,
        })
        .select("id")
        .maybeSingle();

      if (salonError) {
        console.error("STEP 4: SALON_INSERT_ERROR:", salonError);
        throw salonError;
      }
      if (!salonData) throw new Error("Salon creation failed to return an ID");
      console.log("STEP 4: SALON_INSERT SUCCESS", salonData.id);

      // 5. SERVICES INSERT
      console.log("STEP 5: SERVICES INSERT START");
      
      const { data: { user: svcUser } } = await supabase.auth.getUser();
      if (!svcUser) throw new Error("Owner session lost during service population.");

      const { error: servicesError } = await (supabase.from("services") as any).insert(
        services.map((service) => ({
          salon_id: salonData.id,
          name: (service?.name ?? "Service").trim(),
          price: Number(service?.price ?? 0),
          duration: Number(service?.duration ?? 0),
        }))
      );

      if (servicesError) {
        console.error("STEP 5: SERVICES_INSERT_ERROR:", servicesError);
        throw servicesError;
      }
      console.log("STEP 5: SERVICES_INSERT SUCCESS");

      // 6. BARBERS INSERT
      console.log("STEP 6: BARBERS INSERT START");
      
      const { data: { user: brbUser } } = await supabase.auth.getUser();
      if (!brbUser) throw new Error("Owner session lost during team population.");

      const { error: barbersError } = await (supabase.from("barbers") as any).insert(
        barbers.map((barber) => ({
          salon_id: salonData.id,
          name: (barber?.name ?? "Barber").trim(),
          chair_number: Number(barber?.chair ?? 1) || 1,
          specialization: (barber?.specialization ?? "").trim(),
        }))
      );

      if (barbersError) {
        console.error("STEP 6: BARBERS_INSERT_ERROR:", barbersError);
        throw barbersError;
      }
      console.log("STEP 6: BARBERS_INSERT SUCCESS");

      // 7. FINALIZATION
      console.log("STEP 7: FINALIZATION");
      await triggerOwnerVerificationEmail(finalOwner?.email ?? "", finalOwner?.name ?? "Owner");
      localStorage.setItem("owner", JSON.stringify(finalOwner));
      localStorage.removeItem(STORAGE_KEY);
      
      console.log("REGISTRATION_FLOW_COMPLETE");
      toast.success("Account created and salon registered");
      navigate("/owner-dashboard", { replace: true });
    } catch (error: any) {
      console.error("REGISTRATION_FLOW_CRITICAL_ERROR:", error);
      toast.error(error?.message || "Something went wrong during registration");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: BODY, position: "relative", overflow: "hidden", paddingBottom: 80 }}>
      <div aria-hidden="true" style={{ position: "fixed", top: "8%", left: "6%", width: 420, height: 420, borderRadius: "50%",
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "fixed", bottom: "5%", right: "8%", width: 380, height: 380, borderRadius: "50%",
        background: `radial-gradient(circle, ${VA}0F, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 16px 0", position: "relative", zIndex: 10 }}>
        <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 13, marginBottom: 20, padding: 0, fontFamily: BODY }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Back to website
        </button>

        {renderSteps(3)}

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: `${V}22`, border: `1px solid ${V}40`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Store style={{ width: 22, height: 22, color: V }} />
          </div>
          <h1 style={{ fontFamily: DISP, fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Setup Your Salon</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Step 3 of 3. Add your salon details to go live on Snippr.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><User style={{ width: 16, height: 16, color: VA }} /> Owner Info</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Owner Full Name</label>
                <input placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Owner Email</label>
                <input type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user}
                  style={{ ...fieldStyle, opacity: user ? 0.6 : 1 }} />
              </div>
            </div>

            {!user && (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><Store style={{ width: 16, height: 16, color: VA }} /> Salon Info</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Salon Name</label>
                <input placeholder="Salon name" value={salonName} onChange={(e) => setSalonName(e.target.value)} required style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required style={fieldStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} required style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Pincode</label>
                <input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} required style={fieldStyle} />
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><Clock style={{ width: 16, height: 16, color: VA }} /> Timing</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Opening Time</label>
                <input type="time" value={openTime || "09:00"} onChange={(e) => setOpenTime(e.target.value)} required style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Closing Time</label>
                <input type="time" value={closeTime || "20:00"} onChange={(e) => setCloseTime(e.target.value)} required style={fieldStyle} />
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}><Scissors style={{ width: 16, height: 16, color: VA }} /> Services</h2>
              <button type="button" onClick={addService} style={addBtnStyle}>
                <Plus style={{ width: 14, height: 14 }} /> Add Service
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {services.map((service, index) => (
                <div key={`service-${index}`} style={rowCardStyle}>
                  <div style={{ flex: "2 1 140px" }}>
                    <label style={labelStyle}>Service name</label>
                    <input
                      placeholder="Service name"
                      value={service.name}
                      onChange={(e) => updateService(index, "name", e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={labelStyle}>Price</label>
                    <input
                      type="number"
                      placeholder="Price"
                      value={service.price}
                      onChange={(e) => updateService(index, "price", e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={labelStyle}>Duration</label>
                    <input
                      type="number"
                      placeholder="Duration"
                      value={service.duration}
                      onChange={(e) => updateService(index, "duration", e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <button type="button" onClick={() => removeService(index)} style={removeBtnStyle}>
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}><Users style={{ width: 16, height: 16, color: VA }} /> Barbers</h2>
              <button type="button" onClick={addBarber} style={addBtnStyle}>
                <Plus style={{ width: 14, height: 14 }} /> Add Barber
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {barbers.map((barber, index) => (
                <div key={`barber-${index}`} style={rowCardStyle}>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={labelStyle}>Name</label>
                    <input
                      placeholder="Name"
                      value={barber.name}
                      onChange={(e) => updateBarber(index, "name", e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={labelStyle}>Chair Number</label>
                    <input
                      type="number"
                      placeholder="Chair Number"
                      value={barber.chair}
                      onChange={(e) => updateBarber(index, "chair", e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={labelStyle}>Specialization</label>
                    <input
                      placeholder="Specialization"
                      value={barber.specialization}
                      onChange={(e) => updateBarber(index, "specialization", e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <button type="button" onClick={() => removeBarber(index)} style={removeBtnStyle}>
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><Camera style={{ width: 16, height: 16, color: VA }} /> Salon Image</h2>
            <div style={{ borderRadius: 16, border: "1px dashed rgba(255,255,255,0.15)", padding: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                <Camera style={{ width: 16, height: 16, color: VA }} /> Upload image (optional, max 5MB)
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </label>

              {uploadingImage && (
                <p style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading image...
                </p>
              )}

              {imagePreview ? (
                <img src={imagePreview} alt="Salon preview" style={{ marginTop: 16, height: 200, width: "100%", borderRadius: 12, objectFit: "cover" }} />
              ) : (
                <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>No image selected.</p>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Verification</h2>
            <TurnstileCaptcha ref={turnstileRef} onTokenChange={setCaptchaToken} theme="dark" className="min-h-[78px]" />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || uploadingImage || verifyingCaptcha}
            style={{ width: "100%", padding: "15px 0", borderRadius: 12,
              background: (submitting || uploadingImage || verifyingCaptcha) ? `${V}80` : V,
              color: "#fff", fontWeight: 700, fontSize: 15, border: "none",
              cursor: (submitting || uploadingImage || verifyingCaptcha) ? "not-allowed" : "pointer",
              fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> {user ? "Completing Setup..." : "Creating Account..."}</>
            ) : (
              user ? "Complete Salon Setup" : "Create Account"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

