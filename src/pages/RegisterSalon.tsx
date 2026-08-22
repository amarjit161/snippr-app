import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import Header from "@/components/Header";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Plus, Scissors, Store, Trash2, Users, Clock, User } from "lucide-react";
import imageCompression from "browser-image-compression";
import { V, VA, G, BG, DISP, BODY } from "@/components/landing/tokens";

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

const outlineBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.75)",
  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: BODY,
};

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
      <div style={{ minHeight: "100vh", background: BG, fontFamily: BODY }}>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 p-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: 160, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!owner) return null;

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: BODY, position: "relative", overflow: "hidden", paddingBottom: 80 }}>
      <div aria-hidden="true" style={{ position: "fixed", top: "8%", left: "6%", width: 420, height: 420, borderRadius: "50%",
        background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "fixed", bottom: "5%", right: "8%", width: 380, height: 380, borderRadius: "50%",
        background: `radial-gradient(circle, ${VA}0F, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10 }}>
        <Header userName={owner?.name || owner?.email || "Owner"} isAdmin={false} />
      </div>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14, background: `${V}22`, border: `1px solid ${V}40`,
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Store style={{ width: 22, height: 22, color: V }} />
          </div>
          <h1 style={{ fontFamily: DISP, fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Register Salon</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Set up your salon profile, services, and team.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><User style={{ width: 16, height: 16, color: VA }} /> Basic Info</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Salon Name</label>
                <input placeholder="Salon Name" value={salonName} onChange={(e) => setSalonName(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Owner Name</label>
                <input placeholder="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={fieldStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Email</label>
                <input value={email} readOnly style={{ ...fieldStyle, opacity: 0.6, cursor: "not-allowed" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Phone</label>
                <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldStyle} />
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><MapPin style={{ width: 16, height: 16, color: VA }} /> Location</h2>
            <button type="button" onClick={detectLocation} disabled={detectingLocation} style={{ ...outlineBtnStyle, marginBottom: 14 }}>
              {detectingLocation ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <MapPin style={{ width: 14, height: 14 }} />} Auto detect
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Full address</label>
                <input placeholder="Full address" value={address} onChange={(e) => setAddress(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Pincode</label>
                <input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} style={fieldStyle} />
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}><Clock style={{ width: 16, height: 16, color: VA }} /> Salon Timing</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Opening Time</label>
                <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Closing Time</label>
                <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 14 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Auto close toggle</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Mark salon closed manually for now.</p>
              </div>
              <Switch checked={autoClose} onCheckedChange={setAutoClose}
                style={{ background: autoClose ? V : "rgba(255,255,255,0.1)" }} />
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
                    <input placeholder="Service name" value={service?.name ?? ""} onChange={(e) => updateService(index, "name", e.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={labelStyle}>Price</label>
                    <input type="number" placeholder="Price" value={service?.price ?? ""} onChange={(e) => updateService(index, "price", e.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={labelStyle}>Duration</label>
                    <input type="number" placeholder="Duration" value={service?.duration ?? ""} onChange={(e) => updateService(index, "duration", e.target.value)} style={fieldStyle} />
                  </div>
                  <button type="button" onClick={() => setServices((prev) => prev.filter((_, i) => i !== index))} style={removeBtnStyle}>
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
                    <input placeholder="Name" value={barber?.name ?? ""} onChange={(e) => updateBarber(index, "name", e.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ flex: "1 1 90px" }}>
                    <label style={labelStyle}>Chair Number</label>
                    <input type="number" placeholder="Chair Number" value={barber?.chair ?? ""} onChange={(e) => updateBarber(index, "chair", e.target.value)} style={fieldStyle} />
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={labelStyle}>Specialization</label>
                    <input placeholder="Specialization" value={barber?.specialization ?? ""} onChange={(e) => updateBarber(index, "specialization", e.target.value)} style={fieldStyle} />
                  </div>
                  <button type="button" onClick={() => setBarbers((prev) => prev.filter((_, i) => i !== index))} style={removeBtnStyle}>
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
                  <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Uploading image...
                </p>
              )}
              {imagePreview ? (
                <img src={imagePreview} alt="Salon preview" style={{ marginTop: 16, height: 200, width: "100%", borderRadius: 12, objectFit: "cover" }} />
              ) : (
                <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>No image selected.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || uploadingImage}
            style={{ width: "100%", padding: "15px 0", borderRadius: 12,
              background: (submitting || uploadingImage) ? `${V}80` : V,
              color: "#fff", fontWeight: 700, fontSize: 15, border: "none",
              cursor: (submitting || uploadingImage) ? "not-allowed" : "pointer",
              fontFamily: BODY, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {submitting || uploadingImage ? (
              <><Loader2 className="animate-spin" style={{ width: 18, height: 18 }} /> {uploadingImage ? "Uploading image..." : "Saving..."}</>
            ) : (
              "Register Salon"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

