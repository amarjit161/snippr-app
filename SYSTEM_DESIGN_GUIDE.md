# Snippr System Design Guide

This document is the current system design for Snippr and the step-by-step guide for how a real user moves through the product.

## 1. Product Goal

Snippr helps customers find salons, sign in securely, book appointments, manage bookings, and receive status updates. Salon owners manage salons, services, queues, staff, and customer-facing updates from the same backend.

## 2. Current Architecture

- Frontend: React + Vite + TypeScript
- UI system: Tailwind CSS + shadcn/ui components
- Routing: React Router with protected customer and owner areas
- Data layer: Supabase Auth, Supabase Postgres, Supabase Storage, Supabase Edge Functions
- Async data: TanStack Query
- Notifications: Email flow via `send-email` edge function, phone OTP flow via phone.email integration
- Error handling: Error boundary, offline banner, and page loaders

## 3. Core Modules

### Customer side

- Login and registration
- Salon listing and salon detail pages
- Booking flow
- Booking history and profile management
- OTP and profile completion flows when needed

### Owner side

- Owner login and signup
- Salon registration and onboarding
- Dashboard, queue, services, team, settings, and salon profile
- Owner-only route protection

### Shared backend services

- Supabase Auth for identity
- `customer_profiles` and `owners` tables for role-specific profile data
- Booking and queue tables for salon operations
- Notification table for email audit history
- Edge functions for email delivery and verification workflows

## 4. Main User Flow

### Step 1: Landing

The user opens the home page and sees the platform entry point.

### Step 2: Authentication

The user chooses one of the supported auth paths:

- Email login
- Phone OTP login
- Google SSO
- Registration for new customers

### Step 3: Profile readiness

If the user is missing required profile data, the app prompts for completion instead of blocking the whole product.

- New customer profiles can be auto-created on first sign-in
- Missing phone numbers can be collected later through the verification modal
- Owners are loaded separately through the owner profile flow

### Step 4: Discover salons

After auth, customers land on the salon discovery experience and can browse salons, services, and available booking slots.

### Step 5: Booking

The customer selects a salon, service, date, time, and contact details, then confirms the booking.

### Step 6: Notifications

Successful booking, cancellation, and reschedule events trigger email notifications to the customer and, where needed, the owner.

### Step 7: Booking management

The user can view bookings, cancel, reschedule, and keep profile information up to date.

## 5. Owner Flow

### Step 1: Owner access

Owners sign in through the owner routes and are sent through owner-specific protection.

### Step 2: Salon setup

Owners register or edit salon details, services, team members, and settings.

### Step 3: Live operations

Owners manage queue status, bookings, closures, and customer communication from the dashboard.

### Step 4: Operational notifications

Owner actions can trigger customer notifications for closures, cancellations, and reschedules.

## 6. Data Flow

1. The browser loads the app.
2. Auth state is restored from Supabase.
3. The app checks whether the user is a customer or owner.
4. The appropriate profile and route guard is loaded.
5. Booking or profile actions write to Supabase tables.
6. Important actions trigger edge functions for email or verification.
7. The UI updates from the resulting database state.

## 7. Real User Checklist

Use this when checking whether the app is ready for actual users.

- Can a new customer sign up without manual intervention?
- Can a returning customer log in with the intended auth method?
- Does Google SSO create a usable profile automatically?
- Can a customer complete a booking on mobile?
- Are booking success and failure messages clear?
- Do cancellation and reschedule actions send notifications?
- Does the booking history page match the stored data?
- Can an owner sign in and reach owner-only pages?
- Does owner profile data load reliably after refresh?
- Are protected routes blocking unauthorized access correctly?
- Do error states show a helpful recovery path?
- Is the app usable on slower networks and smaller screens?

## 8. Production Readiness Checks

- Confirm Supabase Auth providers are enabled
- Confirm edge function secrets are set
- Confirm required environment variables are present
- Confirm database migrations are applied
- Confirm RLS policies match the intended data access
- Confirm booking, cancellation, and reschedule flows work end to end
- Confirm the UI handles loading, offline, and error states
- Confirm email and OTP delivery works with real accounts
- Confirm owner and customer roles cannot cross protected boundaries

## 9. Android App Alignment

If you build a native Android app later, keep the same backend rules.

- Reuse the same Supabase project
- Reuse the same auth and role model
- Reuse booking, queue, profile, and notification tables
- Keep business logic in backend services and edge functions where possible
- Treat the Android app as another client, not a separate system

## 10. Recommended Next Step

For the next implementation pass, focus on one path at a time:

1. Customer login and profile readiness
2. Booking flow and notification reliability
3. Owner dashboard and queue operations
4. Production hardening and monitoring