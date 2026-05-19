import { CalendarPlus, Share2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import salon1 from "@/assets/salon-1.jpg";
import salon2 from "@/assets/salon-2.jpg";
import salon3 from "@/assets/salon-3.jpg";
import salon4 from "@/assets/salon-4.jpg";

const salonImages: Record<string, string> = {
  "/salon-1": salon1,
  "/salon-2": salon2,
  "/salon-3": salon3,
  "/salon-4": salon4,
};

const getSalonImageSrc = (imageUrl: string | null) => {
  if (!imageUrl) return "/default-salon.jpg";
  if (salonImages[imageUrl]) return salonImages[imageUrl];
  if (imageUrl.startsWith("http") || imageUrl.startsWith("/")) return imageUrl;
  const { data } = supabase.storage.from("salon-images").getPublicUrl(imageUrl);
  return data.publicUrl || "/default-salon.jpg";
};

interface BookingSuccessProps {
  salonName: string;
  serviceName: string;
  address: string;
  image: string;
  estimatedWait: string;
  queuePosition: number | string;
  bookingId: string;
  arrivalOTP: string;
  onViewBookings: () => void;
  onModify: () => void;
}

export default function BookingSuccess({
  salonName,
  serviceName,
  address,
  image,
  estimatedWait,
  queuePosition,
  bookingId,
  arrivalOTP,
  onViewBookings,
  onModify,
}: BookingSuccessProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
      {/* Decorative Abstract Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#630ed4]/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#005b3d]/5 rounded-full blur-[100px]"></div>
      
      <main className="w-full max-w-2xl z-10 my-auto">
        {/* Main Confirmation Card */}
        <div className="bg-white/70 backdrop-blur-2xl rounded-2xl shadow-[0_20px_40px_rgba(99,14,212,0.06)] p-8 md:p-12 text-center flex flex-col items-center">
          
          {/* Success Animation Placeholder / Icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-[#6ffbbe] rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 className="text-[#005b3d] w-12 h-12" />
            </div>
            {/* Particle Accents */}
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#7c3aed] rounded-full animate-pulse"></div>
            <div className="absolute -bottom-1 -left-3 w-3 h-3 bg-[#005b3d] rounded-full opacity-40"></div>
          </div>
          
          {/* Title Section */}
          <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-[#630ed4] tracking-tight mb-4">
            Booking Confirmed!
          </h1>
          <p className="text-[#4a4455] text-lg max-w-md mx-auto mb-10">
            You're all set. We've notified the stylist and they're preparing for your arrival.
          </p>

          {/* Details Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
            {/* OTP Card - Arrival Code */}
            <div className="md:col-span-2 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 text-white text-center">
              <p className="text-purple-200 text-xs font-semibold uppercase tracking-wider mb-3">
                Your Arrival Code (Snipp Code)
              </p>
              <div className="flex items-center justify-center gap-2 mb-4">
                {arrivalOTP?.split('').map((digit, i) => (
                  <div key={i} 
                       className="w-14 h-16 bg-white/20 rounded-xl flex items-center justify-center 
                                  text-3xl font-black text-white border-2 border-white/30">
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-purple-200 text-sm">
                Show this code to the salon when you arrive
              </p>
              <p className="text-purple-300 text-xs mt-1">
                Valid until booking complete · Do not share with anyone else
              </p>
            </div>
            
            {/* Queue Card */}
            <div className="bg-white p-6 rounded-xl border border-[#630ed4]/5 flex flex-col justify-between aspect-video md:aspect-auto">
              <div>
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-[#7b7487] mb-2 block">Current Queue</span>
                <h2 className="font-headline font-extrabold text-5xl text-[#630ed4]">#{queuePosition}</h2>
              </div>
            </div>
            
            {/* Time Card */}
            <div className="bg-[#630ed4] text-white p-6 rounded-xl flex flex-col justify-between">
              <div>
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2 block">Estimated Wait</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline font-extrabold text-4xl">{estimatedWait.replace(/\D/g, '') || "15"}</span>
                  <span className="font-headline font-bold text-xl">mins</span>
                </div>
              </div>
            </div>
            
            {/* Salon Info Card */}
            <div className="md:col-span-2 bg-[#f3f4f5] p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img alt="Salon" className="w-full h-full object-cover" src={getSalonImageSrc(image)} />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-xl text-[#191c1d]">{salonName}</h3>
                  <p className="text-[#4a4455] text-sm">{serviceName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white py-2 px-4 rounded-full border border-[#ccc3d8]/20 shadow-sm w-full md:w-auto justify-center">
                 <span className="text-sm font-medium">{address || "Location unavailable"}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full mt-10">
            <button onClick={onViewBookings} className="flex-1 text-white font-bold py-4 px-8 rounded-full shadow-lg hover:brightness-110 transition-all active:scale-95 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(to right, #630ed4, #7c3aed)' }}>
              View Bookings
            </button>
            <button onClick={onModify} className="flex-1 bg-[#f0dbff] text-[#2c0051] font-bold py-4 px-8 rounded-full hover:bg-[#ddb7ff] transition-all active:scale-95 flex items-center justify-center gap-2">
              Back to Salons
            </button>
          </div>

        </div>
        
        {/* Footer Help */}
        <p className="text-center text-[#7b7487] text-xs mt-8">
          A confirmation email has been sent to your registered address.<br/>
          Need help? Contact <span className="text-[#630ed4] font-semibold">Snippr Concierge</span>
        </p>
      </main>
    </div>
  );
}

