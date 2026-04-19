/**
 * API endpoint to send phone OTP
 * POST /api/send-phone-otp
 * 
 * Body:
 * {
 *   "phone": string (e.g., "9876543210" or "+919876543210")
 * }
 * 
 * Response:
 * {
 *   "success": boolean,
 *   "message": string
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PHONE_EMAIL_CLIENT_ID = process.env.VITE_PHONE_EMAIL_CLIENT_ID || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone number is required' 
      });
    }

    // Format phone number
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g,'').slice(-10)}`;
    
    console.log(`[send-phone-otp] Sending OTP to ${formatted}`);

    const response = await fetch(
      `https://auth.phone.email/send_otp?client_id=${PHONE_EMAIL_CLIENT_ID}&phone_number=${encodeURIComponent(formatted)}`,
      { 
        method: 'GET', 
        headers: { 'Accept': 'application/json' }
      }
    );

    // Log response status and headers
    console.log(`[send-phone-otp] HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`[send-phone-otp] Response Headers:`, {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
    });

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      const text = await response.text();
      console.error(`[send-phone-otp] HTTP Error:`, response.status, text);
      return res.status(400).json({ 
        success: false,
        error: `Phone service error: ${response.status}`,
        details: text
      });
    }

    // Safely parse JSON
    let data;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.warn(`[send-phone-otp] Empty response from phone service`);
        data = { status: 'success' }; // Treat empty response as success
      } else {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error(`[send-phone-otp] JSON Parse Error:`, parseErr, "Response text length:", responseText?.length);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid response from phone service'
      });
    }

    console.log(`[send-phone-otp] Response:`, data);
    console.log(`[send-phone-otp] Full response object:`, JSON.stringify(data, null, 2));

    if (data.status === 'success' || response.ok) {
      console.log(`[send-phone-otp] ✓ OTP sent successfully to ${formatted}`);
      return res.status(200).json({ 
        success: true,
        message: 'OTP sent successfully',
        phoneEmailResponse: data
      });
    }

    console.log(`[send-phone-otp] ✗ Failed - status was:`, data.status, `response data:`, data);
    return res.status(400).json({ 
      success: false,
      error: data.message || 'Failed to send OTP'
    });

  } catch (err: any) {
    console.error('[send-phone-otp] Error:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
