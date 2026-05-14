import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import { ChevronLeft, MapPin, Calendar, Clock, Scissors, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BookingDetail {
  id: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  booking_date?: string;
  time_slot?: string;
  status?: string;
  arrival_otp?: string;
  otp_expires_at?: string;
  otp_verified_at?: string;
  salons?: {
    id: string;
    name: string;
    address?: string;
    location?: string;
    image_url?: string;
    city?: string;
  };
  services?: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
  barbers?: {
    id: string;
    name: string;
  };
}

const statusSteps = ['Booked', 'Confirmed', 'Arrived', 'In Chair', 'Done'];

const getStatusIndex = (status?: string): number => {
  const normalized = String(status || '').toLowerCase().trim();
  if (normalized === 'waiting') return 0;
  if (normalized === 'confirmed' || normalized === 'accepted') return 1;
  if (normalized === 'in_progress' || normalized === 'in_service') return 3;
  if (normalized === 'completed' || normalized === 'done') return 4;
  return 0;
};

const formatTimeSlot = (timeSlot?: string) => {
  if (!timeSlot) return 'Time not set';
  const [h, m] = timeSlot.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeSlot;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

const formatDateLabel = (date?: string) => {
  if (!date) return 'Date TBD';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const isOTPExpired = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!id || !user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('queue')
          .select('*, salons(*), services(*), barbers(*)')
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          toast.error('Failed to fetch booking details');
          navigate('/');
          return;
        }

        if (!data) {
          toast.error('Booking not found');
          navigate('/');
          return;
        }

        setBooking(data);
      } catch (err) {
        console.error('BOOKING_DETAIL_FETCH_ERROR:', err);
        toast.error('Error loading booking');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id, user, navigate]);

  const handleCancel = async () => {
    if (!booking) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('queue')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) {
        toast.error('Failed to cancel booking');
      } else {
        toast.success('Booking cancelled successfully');
        navigate('/bookings');
      }
    } catch (err) {
      console.error('CANCEL_ERROR:', err);
      toast.error('Error cancelling booking');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Booking not found</p>
        </div>
      </div>
    );
  }

  const currentStep = getStatusIndex(booking.status);
  const isOTPValid = booking.arrival_otp && !isOTPExpired(booking.otp_expires_at);
  const salonName = booking.salons?.name || 'Salon';
  const serviceName = booking.services?.name || 'Service';
  const barberName = booking.barbers?.name || 'Not assigned';
  const salonAddress = booking.salons?.address || booking.salons?.location || 'Address unavailable';
  const salonImage = booking.salons?.image_url || '/default-salon.jpg';

  return (
    <div>
      <Header />
      <div className="min-h-screen bg-[#faf9fc] py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-6"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e5e2ea] p-6 md:p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#1a1c1e] mb-2">
                {salonName}
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {salonAddress}
              </p>
            </div>

            {/* Status Tracker */}
            <div className="mb-10 py-8 bg-gradient-to-r from-purple-50 to-transparent rounded-2xl px-6">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-6">
                Booking Status
              </h3>
              <div className="flex items-center justify-between relative">
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                    style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
                  />
                </div>
                {statusSteps.map((step, i) => (
                  <div key={i} className="flex flex-col items-center z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${
                          i < currentStep
                            ? 'bg-purple-600 text-white'
                            : i === currentStep
                            ? 'bg-purple-600 text-white ring-4 ring-purple-200'
                            : 'bg-gray-200 text-gray-400'
                        }
                      `}
                    >
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium text-center
                        ${i <= currentStep ? 'text-purple-700 font-semibold' : 'text-gray-400'}
                      `}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* OTP Display */}
            {isOTPValid && (
              <div className="mb-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 text-white text-center">
                <p className="text-purple-200 text-xs font-semibold uppercase tracking-wider mb-4">
                  Your Arrival Code
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  {booking.arrival_otp?.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-14 h-16 bg-white/20 rounded-xl flex items-center justify-center 
                                 text-3xl font-black text-white border-2 border-white/30"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-purple-200 text-sm">
                  Show this code to the salon when you arrive
                </p>
                <p className="text-purple-300 text-xs mt-2">
                  Valid until {new Date(booking.otp_expires_at!).toLocaleString('en-IN')}
                </p>
              </div>
            )}

            {/* Booking Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Service */}
              <div className="bg-[#f4f3f6] rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Scissors className="h-4 w-4" />
                  <span className="uppercase text-xs font-bold tracking-wider">Service</span>
                </div>
                <p className="text-lg font-bold text-[#1a1c1e]">{serviceName}</p>
              </div>

              {/* Barber */}
              <div className="bg-[#f4f3f6] rounded-xl p-4">
                <div className="text-sm text-gray-600 mb-1">
                  <span className="uppercase text-xs font-bold tracking-wider">Barber</span>
                </div>
                <p className="text-lg font-bold text-[#1a1c1e]">{barberName}</p>
              </div>

              {/* Date */}
              <div className="bg-[#f4f3f6] rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="uppercase text-xs font-bold tracking-wider">Date</span>
                </div>
                <p className="text-lg font-bold text-[#1a1c1e]">
                  {formatDateLabel(booking.booking_date)}
                </p>
              </div>

              {/* Time */}
              <div className="bg-[#f4f3f6] rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="uppercase text-xs font-bold tracking-wider">Time</span>
                </div>
                <p className="text-lg font-bold text-[#1a1c1e]">
                  {formatTimeSlot(booking.time_slot)}
                </p>
              </div>
            </div>

            {/* Salon Image */}
            {salonImage && (
              <div className="mb-8 rounded-2xl overflow-hidden h-48 md:h-64">
                <img
                  src={salonImage}
                  alt={salonName}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(salonAddress)}`, '_blank')}
                className="flex-1 bg-white border-2 border-purple-600 text-purple-600 font-bold py-3 px-6 rounded-full hover:bg-purple-50 transition-all"
              >
                View on Map
              </button>
              {['waiting', 'confirmed'].includes(booking.status || '') && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 bg-red-100 text-red-600 font-bold py-3 px-6 rounded-full hover:bg-red-200 transition-all disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

