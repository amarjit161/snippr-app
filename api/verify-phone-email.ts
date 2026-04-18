/**
 * API endpoint to verify phone number from phone.email service
 * POST /api/verify-phone-email
 * 
 * Body:
 * {
 *   "user_json_url": string (from phone.email callback)
 * }
 * 
 * Response:
 * {
 *   "phone_number": string,
 *   "country_code": string,
 *   "verified": boolean
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_json_url } = req.body;

    if (!user_json_url) {
      return res.status(400).json({ error: 'user_json_url is required' });
    }

    // Fetch the authenticated phone data from phone.email
    const response = await fetch(user_json_url);
    
    if (!response.ok) {
      return res.status(400).json({ 
        error: 'Failed to fetch phone data from phone.email',
        details: response.statusText 
      });
    }

    const userData = await response.json();

    // Extract phone number and country code
    const phoneNumber = userData.phone_number || userData.phone || '';
    const countryCode = userData.country_code || userData.cc || '';

    if (!phoneNumber) {
      return res.status(400).json({ error: 'No phone number in response' });
    }

    // Optional: Store in your database
    // await savePhoneVerification({
    //   phone_number: phoneNumber,
    //   country_code: countryCode,
    //   verified_at: new Date(),
    //   user_id: userId // if you have user context
    // });

    return res.status(200).json({
      phone_number: phoneNumber,
      country_code: countryCode,
      verified: true,
      message: 'Phone verified successfully'
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ 
      error: 'Phone verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
