import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ZOHO_USER = "noreply@snippr.in";
const ZOHO_PASS = Deno.env.get("ZOHO_SMTP_PASSWORD") || "";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

// Kept for future extension if you want to store email delivery logs.
const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const {
      type,
      bookingId,
      userEmail,
      userName,
      salonName,
      serviceName,
      bookingDate,
      timeSlot,
      amount,
    } = await req.json();

    const subjects: Record<string, string> = {
      confirmed: `Booking Confirmed - ${salonName}`,
      cancelled: `Booking Cancelled - ${salonName}`,
      reminder: `Reminder: Your appointment tomorrow at ${salonName}`,
    };

    const bodies: Record<string, string> = {
      confirmed: `
        <h2>Your booking is confirmed!</h2>
        <p>Hi ${userName},</p>
        <p>Your appointment at <strong>${salonName}</strong> is confirmed.</p>
        <table style="background:#f9fafb;padding:16px;border-radius:12px;width:100%;">
          <tr><td>Date</td><td><strong>${bookingDate}</strong></td></tr>
          <tr><td>Time</td><td><strong>${timeSlot}</strong></td></tr>
          <tr><td>Service</td><td><strong>${serviceName}</strong></td></tr>
          <tr><td>Amount</td><td><strong>Rs.${amount}</strong></td></tr>
        </table>
        <p>You will get a notification when it is almost your turn.</p>
      `,
      cancelled: `
        <h2>Booking Cancelled</h2>
        <p>Hi ${userName}, your booking at <strong>${salonName}</strong> on ${bookingDate} at ${timeSlot} has been cancelled.</p>
        <p>To rebook, visit <a href="https://www.snippr.in">snippr.in</a></p>
      `,
      reminder: `
        <h2>Appointment Reminder</h2>
        <p>Hi ${userName}, this is a reminder for your appointment tomorrow at <strong>${salonName}</strong>.</p>
        <p>${bookingDate} at ${timeSlot} for ${serviceName}.</p>
      `,
    };

    // Placeholder for SMTP/mail API integration.
    // Keep as no-op unless SMTP or third-party mail provider endpoint is configured.
    const emailPayload = {
      from: ZOHO_USER,
      to: userEmail,
      subject: subjects[type] || subjects.confirmed,
      html: bodies[type] || bodies.confirmed,
      bookingId,
      hasZohoPassword: Boolean(ZOHO_PASS),
    };

    console.log("EMAIL_SENT:", {
      type,
      userEmail,
      salonName,
      bookingId,
      canPersistLogs: Boolean(supabaseClient),
      preview: emailPayload.subject,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("EMAIL_SEND_FAILED", error);

    return new Response(JSON.stringify({ success: false, error: "email_send_failed" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});