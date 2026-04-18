import { supabase } from '@/integrations/supabase/client';

interface BookingEmailData {
  bookingId: string;
  salonId: string;
  salonName: string;
  salonAddress?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  ownerEmail: string;
  serviceName: string;
  barberName?: string;
  bookingDate: string;
  timeSlot: string;
  amount: number;
  cancelReason?: string;
  closeReason?: string;
  oldDate?: string;
  oldTime?: string;
  queuePosition?: number;
  waitTime?: number;
}

type EmailType = 
  | 'booking_confirmed'
  | 'booking_cancelled' 
  | 'salon_closed'
  | 'booking_rescheduled'
  | 'queue_update';

export const sendBookingEmail = async (
  type: EmailType,
  data: BookingEmailData,
  sendToOwner = true
) => {
  try {
    // Send to customer
    await supabase.functions.invoke('send-email', {
      body: { 
        type, 
        recipient: 'customer',
        data: { ...data, toEmail: data.customerEmail }
      }
    });

    // Send to owner (not for queue updates)
    if (sendToOwner && type !== 'queue_update') {
      await supabase.functions.invoke('send-email', {
        body: { 
          type, 
          recipient: 'owner',
          data: { ...data, toEmail: data.ownerEmail }
        }
      });
    }

    console.log(`✉️ EMAIL_SENT: ${type} to customer${sendToOwner && type !== 'queue_update' ? ' + owner' : ''}`);
  } catch (err) {
    console.error('❌ EMAIL_SERVICE_ERROR:', err);
    // Don't throw — email failure shouldn't block the booking
  }
};

export const sendQueueUpdateEmail = async (
  customerName: string,
  customerEmail: string,
  salonName: string,
  queuePosition: number,
  waitTime: number
) => {
  return sendBookingEmail(
    'queue_update',
    {
      bookingId: '',
      salonId: '',
      salonName,
      customerName,
      customerEmail,
      ownerEmail: '',
      serviceName: '',
      bookingDate: new Date().toISOString().split('T')[0],
      timeSlot: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      amount: 0,
      queuePosition,
      waitTime,
    },
    false // Don't send to owner for queue updates
  );
};
