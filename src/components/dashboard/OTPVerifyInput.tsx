import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, KeyRound } from 'lucide-react';

interface OTPVerifyInputProps {
  bookingId: string;
  customerName: string;
  currentStatus: string;
  onVerified: () => void;
}

export const OTPVerifyInput = ({ bookingId, customerName, currentStatus, onVerified }: OTPVerifyInputProps) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(currentStatus === 'in_progress');

  const handleVerify = async () => {
    if (otp.length !== 4) { 
      toast.error('Enter 4-digit code'); 
      return; 
    }
    setLoading(true);
    
    try {
      // Fetch booking and check OTP
      const { data: booking, error } = await supabase
        .from('queue')
        .select('id, arrival_otp, otp_expires_at, status')
        .eq('id', bookingId)
        .maybeSingle();
      
      if (error || !booking) {
        toast.error('Booking not found');
        setLoading(false);
        return;
      }
      
      // Check if OTP expired
      if (booking.otp_expires_at && new Date(booking.otp_expires_at) < new Date()) {
        toast.error('This OTP has expired. Customer needs to rebook.');
        setLoading(false);
        return;
      }
      
      // Check OTP match
      if (booking.arrival_otp !== otp.trim()) {
        toast.error('❌ Wrong code. Please check with the customer.');
        setOtp('');
        setLoading(false);
        return;
      }
      
      // OTP correct — confirm arrival
      const { error: updateError } = await supabase
        .from('queue')
        .update({ 
          status: 'in_progress',
          otp_verified_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (updateError) {
        toast.error('Failed to confirm. Try again.');
      } else {
        setVerified(true);
        toast.success(`✅ ${customerName} confirmed! Seat secured.`);
        onVerified();
      }
    } catch (err) {
      console.error('OTP_VERIFY_ERROR:', err);
      toast.error('Error verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, '');
    const arr = otp.split('');
    arr[index] = val;
    setOtp(arr.join('').slice(0, 4));
    
    if (val && e.target.nextElementSibling) {
      (e.target.nextElementSibling as HTMLInputElement).focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && e.currentTarget.previousElementSibling) {
      (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
    }
  };

  if (verified) return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl">
      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
      <span className="text-sm font-semibold text-green-700">Arrival Confirmed ✓</span>
    </div>
  );

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
        <KeyRound className="w-3 h-3" />
        Enter customer's 4-digit arrival code
      </p>
      <div className="flex gap-2">
        {/* 4 individual boxes */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <input
              key={i}
              type="text"
              maxLength={1}
              value={otp[i] || ''}
              onChange={e => handleInputChange(e, i)}
              onKeyDown={e => handleKeyDown(e, i)}
              className="w-10 h-11 text-center text-lg font-black border-2 border-gray-200 
                         rounded-xl focus:outline-none focus:border-purple-500 transition-all"
            />
          ))}
        </div>
        <button
          onClick={handleVerify}
          disabled={loading || otp.length !== 4}
          className="flex-1 bg-purple-600 text-white rounded-xl text-sm font-semibold 
                     hover:bg-purple-700 disabled:opacity-50 transition-all"
        >
          {loading ? '...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
};

