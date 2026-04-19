# User Profile Completion System

## Overview
The profile completion system ensures all customer users have verified phone numbers and gender information before accessing booking features. This is a mandatory onboarding flow.

## User Journey

### 1. Registration Flow (`/register`)
- User enters: First Name, Last Name, Email, Phone (optional), Gender (optional), Password
- System sends Email OTP (via Supabase) + Phone OTP (via phone.email) if phone provided
- User verifies both OTPs
- Basic profile created with `first_name`, `last_name`, `email`, and optionally `phone` and `gender`
- User redirects to **Profile Completion** page

### 2. Profile Completion Flow (`/profile-completion`)
Users must complete three steps to reach 100%:

#### Step 1: Email (25%) ✓ Auto-verified from registration
- Email shown as verified (from registration)
- Displays: `✓ Email Verified`

#### Step 2: Phone Verification (50%)
- Enter 10-digit Indian phone number
- Send OTP button (phone.email API)
- Enter 6-digit OTP to verify
- On verification: Phone saved to `customer_profiles.phone` with `+91` prefix
- Progress: 50%

#### Step 3: Gender Selection (75%)
- Select: Male / Female / Other
- Save gender to `customer_profiles.gender`
- Progress: 75%

#### Step 4: Optional Password Change (100%)
- User can change password (optional)
- After all required fields filled: "Start Booking Salons →" button appears
- Progress: 100%

### 3. Login Flow
Both email and phone login methods now check profile completion:
- **Email Login** (`/login`): Email + Password → Check if profile complete
- **Phone Login** (`/login`): Phone + OTP → Check if profile complete
- **Google SSO**: Auto-creates profile → Check if complete
- If profile NOT complete → Redirect to `/profile-completion`
- If profile IS complete → Redirect to `/salons`

### 4. Protected Routes
All protected routes (via `ProtectedRoute` component) check profile completion:
- If accessing `/salons` or `/salon/:id` without complete profile
- Automatically redirects to `/profile-completion`
- Once complete, user can access all booking features

## Database Schema

### customer_profiles table
```sql
- id (UUID, Primary Key)
- email (Text)
- first_name (Text)
- last_name (Text)
- phone (Text) -- Required for access, format: +91XXXXXXXXXX
- gender (Text) -- Required for access, one of: Male, Female, Other
- created_at (Timestamp)
- updated_at (Timestamp)
```

### Progress Calculation
```
25% = Email verified (auto-done at registration)
50% = Email + Phone verified
75% = Email + Phone + Gender
100% = Email + Phone + Gender + All steps complete
```

## Key Features

✅ **Mandatory Phone Verification**
- Indian phone numbers only
- 10-digit format required
- OTP sent via phone.email API
- Phone stored with +91 prefix

✅ **Mandatory Gender Selection**
- Male / Female / Other
- Required for profile completion

✅ **Progress Tracking**
- Visual progress bar (0-100%)
- Rounded progress indicators for each step
- Real-time percentage display

✅ **Duplicate Phone Prevention**
- Check if phone already registered (excluding current user)
- Show error: "This phone number is already registered"

✅ **Optional Password Change**
- Available at profile completion step
- Requires current password + new password confirmation
- Updates auth password via Supabase

✅ **Clean Navigation**
- Single login page (`/login`) for both email and phone
- Registration page (`/register`) for new users
- Profile completion page (`/profile-completion`) for onboarding
- Auto-redirect based on profile completion status

## Removed/Deprecated Auth Pages
The following old auth pages should not be used anymore:
- `/auth` - Old legacy auth
- `/owner-login` - Use `/login` instead (or create owner-specific flow if needed)
- `/owner-signup` - Use `/register` instead

## API Integrations

### Supabase Auth
- `signUp()` - Create account with email/password
- `signInWithOtp()` - Send email OTP
- `verifyOtp()` - Verify email OTP
- `signInWithPassword()` - Email login
- `updateUser()` - Change password

### phone.email API (via phoneAuth service)
- `sendPhoneOTP(phone)` - Send OTP to Indian phone
- `verifyPhoneOTP(phone, otp)` - Verify OTP from phone
- `checkPhoneExists(phone)` - Check if phone registered

## Testing Checklist

- [ ] Register with email + phone → Verify dual OTP → Profile created
- [ ] Register with email only → Can complete phone verification later
- [ ] Login with email → If profile incomplete → Redirect to profile completion
- [ ] Login with phone → If profile incomplete → Redirect to profile completion
- [ ] Google login → If profile incomplete → Redirect to profile completion
- [ ] Complete profile → Can access `/salons`
- [ ] Try accessing `/salons` without complete profile → Auto-redirect
- [ ] Change password from profile completion page
- [ ] Duplicate phone number → Show error

## File Structure

```
src/
├── pages/
│   ├── CustomerRegister.tsx       -- Registration with dual OTP
│   ├── CustomerLogin.tsx          -- Email/Phone login with SSO
│   └── ProfileCompletion.tsx      -- Profile completion onboarding (NEW)
├── components/
│   └── ProtectedRoute.tsx         -- Updated to check profile completion
├── services/
│   └── phoneAuth.ts              -- Phone OTP service
└── contexts/
    └── AuthContext.tsx            -- Auth state management
```

## Notes
- Phone number is MANDATORY for all users
- Gender is MANDATORY for profile completion
- Email verification happens automatically during registration
- All new users go through profile completion after registration
- Returning users are prompted on login if profile incomplete
