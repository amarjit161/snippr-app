# Supabase Twilio Configuration - Quick Start

## 🎯 One-Click Setup Guide

### Your Twilio Details
```
Account SID:     [YOUR_ACCOUNT_SID]
Auth Token:      [YOUR_AUTH_TOKEN]
Phone Number:    [YOUR_TWILIO_PHONE]
```

> 💡 **Tip:** Get these from your Twilio Console at https://console.twilio.com

---

## 📍 Location in Supabase Dashboard

1. Open: https://app.supabase.com
2. Select project: **snippr-app**
3. Navigate: **Authentication** (left sidebar)
4. Click: **Providers** (under Authentication)
5. Look for: **Phone** provider

---

## ⚙️ Configuration Steps

### If Phone Provider Not Visible:
- Enable it first by clicking **Enable Phone Provider**

### Once Phone Provider Page Opens:
1. **Provider Selection**
   - Choose: **Twilio** (from dropdown)

2. **Fill Credentials**
   - Account SID: `[YOUR_ACCOUNT_SID]`
   - Auth Token: `[YOUR_AUTH_TOKEN]`
   - Twilio Phone Number: `[YOUR_TWILIO_PHONE]`

3. **Save**
   - Click green **Save** button

4. **Verify**
   - Status should show: ✅ **Active**
   - SMS Provider: **Twilio**

---

## ✅ How to Verify It's Working

After saving:

1. **In Supabase Dashboard**
   - Status shows "SMS Provider: Twilio (Active)"
   - No error messages

2. **Test Registration**
   ```
   URL: https://www.snippr.in/register
   Or: http://localhost:5174/register (local dev)
   
   1. Enter phone number (Indian format)
   2. Complete registration form
   3. Should receive SMS with OTP
   4. Enter OTP to verify
   5. Complete profile
   ```

3. **Monitor Logs** (if SMS doesn't arrive)
   - Go: **Authentication → Logs**
   - Look for your phone number
   - Check for error messages

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| SMS not received | Check Supabase logs for error messages |
| "Invalid credentials" | Copy-paste credentials exactly from above |
| Twilio not in dropdown | Refresh page or logout/login to Supabase |
| Configuration won't save | Check all 3 fields are filled |

---

## 📱 Testing with Your Phone

Once configured, registration flow:
1. Go to https://www.snippr.in/register (production)
2. Enter your phone number
3. Should receive SMS within 30 seconds
4. Enter the 6-digit code
5. Complete gender selection
6. Done! Account created

---

## 💾 Backup

Save these credentials somewhere safe (1Password, LastPass, or secure notes):
- Account SID: [YOUR_ACCOUNT_SID]
- Auth Token: [YOUR_AUTH_TOKEN]
- Twilio Phone: [YOUR_TWILIO_PHONE]

This is the ONLY backup location if you need to reconfigure.

---

**Status:** All code is deployed ✅  
**Waiting for:** Supabase configuration ⏳  
**Time to complete:** ~2 minutes  
**Difficulty:** ⭐ (Very Easy)
