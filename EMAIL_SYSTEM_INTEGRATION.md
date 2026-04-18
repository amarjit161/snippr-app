// Integration Guide for Salon Closures and Auto-Cancellation

// STEP 1: In OwnerDashboard.tsx (Holiday/Closure Management)
// After successfully adding a holiday, auto-cancel affected bookings:

import { sendBookingEmail } from '@/services/emailService';

// Find this section where holidays are added:
const handleAddHoliday = async (date: string, holidayName: string, notes?: string) => {
  try {
    // ... existing holiday insertion code ...

    // NEW: Auto-cancel affected bookings
    const { data: affectedBookings } = await supabase
      .from('queue')
      .select(`
        id, user_id, booking_date, time_slot,
        services(name, price),
        barbers(name),
        customer_first_name,
        customer_last_name,
        customer_phone
      `)
      .eq('salon_id', salonId)
      .eq('booking_date', date)
      .in('status', ['waiting', 'confirmed']);

    if (affectedBookings && affectedBookings.length > 0) {
      // Cancel all affected bookings
      const { error: cancelError } = await supabase
        .from('queue')
        .update({ status: 'cancelled' })
        .eq('salon_id', salonId)
        .eq('booking_date', date)
        .in('status', ['waiting', 'confirmed']);

      if (!cancelError) {
        // Get owner info once
        const { data: ownerInfo } = await supabase
          .from('owners')
          .select('email')
          .eq('id', currentSalon.owner_id)
          .maybeSingle();

        // Get salon info
        const { data: salonInfo } = await supabase
          .from('salons')
          .select('*')
          .eq('id', salonId)
          .maybeSingle();

        // Send cancellation emails to each affected customer
        for (const booking of affectedBookings) {
          try {
            const { data: customerUser } = await supabase.auth.admin.getUserById(booking.user_id);

            const [h, m] = (booking.time_slot || "").split(":").map(Number);
            const period = h >= 12 ? "PM" : "AM";
            const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
            const displayTime = `${hour}:${String(m).padStart(2, "0")} ${period}`;

            await sendBookingEmail('salon_closed', {
              bookingId: booking.id,
              salonId: salonId,
              salonName: salonInfo?.name || 'Salon',
              salonAddress: salonInfo?.address || salonInfo?.location || '',
              customerName: `${booking.customer_first_name || ''} ${booking.customer_last_name || ''}`.trim() || 'Customer',
              customerEmail: customerUser?.user?.email || '',
              customerPhone: booking.customer_phone,
              ownerEmail: ownerInfo?.email || '',
              serviceName: booking.services?.name || 'Service',
              barberName: booking.barbers?.name || '',
              bookingDate: date,
              timeSlot: displayTime,
              amount: booking.services?.price || 0,
              closeReason: notes || holidayName,
            });
          } catch (err) {
            console.warn(`Failed to send cancellation email for booking ${booking.id}:`, err);
          }
        }

        toast.success(`Holiday added. ${affectedBookings.length} bookings cancelled and customers notified.`);
      }
    } else {
      toast.success('Holiday added.');
    }
  } catch (error) {
    console.error('Error adding holiday:', error);
    toast.error('Failed to add holiday');
  }
};

// STEP 2: In QueueTracker.tsx (Optional: Real-time queue position updates)
// Send queue update emails when customer is getting close:

import { sendQueueUpdateEmail } from '@/services/emailService';

// When updating queue position during booking process:
const notifyCustomerOfQueuePosition = async (
  customerId: string,
  customerEmail: string,
  customerName: string,
  salonName: string,
  queuePosition: number,
  estimatedWaitTime: number
) => {
  await sendQueueUpdateEmail(
    customerName,
    customerEmail,
    salonName,
    queuePosition,
    estimatedWaitTime
  );
};

// STEP 3: Test the email system
// Run in browser console at https://www.snippr.in/owner-dashboard:

// Test 1: Send a booking confirmation
await supabase.functions.invoke('send-email', {
  body: {
    type: 'booking_confirmed',
    recipient: 'customer',
    data: {
      toEmail: 'your-email@gmail.com',
      customerName: 'John Doe',
      salonName: 'Looks Salon',
      bookingDate: '2026-04-25',
      timeSlot: '2:00 PM',
      serviceName: 'Haircut',
      amount: 300,
      salonAddress: '123 Main St, Mumbai',
      salonId: 'salon-uuid-here',
    }
  }
});

// Test 2: Send a cancellation email
await supabase.functions.invoke('send-email', {
  body: {
    type: 'booking_cancelled',
    recipient: 'customer',
    data: {
      toEmail: 'your-email@gmail.com',
      customerName: 'John Doe',
      salonName: 'Looks Salon',
      bookingDate: '2026-04-25',
      timeSlot: '2:00 PM',
      serviceName: 'Haircut',
      amount: 300,
      cancelReason: 'Slot was already taken',
    }
  }
});

// Test 3: Send salon closure notification
await supabase.functions.invoke('send-email', {
  body: {
    type: 'salon_closed',
    recipient: 'customer',
    data: {
      toEmail: 'your-email@gmail.com',
      customerName: 'John Doe',
      salonName: 'Looks Salon',
      bookingDate: '2026-04-25',
      timeSlot: '2:00 PM',
      serviceName: 'Haircut',
      amount: 300,
      closeReason: 'Holiday - Eid celebration',
      salonId: 'salon-uuid-here',
    }
  }
});

// Expected responses should have: { success: true, result: { ... } }

// STEP 4: Configure SMTP2GO (if not already done)
// 1. Sign up for free account at https://www.smtp2go.com
// 2. Get API key from https://www.smtp2go.com/api/
// 3. Go to Supabase Dashboard > Functions > send-email > Details > Secrets
// 4. Add SMTP2GO_API_KEY = your-api-key-here
// 5. Save

// STEP 5: Monitor email sending
// View function logs: https://supabase.com/dashboard/project/curmwhdwzsigaqsasplj/functions
// Check email_notifications table in Supabase for tracking

// Email Templates Supported:
// 1. booking_confirmed (customer & owner)
// 2. booking_cancelled (customer & owner)
// 3. salon_closed (customer only)
// 4. booking_rescheduled (customer & owner)
// 5. queue_update (customer only)

// Done! The email system is now ready to use in your app.
