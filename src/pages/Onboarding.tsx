import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronRight, Clock, Plus, Scissors, Trash2 } from "lucide-react";

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
  <div className="flex items-center justify-center gap-2 mb-8">
    {["Account", "Salon Info", "Services", "Done"].map((label, i) => {
      const stepNum = i + 1;
      const isActive = currentStep === stepNum;
      const isDone = currentStep > stepNum;

      return (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                isDone
                  ? "bg-green-500 text-white"
                  : isActive
                    ? "bg-purple-600 text-white ring-4 ring-purple-100"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {isDone ? "✓" : stepNum}
            </div>
            <span
              className={`text-xs font-medium hidden sm:block ${
                isActive ? "text-purple-600" : isDone ? "text-green-600" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < 3 && <div className={`w-8 h-0.5 rounded ${isDone ? "bg-green-400" : "bg-gray-200"}`} />}
        </div>
      );
    })}
  </div>
);

// ✅ MOVED OUTSIDE: Card component (prevents remount on every render)
const OnboardingCard = ({ children, currentStep }: { children: React.ReactNode; currentStep: number }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
          <Scissors className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">Snippr</span>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verifying your account...</p>
        </div>
      </div>
    );

  if (step === 1)
    return (
      <OnboardingCard currentStep={step}>
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Email verified!</h1>
          <p className="text-gray-500 text-sm">no cap, you're literally about to get your salon on Snippr</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">What's your name? 👤</label>
          <input
            type="text"
            placeholder="e.g. Rahul Sharma"
            value={formData.ownerName}
            onChange={(e) => updateForm("ownerName", e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
        >
          Let's set up your salon <ChevronRight className="w-4 h-4" />
        </button>
      </OnboardingCard>
    );

  if (step === 2)
    return (
      <OnboardingCard currentStep={step}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Your Salon Details 💈</h1>
          <p className="text-gray-500 text-sm">This is what customers will see when they search for you</p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Salon Name *</label>
            <input
              type="text"
              placeholder="e.g. Looks by Rahul"
              value={formData.salonName}
              onChange={(e) => updateForm("salonName", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
              <input
                type="tel"
                placeholder="9876543210"
                value={formData.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">City *</label>
              <input
                type="text"
                placeholder="Delhi"
                value={formData.city}
                onChange={(e) => updateForm("city", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <input
              type="text"
              placeholder="Shop 4, Main Market..."
              value={formData.address}
              onChange={(e) => updateForm("address", e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Clock className="w-3 h-3 inline mr-1" />Opens
              </label>
              <input
                type="time"
                value={formData.openTime}
                onChange={(e) => updateForm("openTime", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Clock className="w-3 h-3 inline mr-1" />Closes
              </label>
              <input
                type="time"
                value={formData.closeTime}
                onChange={(e) => updateForm("closeTime", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleSalonSetup}
            disabled={loading}
            className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Saving..." : <><span>Next: Add Services</span> <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </OnboardingCard>
    );

  if (step === 3)
    return (
      <OnboardingCard currentStep={step}>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Add Your Services ✂️</h1>
          <p className="text-gray-500 text-sm">Customers will pick from these when booking</p>
        </div>

        <div className="space-y-3 mb-4">
          {formData.services.map((service, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="e.g. Haircut"
                  value={service.name}
                  onChange={(e) => {
                    const updated = [...formData.services];
                    updated[idx].name = e.target.value;
                    updateForm("services", updated);
                  }}
                  className="col-span-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
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
                  className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
                <select
                  value={service.duration}
                  onChange={(e) => {
                    const updated = [...formData.services];
                    updated[idx].duration = e.target.value;
                    updateForm("services", updated);
                  }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
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
                className="p-2.5 rounded-xl text-red-400 hover:bg-red-50 mt-0.5"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => updateForm("services", [...formData.services, { name: "", price: "", duration: "30" }])}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center justify-center gap-1.5 mb-6"
        >
          <Plus className="w-4 h-4" /> Add another service
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => setStep(2)}
            className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleServicesSetup}
            disabled={loading}
            className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Saving..." : <><span>Complete Setup</span> <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </OnboardingCard>
    );

  if (step === 4)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ur salon is LIVE bestie</h1>
          <p className="text-gray-500 text-sm mb-8">
            Customers can now find and book at <strong>{formData.salonName}</strong>. Let's go check your dashboard!
          </p>
          <div className="bg-purple-50 rounded-xl p-4 mb-8 text-left">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-3">What's ready for you</p>
            {[
              "✅ Salon profile created",
              "✅ Booking slots configured",
              "✅ Services added",
              "✅ Live booking link ready",
            ].map((item) => (
              <p key={item} className="text-sm text-purple-800 mb-1.5">{item}</p>
            ))}
          </div>
          <button
            onClick={() => navigate("/owner-dashboard")}
            className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold hover:bg-purple-700 transition-colors text-base"
          >
            Go to Dashboard 🚀
          </button>
        </div>
      </div>
    );

  return null;
};

export default Onboarding;
