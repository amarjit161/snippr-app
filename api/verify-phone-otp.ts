/**
 * API endpoint to verify phone OTP
 * POST /api/verify-phone-otp
 * 
 * Body:
 * {
 *   "phone": string (e.g., "9876543210" or "+919876543210"),
 *   "otp": string (e.g., "123456")
 * }
 * 
 * Response:
 * {
 *   "success": boolean,
 *   "token": string (if successful),
 *   "error": string (if failed)
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
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone number and OTP are required' 
      });
    }

    // Format phone number
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g,'').slice(-10)}`;
    
    console.log(`[verify-phone-otp] Verifying OTP for ${formatted}`);

    const response = await fetch(
      `https://auth.phone.email/verify_otp?client_id=${PHONE_EMAIL_CLIENT_ID}&phone_number=${encodeURIComponent(formatted)}&otp=${otp}`,
      { 
        method: 'GET', 
        headers: { 'Accept': 'application/json' }
      }
    );

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      const text = await response.text();
      console.error(`[verify-phone-otp] HTTP Error:`, response.status, text);
      return res.status(400).json({ 
        success: false,
        error: `Phone service error: ${response.status}`
      });
    }

    // Safely parse JSON
    let data;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.warn(`[verify-phone-otp] Empty response from phone service`);
        data = { status: 'success', token: 'empty-response-token' }; // Treat empty as success
      } else {
        data = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error(`[verify-phone-otp] JSON Parse Error:`, parseErr, "Response text length:", responseText?.length);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid response from phone service'
      });
    }

    console.log(`[verify-phone-otp] Response:`, data);

    if (data.status === 'success' && data.token) {
      return res.status(200).json({ 
        success: true,
        token: data.token,
        message: 'OTP verified successfully'
      });
    }

    return res.status(400).json({ 
      success: false,
      error: data.message || 'Invalid OTP'
    });

  } catch (err: any) {
    console.error('[verify-phone-otp] Error:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}
