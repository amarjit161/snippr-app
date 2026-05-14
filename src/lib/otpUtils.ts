/**
 * OTP Generation and Verification Utilities
 */

/**
 * Generate a random 4-digit OTP
 */
export const generateOTP = (): string => {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
};

/**
 * Update booking with OTP
 * OTP stays valid until booking is completed, cancelled, or rejected (status-based expiry)
 * NOT time-based - works like Amazon/Flipkart delivery tracking
 */
export const updateBookingWithOTP = async (
  supabase: any,
  bookingId: string,
  otp: string
): Promise<boolean> => {
  const { error } = await supabase
    .from('queue')
    .update({
      arrival_otp: otp,
      // Note: otp_expires_at is NOT set - OTP validity is based on booking status
      // OTP is valid for: waiting, confirmed, accepted, in_progress
      // OTP becomes invalid for: completed, cancelled, rejected, done
    })
    .eq('id', bookingId);

  return !error;
};

