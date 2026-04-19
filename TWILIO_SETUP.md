# Twilio + Supabase Phone Auth Setup Guide

## ✅ What You Need to Provide

### 1. Twilio Account Details
From your Twilio dashboard (https://console.twilio.com):
- **Account SID**: `AC...` (find in Account Info section)
- **Auth Token**: (shown when you generate/view tokens)
- **Twilio Phone Number**: The number that will send SMS (e.g., `+1234567890`)

### 2. Supabase Configuration
These will be added to Supabase Auth settings:
- Go to: Supabase Dashboard → Authentication → Providers → Phone
- Enable Phone Provider
- Add Twilio credentials there

### 3. Environment Variables
Will be added to `.env.local` and Vercel:
```
VITE_TWILIO_ACCOUNT_SID=your_account_sid
VITE_TWILIO_AUTH_TOKEN=your_auth_token
VITE_TWILIO_PHONE_NUMBER=your_twilio_number
```

## 🔧 Implementation Plan

### Phase 1: Remove phone.email (DONE AFTER TWILIO PROVIDED)
- [ ] Delete `/api/send-phone-otp.ts`
- [ ] Delete `/api/verify-phone-otp.ts`
- [ ] Delete `/api/test-phone-email.ts`
- [ ] Remove `src/services/phoneAuth.ts`
- [ ] Remove phone.email env variables

### Phase 2: Set Up Supabase Phone Auth (DONE AFTER TWILIO PROVIDED)
- [ ] Configure Twilio in Supabase Auth settings
- [ ] Update environment variables
- [ ] Test phone auth flow

### Phase 3: Rebuild Auth Pages (DONE AFTER TWILIO PROVIDED)
- [ ] **CustomerLogin.tsx**: Email + Password login (keep simple)
- [ ] **CustomerRegister.tsx**: Email/Password registration with phone verification
- [ ] **ProfileCompletion.tsx**: For users who need to complete profile

### Phase 4: Features
- [ ] Phone verification with SMS OTP
- [ ] Login with email/password
- [ ] Register with email/password + phone OTP
- [ ] Profile completion (gender selection)
- [ ] Keep Google OAuth working

## 📝 Current Status
- phone.email is not working (returns empty responses)
- Phone OTP endpoints created but API issue on their end
- Switching to Twilio via Supabase built-in provider (more reliable)

## 🚀 Next Step
Provide the Twilio credentials above and I'll implement the full setup
