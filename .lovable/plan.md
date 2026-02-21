

# Integrating Resend for Email Sending

## Overview
Configure the Resend API key as a secure secret and implement an edge function to send personalized emails from the Communications module.

## Steps

### 1. Store the Resend API Key
- Save `RESEND_API_KEY` as a Supabase secret (never in code)

### 2. Create Edge Function `send-email`
- New file: `supabase/functions/send-email/index.ts`
- Receives: lead email, name, subject, HTML content
- Uses the Resend API (`https://api.resend.com/emails`) to dispatch the email
- Returns success/error status
- Includes proper CORS headers for browser calls
- JWT verification disabled in `config.toml`, validated in code

### 3. Update Communications Module
- Modify `src/pages/Comunicacoes.tsx` to call the edge function when the user clicks "Enviar"
- Flow remains manual: user composes the email, previews it, and clicks send -- the system dispatches via Resend
- Show success/error toast based on the response
- Update the `comunicacoes` table status to reflect actual send result

### 4. Update `supabase/config.toml`
- Add `[functions.send-email]` section with `verify_jwt = false`

---

## Technical Details

**Edge Function (`send-email/index.ts`)**:
- Reads `RESEND_API_KEY` from `Deno.env`
- POST to `https://api.resend.com/emails` with:
  - `from`: configured sender (e.g., `Vision AI <onboarding@resend.dev>` for testing, or your verified domain)
  - `to`: lead's email
  - `subject` and `html` from request body
- Validates auth via `getClaims()` to ensure only logged-in users can send

**Frontend changes**:
- Replace the direct Supabase insert in `handleEnviarEmail` with a call to `supabase.functions.invoke("send-email", { body: { ... } })`
- On success, insert the record into `comunicacoes` and update the lead's `email_enviado` flag (as it does today)

**Important**: The Resend free tier uses `onboarding@resend.dev` as the sender. To send from a custom domain, you'll need to verify a domain in the Resend dashboard.

