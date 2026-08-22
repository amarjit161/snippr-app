import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, Clock, Loader2, Plus, Scissors, Trash2 } from "lucide-react";
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

const rowCardStyle: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start",
  borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: 12,
};

const removeBtnStyle: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
  color: "#F87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2,
};

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? `${V}80` : V, color: "#fff", fontWeight: 700, borderRadius: 12,
  fontFamily: BODY, border: "none", cursor: disabled ? "not-allowed" : "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
});

const ghostBtnStyle: React.CSSProperties = {
  padding: "13px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: BODY,
};

interface Service {
  name: string;
  price: string;
  duration: string;
}

interface FormData {
  ownerName: string;
  salonName: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  openTime: string;
  closeTime: string;
  services: Service[];
}

// ✅ MOVED OUTSIDE: StepBar component (prevents remount on every render)
const StepBar = ({ currentStep }: { currentStep: number }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ display: "flex", gap: 6 }}>
      {["Account", "Salon Info", "Services", "Done"].map((label, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;

        return (
          <div key={label} style={{ flex: 1 }}>
            <div
              style={{
                height: 4, borderRadius: 99, marginBottom: 8,
                background: isDone ? G : isActive ? `linear-gradient(90deg, ${V}, ${VA})` : "rgba(255,255,255,0.08)",
                boxShadow: isActive ? `0 0 10px ${V}80` : "none",
                transition: "all 0.3s ease",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: isDone ? G : isActive ? VA : "rgba(255,255,255,0.2)",
                  boxShadow: isActive ? `0 0 8px ${VA}` : "none",
                }}
              />
              <span
                className="hidden sm:block"
                style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                  color: isActive ? "#fff" : isDone ? G : "rgba(255,255,255,0.3)",
                }}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ✅ MOVED OUTSIDE: Card component (prevents remount on every render)
const OnboardingCard = ({ children, currentStep }: { children: React.ReactNode; currentStep: number }) => (
  <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16, fontFamily: BODY, position: "relative", overflow: "hidden" }}>
    <div aria-hidden="true" style={{ position: "fixed", top: "10%", left: "8%", width: 400, height: 400, borderRadius: "50%",
      background: `radial-gradient(circle, ${V}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
    <div aria-hidden="true" style={{ position: "fixed", bottom: "5%", right: "8%", width: 380, height: 380, borderRadius: "50%",
      background: `radial-gradient(circle, ${VA}0F, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

    <div style={{ width: "100%", maxWidth: 520, position: "relative", zIndex: 10, borderRadius: 24,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: 28, backdropFilter: "blur(20px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: V, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Scissors style={{ width: 16, height: 16, color: "#fff" }} />
        </div>
        <span style={{ fontFamily: DISP, fontWeight: 800, color: "#fff", fontSize: 16 }}>Snippr</span>
      </div>
      {currentStep > 0 && currentStep < 4 && <StepBar currentStep={currentStep} />}
      {children}
    </div>
  </div>
);

export const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>({
    ownerName: "",
    salonName: "",
    phone: "",
    address: "",
    city: "",
    pincode: "",
    openTime: "09:00",
    closeTime: "20:00",
    services: [{ name: "", price: "", duration: "30" }],
  });

  // ✅ STABLE HANDLER: useCallback prevents function recreation on every render
  const updateForm = useCallback((key: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const verifyAndLoad = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (accessToken && (type === "signup" || type === "magiclink")) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error || !data.user) {
          toast.error("Verification failed. Please try again.");
          navigate("/owner-signup");
          return;
        }

        setUser(data.user);
        window.history.replaceState({}, "", "/onboarding");
      } else {
        const { data: { user: existingUser } } = await supabase.auth.getUser();

        if (!existingUser) {
          navigate("/owner-signup");
          return;
        }

        setUser(existingUser);

        const { data: salon } = await supabase
          .from("salons")
          .select("id")
          .eq("owner_id", existingUser.id)
          .maybeSingle();

        if (salon) {
          navigate("/owner-dashboard");
          return;
        }
      }

      setStep(1);
    };

    verifyAndLoad();
  }, [navigate]);

  const handleSalonSetup = async () => {
    if (!formData.salonName.trim()) {
      toast.error("Please enter your salon name");
      return;
    }

    if (!user?.id) {
      toast.error("Session missing. Please sign in again.");
      navigate("/owner-signup");
      return;
    }

    setLoading(true);
    try {
      const { error: ownerError } = await supabase.from("owners").upsert({
        id: user.id,
        email: user.email,
        name: formData.ownerName,
        phone: formData.phone,
      });

      if (ownerError) throw ownerError;

      const { data: salon, error: salonError } = await supabase
        .from("salons")
        .insert({
          name: formData.salonName,
          owner_id: user.id,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          pincode: formData.pincode,
          open_time: formData.openTime,
          close_time: formData.closeTime,
        })
        .select()
        .single();

      if (salonError) throw salonError;

      // Seed national holidays for the newly created salon.
      const year = new Date().getFullYear();
      const { error: holidaySeedError } = await supabase
        .from("salon_holidays" as any)
        .insert([
          {
            salon_id: salon.id,
            date: `${year}-01-26`,
            name: "Republic Day",
            type: "national",
            note: "Closed for Republic Day",
          },
          {
            salon_id: salon.id,
            date: `${year}-08-15`,
            name: "Independence Day",
            type: "national",
            note: "Closed for Independence Day",
          },
          {
            salon_id: salon.id,
            date: `${year}-10-02`,
            name: "Gandhi Jayanti",
            type: "national",
            note: "Closed for Gandhi Jayanti",
          },
        ]);

      if (holidaySeedError) {
        console.error("HOLIDAY_SEED_ERROR:", holidaySeedError);
      }

      setSalonId(salon.id);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleServicesSetup = async () => {
    setLoading(true);
    try {
      const validServices = formData.services.filter((s) => s.name.trim());
      if (validServices.length > 0 && salonId) {
        const { error } = await supabase.from("services").insert(
          validServices.map((s) => ({
            salon_id: salonId,
            name: s.name,
            price: parseFloat(s.price) || 0,
            duration: parseInt(s.duration, 10) || 30,
          }))
        );

        if (error) throw error;
      }

      setStep(4);
    } catch (err: any) {
      toast.error(err.message || "Failed to save services");
    } finally {
      setLoading(false);
    }
  };

  if (step === 0)
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BODY }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="animate-spin" style={{ width: 36, height: 36, color: V, margin: "0 auto 12px" }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Verifying your account...</p>
        </div>
      </div>
    );

  if (step === 1)
    return (
      <OnboardingCard currentStep={step}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🎉</div>
          <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Email verified!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>no cap, you're literally about to get your salon on Snippr</p>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={labelStyle}>What's your name? 👤</label>
          <input
            type="text"
            placeholder="e.g. Rahul Sharma"
            value={formData.ownerName}
            onChange={(e) => updateForm("ownerName", e.target.value)}
            style={fieldStyle}
          />
        </div>

        <button
          onClick={() => {
            if (!formData.ownerName.trim()) {
              toast.error("Tell us your name first 👀");
              return;
            }
            setStep(2);
          }}
          style={{ width: "100%", padding: "13px 0", ...primaryBtnStyle(false), fontSize: 14 }}
        >
          Let's set up your salon <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </OnboardingCard>
    );

  if (step === 2)
    return (
      <OnboardingCard currentStep={step}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: DISP, fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Your Salon Details 💈
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>This is what customers will see when they search for you</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
          <div>
            <label style={labelStyle}>Salon Name *</label>
            <input
              type="text"
              placeholder="e.g. Looks by Rahul"
              value={formData.salonName}
              onChange={(e) => updateForm("salonName", e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Phone *</label>
              <input
                type="tel"
                placeholder="9876543210"
                value={formData.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>City *</label>
              <input
                type="text"
                placeholder="Delhi"
                value={formData.city}
                onChange={(e) => updateForm("city", e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            <input
              type="text"
              placeholder="Shop 4, Main Market..."
              value={formData.address}
              onChange={(e) => updateForm("address", e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>
                <Clock style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "middle" }} />Opens
              </label>
              <input
                type="time"
                value={formData.openTime}
                onChange={(e) => updateForm("openTime", e.target.value)}
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <Clock style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "middle" }} />Closes
              </label>
              <input
                type="time"
                value={formData.closeTime}
                onChange={(e) => updateForm("closeTime", e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setStep(1)} style={ghostBtnStyle}>
            Back
          </button>
          <button
            onClick={handleSalonSetup}
            disabled={loading}
            style={{ flex: 1, padding: "13px 0", ...primaryBtnStyle(loading), fontSize: 14 }}
          >
            {loading ? "Saving..." : <><span>Next: Add Services</span> <ChevronRight style={{ width: 16, height: 16 }} /></>}
          </button>
        </div>
      </OnboardingCard>
    );

  if (step === 3)
    return (
      <OnboardingCard currentStep={step}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: DISP, fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Add Your Services ✂️
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Customers will pick from these when booking</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {formData.services.map((service, idx) => (
            <div key={idx} style={rowCardStyle}>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <input
                  type="text"
                  placeholder="e.g. Haircut"
                  value={service.name}
                  onChange={(e) => {
                    const updated = [...formData.services];
                    updated[idx].name = e.target.value;
                    updateForm("services", updated);
                  }}
                  style={fieldStyle}
                />
                <input
                  type="number"
                  placeholder="INR Price"
                  value={service.price}
                  onChange={(e) => {
                    const updated = [...formData.services];
                    updated[idx].price = e.target.value;
                    updateForm("services", updated);
                  }}
                  style={fieldStyle}
                />
                <select
                  value={service.duration}
                  onChange={(e) => {
                    const updated = [...formData.services];
                    updated[idx].duration = e.target.value;
                    updateForm("services", updated);
                  }}
                  style={{ ...fieldStyle, colorScheme: "dark" }}
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
              </div>
              <button
                onClick={() => {
                  const updated = formData.services.filter((_, i) => i !== idx);
                  updateForm("services", updated.length ? updated : [{ name: "", price: "", duration: "30" }]);
                }}
                style={removeBtnStyle}
              >
                <Trash2 style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => updateForm("services", [...formData.services, { name: "", price: "", duration: "30" }])}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginBottom: 22, fontFamily: BODY,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} /> Add another service
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setStep(2)} style={ghostBtnStyle}>
            Back
          </button>
          <button
            onClick={handleServicesSetup}
            disabled={loading}
            style={{ flex: 1, padding: "13px 0", ...primaryBtnStyle(loading), fontSize: 14 }}
          >
            {loading ? "Saving..." : <><span>Complete Setup</span> <ChevronRight style={{ width: 16, height: 16 }} /></>}
          </button>
        </div>
      </OnboardingCard>
    );

  if (step === 4)
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, fontFamily: BODY, position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "fixed", top: "10%", left: "8%", width: 400, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${G}12, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "fixed", bottom: "5%", right: "8%", width: 380, height: 380, borderRadius: "50%",
          background: `radial-gradient(circle, ${VA}0F, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />

        <div style={{ width: "100%", maxWidth: 520, position: "relative", zIndex: 10, textAlign: "center", borderRadius: 24,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: 28, backdropFilter: "blur(20px)" }}>
          <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
          <h1 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 8 }}>
            ur salon is LIVE bestie
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 28 }}>
            Customers can now find and book at <strong style={{ color: "#fff" }}>{formData.salonName}</strong>. Let's go check your dashboard!
          </p>
          <div style={{ borderRadius: 14, background: `${G}14`, border: `1px solid ${G}30`, padding: 16, marginBottom: 28, textAlign: "left" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: G, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              What's ready for you
            </p>
            {[
              "Salon profile created",
              "Booking slots configured",
              "Services added",
              "Live booking link ready",
            ].map((item) => (
              <p key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>
                <CheckCircle2 style={{ width: 14, height: 14, color: G, flexShrink: 0 }} /> {item}
              </p>
            ))}
          </div>
          <button
            onClick={() => navigate("/owner-dashboard")}
            style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: G, color: "#fff", fontWeight: 700,
              fontSize: 15, border: "none", cursor: "pointer", fontFamily: BODY }}
          >
            Go to Dashboard 🚀
          </button>
        </div>
      </div>
    );

  return null;
};

export default Onboarding;
