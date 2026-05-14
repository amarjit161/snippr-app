import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendPhoneOTP, verifyPhoneOTP } from '@/services/phoneAuth';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface PhoneVerifyModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PhoneStep = 'enter_phone' | 'enter_otp';

export const PhoneVerifyModal = ({ userId, isOpen, onClose, onSuccess }: PhoneVerifyModalProps) => {
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enter_phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (!isOpen) return null;

  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) { 
      toast.error('Enter a valid 10-digit phone number'); 
      return; 
    }
    
    setLoading(true);
    const result = await sendPhoneOTP(digits);
    
    if (result.success) {
      setPhoneStep('enter_otp');
      startCountdown(60);
      toast.success('OTP sent to your phone!');
    } else {
      toast.error(result.error || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { 
      toast.error('Enter 6-digit OTP'); 
      return; 
    }
    setLoading(true);
    
    const result = await verifyPhoneOTP(phone, otp);
    
    if (result.success) {
      // Save phone to customer_profiles
      const digits = phone.replace(/\D/g,'').slice(-10);
      const phoneFormatted = `+91${digits}`;
      
      try {
        await supabase.from('customer_profiles')
          .update({ phone: phoneFormatted })
          .eq('id', userId);
        
        toast.success('Phone verified! 📱');
        onSuccess?.();
        handleClose();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save phone');
      }
    } else {
      toast.error(result.error || 'Invalid OTP');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setPhoneStep('enter_phone');
    setPhone('');
    setOtp('');
    setCountdown(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 relative">
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Verify your mobile number</h2>
            <p className="text-sm text-gray-500 mt-1">Needed for booking confirmations & salon calls</p>
          </div>

          {phoneStep === 'enter_phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 py-3 bg-gray-50 border border-gray-200 
                                  rounded-xl text-sm font-medium text-gray-700 flex-shrink-0">
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                    placeholder="10-digit number"
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm 
                               focus:outline-none focus:ring-2 focus:ring-purple-500 
                               focus:border-transparent transition-all"
                    maxLength={10}
                    autoFocus
                  />
                </div>
              </div>
              
              <button
                onClick={handleSendOTP}
                disabled={loading || phone.length !== 10}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold 
                           text-sm hover:bg-purple-700 transition-all disabled:opacity-50
                           shadow-lg shadow-purple-200"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>

              <button
                onClick={handleClose}
                className="w-full text-gray-600 text-sm font-medium hover:underline"
              >
                Skip for now
              </button>
            </div>
          )}

          {phoneStep === 'enter_otp' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-gray-500">
                  OTP sent to <strong>+91 {phone}</strong>
                </p>
                <button
                  onClick={() => setPhoneStep('enter_phone')}
                  className="text-xs text-purple-600 hover:underline mt-1"
                >
                  Change number
                </button>
              </div>
              
              {/* 6-box OTP input */}
              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={otp[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g,'');
                      const newOtp = otp.split('');
                      newOtp[i] = val;
                      setOtp(newOtp.join(''));
                      if (val && e.target.nextElementSibling) {
                        (e.target.nextElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !otp[i] && e.currentTarget.previousElementSibling) {
                        (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                      }
                    }}
                    className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 
                               rounded-xl focus:outline-none focus:border-purple-500 transition-all"
                  />
                ))}
              </div>
              
              <button
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold 
                           text-sm hover:bg-purple-700 disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-gray-400">Resend OTP in {countdown}s</p>
                ) : (
                  <button 
                    onClick={handleSendOTP} 
                    className="text-sm text-purple-600 font-medium hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <button
                onClick={handleClose}
                className="w-full text-gray-600 text-sm font-medium hover:underline"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneVerifyModal;

