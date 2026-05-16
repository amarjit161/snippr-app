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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#f8f9fa] p-4 sm:p-6 md:p-12">
      {/* Decorative Abstract Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#630ed4]/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#005b3d]/5 rounded-full blur-[100px]"></div>
      
      <main className="z-10 my-auto w-full max-w-2xl">
        {/* Main Confirmation Card */}
        <div className="flex flex-col items-center rounded-2xl bg-white/70 p-5 text-center shadow-[0_20px_40px_rgba(99,14,212,0.06)] backdrop-blur-2xl sm:p-8 md:p-12">
          
          {/* Success Animation Placeholder / Icon */}
          <div className="relative mb-6 sm:mb-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#6ffbbe] shadow-lg sm:h-24 sm:w-24">
              <CheckCircle2 className="h-10 w-10 text-[#005b3d] sm:h-12 sm:w-12" />
            </div>
            {/* Particle Accents */}
            <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-[#7c3aed] animate-pulse"></div>
            <div className="absolute -bottom-1 -left-3 h-3 w-3 rounded-full bg-[#005b3d] opacity-40"></div>
          </div>
          
          {/* Title Section */}
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-[#630ed4] font-headline sm:text-4xl md:text-5xl">
            Booking Confirmed!
          </h1>
          <p className="mx-auto mb-8 max-w-md text-base text-[#4a4455] sm:mb-10 sm:text-lg">
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
            
=======
          <div className="grid w-full grid-cols-1 gap-4 text-left md:grid-cols-2">
>>>>>>> 5bab213 (Save local changes: update components, hooks, services, and migrations)
            {/* Queue Card */}
            <div className="flex aspect-video flex-col justify-between rounded-xl border border-[#630ed4]/5 bg-white p-5 sm:p-6 md:aspect-auto">
              <div>
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-[#7b7487] mb-2 block">Current Queue</span>
                <h2 className="text-4xl font-extrabold text-[#630ed4] font-headline sm:text-5xl">#{queuePosition}</h2>
              </div>
            </div>
            
            {/* Time Card */}
            <div className="flex flex-col justify-between rounded-xl bg-[#630ed4] p-5 text-white sm:p-6">
              <div>
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2 block">Estimated Wait</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-headline sm:text-4xl">{estimatedWait.replace(/\D/g, '') || "15"}</span>
                  <span className="text-lg font-bold font-headline sm:text-xl">mins</span>
                </div>
              </div>
            </div>
            
            {/* Salon Info Card */}
            <div className="md:col-span-2 flex flex-col items-center justify-between gap-4 rounded-xl bg-[#f3f4f5] p-5 sm:p-6 md:flex-row md:gap-6">
              <div className="flex w-full items-center gap-4 md:w-auto">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                  <img alt="Salon" className="w-full h-full object-cover" src={getSalonImageSrc(image)} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#191c1d] font-headline sm:text-xl">{salonName}</h3>
                  <p className="text-[#4a4455] text-sm">{serviceName}</p>
                </div>
              </div>
              <div className="flex w-full justify-center rounded-full border border-[#ccc3d8]/20 bg-white px-4 py-2 shadow-sm md:w-auto">
                 <span className="text-center text-sm font-medium">{address || "Location unavailable"}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex w-full flex-col gap-4 sm:mt-10 sm:flex-row">
            <button onClick={onViewBookings} className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 font-bold text-white shadow-lg transition-all active:scale-95 hover:brightness-110 sm:px-8" style={{ background: 'linear-gradient(to right, #630ed4, #7c3aed)' }}>
              View Bookings
            </button>
            <button onClick={onModify} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#f0dbff] px-6 py-4 font-bold text-[#2c0051] transition-all active:scale-95 hover:bg-[#ddb7ff] sm:px-8">
              Back to Salons
            </button>
          </div>

        </div>
        
        {/* Footer Help */}
        <p className="mt-8 text-center text-xs text-[#7b7487]">
          A confirmation email has been sent to your registered address.<br/>
          Need help? Contact <span className="text-[#630ed4] font-semibold">Snippr Concierge</span>
        </p>
      </main>
    </div>
  );
}

