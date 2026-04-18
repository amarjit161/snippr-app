# Phone.email Integration Guide

Complete setup for phone number verification using phone.email service in Snippr.

## Files Created

### 1. Component
- **[src/components/PhoneEmailVerification.tsx](../src/components/PhoneEmailVerification.tsx)** - React component for phone verification

### 2. API Endpoint
- **[api/verify-phone-email.ts](../api/verify-phone-email.ts)** - Backend handler for verifying phone data

### 3. Page
- **[src/pages/PhoneVerification.tsx](../src/pages/PhoneVerification.tsx)** - Full page implementation

## Setup Steps

### Step 1: Register with phone.email

1. Visit https://www.phone.email/
2. Sign up and create an account
3. Get your button code from the dashboard
4. The external script is loaded automatically from: `https://www.phone.email/sign_in_button_v1.js`

### Step 2: Environment Variables

Add to `.env.local`:
```
VITE_PHONE_EMAIL_ENABLED=true
```

Add to Vercel (for production):
```
VITE_PHONE_EMAIL_ENABLED=true
```

### Step 3: Update Your Routes

Add this to your router configuration:

```typescript
import PhoneVerification from "@/pages/PhoneVerification";

// In your routes array:
{
  path: "/verify-phone",
  element: <PhoneVerification />
}
```

### Step 4: Integrate with Existing Authentication

Option A: **Replace existing phone OTP**

Replace phone verification in `src/components/OTPLogin.tsx`:

```typescript
// Old phone verification mode
{mode === "phone" && (
  <PhoneEmailVerification onSuccess={() => navigate("/dashboard")} />
)}
```

Option B: **Add as alternative method**

Keep both verification methods available:

```typescript
import PhoneEmailVerification from "@/components/PhoneEmailVerification";

// In your auth page:
<div className="space-y-4">
  <OTPLogin /> {/* Existing email + phone OTP */}
  
  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">Or</span>
    </div>
  </div>

  <PhoneEmailVerification onSuccess={() => navigate("/dashboard")} />
</div>
```

## How It Works

### User Flow

1. **User clicks "Verify Phone"**
   - Phone.email button is displayed
   - User clicks and enters their phone number

2. **Phone.email processes verification**
   - Sends verification code via phone call or SMS
   - User verifies and phone.email returns `user_json_url`

3. **Frontend calls backend**
   - Sends `user_json_url` to `/api/verify-phone-email`
   - Backend fetches authenticated phone data

4. **Backend verifies data**
   - Extracts phone number and country code
   - Stores in database (if needed)
   - Returns verified phone data

5. **Frontend shows success**
   - Displays verified phone number
   - Redirects to dashboard
   - Stores phone in localStorage

### Data Flow

```
Phone.email Widget
        ↓
phoneEmailListener callback (user_json_url)
        ↓
fetchPhoneData("/api/verify-phone-email")
        ↓
/api/verify-phone-email endpoint
        ↓
Fetch authenticated data from user_json_url
        ↓
Return phone_number + country_code
        ↓
Frontend stores & redirects to dashboard
```

## Component Props

```typescript
interface PhoneEmailVerificationProps {
  onSuccess?: (phoneData: any) => void;  // Called on successful verification
  onError?: (error: string) => void;     // Called on error
}

// Usage:
<PhoneEmailVerification 
  onSuccess={(data) => console.log("Phone:", data.phone_number)}
  onError={(error) => console.error(error)}
/>
```

## API Response

```typescript
{
  "phone_number": "+1234567890",
  "country_code": "US",
  "verified": true,
  "message": "Phone verified successfully"
}
```

## Storage

Verified phone data is stored in:

```typescript
// localStorage
localStorage.getItem("snippr_verified_phone")      // "+1234567890"
localStorage.getItem("snippr_country_code")        // "US"

// Optional: database
// Insert into users table:
{
  verified_phone: "+1234567890",
  verified_phone_at: NOW(),
  phone_country_code: "US"
}
```

## Customization

### Change redirect URL

```typescript
// In PhoneEmailVerification.tsx, line ~80
setTimeout(() => {
  navigate("/your-custom-path");  // Change this
}, 2000);
```

### Store additional data

```typescript
// In /api/verify-phone-email.ts
const userData = await response.json();

// Extract custom fields:
const {
  phone_number,
  country_code,
  // Add other fields from phone.email response
  custom_field: customValue
} = userData;
```

### Styling

The component uses your app's existing design tokens:

```typescript
// Change colors in PhoneEmailVerification.tsx

// Green gradient (phone verification)
<div className="bg-gradient-to-br from-green-500 to-emerald-500">

// Success message styling
<div className="bg-green-50 dark:bg-green-950">

// Error message styling
<div className="bg-red-50 dark:bg-red-950">
```

## Troubleshooting

### Button not showing

1. Check if phone.email script loaded:
```typescript
console.log("phone.email script loaded:", window.phone_email);
```

2. Verify `user_json_url` is received:
```typescript
console.log("User JSON URL:", userObj.user_json_url);
```

### Backend endpoint 404

1. Ensure file exists: `api/verify-phone-email.ts`
2. For Vercel: Rebuild deployment
3. For local dev: Restart dev server

### Phone verification fails

1. Check network tab for `/api/verify-phone-email` response
2. Verify `user_json_url` is valid (not expired)
3. Check console for CORS issues
4. Ensure phone.email account is active

## Production Deployment

### Vercel

1. File is already in `api/` folder (auto-deployed)
2. Add environment variables in Vercel Dashboard
3. Test: `https://your-domain.vercel.app/verify-phone`

### Custom Server

Copy `api/verify-phone-email.ts` to your server and adapt:

```typescript
// Express.js example
app.post('/api/verify-phone-email', handler);

// Node.js/Fastify example
app.post('/api/verify-phone-email', async (req, res) => {
  // ... implementation
});
```

## Security Notes

✅ **Secure practices:**
- phone.email handles verification (no phone numbers sent to your server)
- Only authenticated phone data is fetched via `user_json_url`
- Phone number stored server-side after verification
- HTTPS required for production

⚠️ **Before production:**
- Add user authentication check in `/api/verify-phone-email`
- Validate `user_json_url` format
- Add rate limiting to prevent abuse
- Log verification attempts
- Add database schema for verified phones

## Database Schema (Optional)

```sql
-- Add to users table migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS (
  verified_phone TEXT,
  phone_country_code VARCHAR(2),
  verified_phone_at TIMESTAMPTZ
);

-- Add index for lookups
CREATE INDEX idx_users_verified_phone ON users(verified_phone);
```

## Next Steps

1. ✅ Component created
2. ✅ API endpoint created
3. ⏳ Register with phone.email service
4. ⏳ Add environment variables to Vercel
5. ⏳ Test locally
6. ⏳ Deploy to production
