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
    .from('bookings')
    .update({
      otp: otp,
    })
    .eq('id', bookingId);

  return !error;
};

