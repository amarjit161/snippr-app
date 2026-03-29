import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Store, User, Mail, DollarSign, Clock, Scissors } from "lucide-react";

export default function OwnerRegistration() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    salon_name: "",
    owner_name: "",
    barber_name: "",
    email: "",
    price_list: "",
    service_duration: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.rpc("register_salon", {
      p_salon_name: formData.salon_name,
      p_owner_name: formData.owner_name,
      p_barber_name: formData.barber_name,
      p_email: formData.email,
      p_price_list: parseFloat(formData.price_list || "25"),
      p_duration: parseInt(formData.service_duration || "30", 10),
    });

    if (error) {
       console.error(error);
       toast.error("Error registering salon: " + error.message);
    } else {
       toast.success("Salon registered successfully! Welcome aboard.");
       // Force a reload so AuthContext picks up new profile data role
       window.location.href = "/admin"; 
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto w-full max-w-md space-y-8 rounded-lg bg-card p-8 shadow-elevation-3">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-card-foreground">Register your Salon</h2>
          <p className="text-sm text-muted-foreground">Fill in details to set up your Snippr dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
               <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input required placeholder="Salon Name" value={formData.salon_name} onChange={e => setFormData({...formData, salon_name: e.target.value})} className="pl-10" />
            </div>
            <div className="relative">
               <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input required placeholder="Your Name (Owner)" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} className="pl-10" />
            </div>
            <div className="relative">
               <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input required type="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-10" />
            </div>
            <div className="relative">
               <Scissors className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input required placeholder="Initial Barber Name" value={formData.barber_name} onChange={e => setFormData({...formData, barber_name: e.target.value})} className="pl-10" />
            </div>
            <div className="relative">
               <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input required type="number" step="0.01" placeholder="Base Service Price (e.g. 25.00)" value={formData.price_list} onChange={e => setFormData({...formData, price_list: e.target.value})} className="pl-10" />
            </div>
            <div className="relative">
               <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
               <Input required type="number" placeholder="Avg Service Duration (minutes)" value={formData.service_duration} onChange={e => setFormData({...formData, service_duration: e.target.value})} className="pl-10" />
            </div>
          </div>
          
          <Button type="submit" disabled={loading} className="w-full mt-4" size="lg">
             {loading ? "Registering..." : "Launch Dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
