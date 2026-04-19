// Phone authentication via backend API routes (to avoid CORS issues)

// Send OTP via backend API
export const sendPhoneOTP = async (phone: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Format phone number
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g,'').slice(-10)}`;
    
    console.log('[sendPhoneOTP] Calling backend API for:', formatted);

    const response = await fetch('/api/send-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formatted })
    });

    const data = await response.json();
    console.log('[sendPhoneOTP] Response:', data);
    
    if (data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to send OTP' };
  } catch (err: any) {
    console.error('[sendPhoneOTP] Error:', err);
    return { success: false, error: err.message };
  }
};

// Verify OTP via backend API
export const verifyPhoneOTP = async (phone: string, otp: string): Promise<{ success: boolean; token?: string; error?: string }> => {
  try {
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g,'').slice(-10)}`;
    
    console.log('[verifyPhoneOTP] Calling backend API');

    const response = await fetch('/api/verify-phone-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formatted, otp })
    });

    const data = await response.json();
    console.log('[verifyPhoneOTP] Response:', data);

    if (data.success && data.token) {
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'Invalid OTP' };
  } catch (err: any) {
    console.error('[verifyPhoneOTP] Error:', err);
    return { success: false, error: err.message };
  }
};

// Check if phone is already registered
export const checkPhoneExists = async (phone: string): Promise<boolean> => {
  const { supabase } = await import('@/integrations/supabase/client');
  const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g,'').slice(-10)}`;
  const { data } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('phone', formatted)
    .maybeSingle();
  return !!data;
};
