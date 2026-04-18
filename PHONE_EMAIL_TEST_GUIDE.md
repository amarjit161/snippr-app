/**
 * Phone.email Integration Test Guide
 * 
 * Follow these steps to test the phone.email verification system
 */

// ============================================================
// STEP 1: Update Your Router with Test Page
// ============================================================

// In: src/main.tsx or your router file:

import TestPhoneVerification from "@/pages/TestPhoneVerification";

// Add this route:
{
  path: "/test-phone",
  element: <TestPhoneVerification />
}

// Then visit: http://localhost:5173/test-phone


// ============================================================
// STEP 2: Test Environment Setup
// ============================================================

// Your .env.local should have:
/*
VITE_PHONE_EMAIL_ENABLED=true
*/

// Verify it's loaded:
console.log("Phone.email enabled:", import.meta.env.VITE_PHONE_EMAIL_ENABLED);


// ============================================================
// STEP 3: Test Scenarios
// ============================================================

// Test Scenario 1: SignInButton (Simple)
// - Click button
// - Enter phone number
// - Should show debug message with user_json_url
// - Check console for URL

// Test Scenario 2: PhoneEmailVerification (Full)
// - Should show loading state while verifying
// - After successful verification:
//   - Show green success message with phone number
//   - localStorage should have "snippr_verified_phone"
//   - localStorage should have "snippr_country_code"

// Test Scenario 3: Backend Endpoint
// Use PowerShell:
/*
$body = @{
  user_json_url = "https://user.phone.email/user_XXXXXXXXXXXX.json"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:5173/api/verify-phone-email" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body -UseBasicParsing

Write-Host $response.Content
*/


// ============================================================
// STEP 4: Expected Test Results
// ============================================================

// ✅ SignInButton Test:
// 1. Button renders (white button with phone icon)
// 2. Click opens phone.email widget
// 3. Enter phone number
// 4. Get verification code via call/SMS
// 5. Console shows: "Phone Verification Successful!"
// 6. Console shows: "User JSON URL: https://..."

// ✅ PhoneEmailVerification Test:
// 1. Component renders with green phone icon
// 2. Button appears (phone.email widget)
// 3. After verification:
//    - Green success box shows
//    - Phone number displays
//    - Loader disappears
//    - Auto-redirects to /dashboard (or manual redirect)

// ✅ Backend Test:
// 1. Response status: 200
// 2. Response body: {
//      "phone_number": "+1234567890",
//      "country_code": "US",
//      "verified": true,
//      "message": "Phone verified successfully"
//    }


// ============================================================
// STEP 5: Debugging Tips
// ============================================================

// If button doesn't appear:
console.log("1. Check if element with class 'pe_signin_button' exists");
console.log("2. Verify data-client-id is correct: 15695407177920574360");
console.log("3. Check browser console for script load errors");

// If verification fails:
console.log("1. Check Network tab for /api/verify-phone-email response");
console.log("2. Verify user_json_url is valid (not expired)");
console.log("3. Check CORS - should not have CORS errors");

// If backend returns error:
console.log("1. Check if user_json_url format is correct");
console.log("2. Verify fetch from phone.email service succeeds");
console.log("3. Check API logs for details");


// ============================================================
// STEP 6: Common Issues & Solutions
// ============================================================

/*
ISSUE: Button not showing
SOLUTION:
- Add class="pe_signin_button" to container div
- Ensure data-client-id attribute is present
- Wait for script to load (give it 2-3 seconds)

ISSUE: "Phone Verification Successful" message doesn't appear
SOLUTION:
- Clear browser cache
- Check browser console for errors
- Verify phoneEmailListener function is defined
- Check if script loaded from https://www.phone.email/sign_in_button_v1.js

ISSUE: Backend returns 400 error
SOLUTION:
- user_json_url might be expired (valid for ~5 minutes)
- Try again within timeframe
- Verify request body format is correct

ISSUE: "undefined" phone number
SOLUTION:
- phone.email response structure might be different
- Log userData object to check field names
- May be "phone" instead of "phone_number"
*/


// ============================================================
// STEP 7: Full Integration Test
// ============================================================

// Create a test workflow:
/*
1. Start dev server:
   npm run dev

2. Navigate to http://localhost:5173/test-phone

3. Test SignInButton:
   - See if button renders
   - Click and verify
   - Check console for user_json_url

4. Test PhoneEmailVerification:
   - Verify full workflow
   - Check localStorage values
   - Verify redirect works

5. Check Network tab:
   - POST /api/verify-phone-email
   - Response should be 200
   - Body should have phone_number

6. Check Console:
   - No errors
   - Should see success messages
*/


// ============================================================
// STEP 8: Production Checklist
// ============================================================

/*
Before deploying to production:

✅ Phone.email account created
✅ Client ID configured (in component or env)
✅ Backend endpoint deployed to Vercel
✅ Environment variables set in Vercel
✅ Tested in development
✅ Tested in staging
✅ Error handling in place
✅ User feedback messages clear
✅ Privacy policy updated
✅ Terms of service updated
*/
