/**
 * Direct test endpoint to diagnose phone.email API responses
 * GET /api/test-phone-email?phone=8470872545
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PHONE_EMAIL_CLIENT_ID = process.env.VITE_PHONE_EMAIL_CLIENT_ID || '';
const PHONE_EMAIL_API_KEY = process.env.VITE_PHONE_EMAIL_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { phone } = req.query;
  
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Phone number required' });
  }

  try {
    const formatted = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g,'').slice(-10)}`;
    
    console.log(`[test-phone-email] Testing send_otp for: ${formatted}`);
    console.log(`[test-phone-email] CLIENT_ID: ${PHONE_EMAIL_CLIENT_ID}`);
    console.log(`[test-phone-email] API_KEY present: ${!!PHONE_EMAIL_API_KEY}`);
    
    const url = `https://auth.phone.email/send_otp`;
    console.log(`[test-phone-email] URL: ${url}`);
    
    // Try without Bearer token first (API key might be meant for another purpose)
    const response = await fetch(url, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: PHONE_EMAIL_CLIENT_ID,
        phone_number: formatted,
        api_key: PHONE_EMAIL_API_KEY
      }).toString()
    });

    console.log(`[test-phone-email] HTTP Status: ${response.status}`);
    console.log(`[test-phone-email] Headers:`, Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log(`[test-phone-email] Raw Response: ${text}`);
    
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }
    
    return res.status(200).json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      rawResponse: text,
      parsedResponse: data,
      clientId: PHONE_EMAIL_CLIENT_ID,
      phone: formatted
    });
    
  } catch (err: any) {
    console.error('[test-phone-email] Error:', err);
    return res.status(500).json({ 
      error: err.message,
      stack: err.stack
    });
  }
}
