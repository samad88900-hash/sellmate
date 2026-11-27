# SellMate — Google sign-in setup

Google login code is ready in the app. To make it work, Google OAuth credentials must be connected to Supabase.

> **Status: not publicly launched.** Credentials and branding are still pending, and public launch is blocked until a custom domain is connected and Google brand verification is complete. Keep this to testing only; do not present Google sign-in as available to users. Email/password and phone OTP are the sign-in options for now.

> Never put the Google **Client secret** in this repo or in `supabase-config.js`. It belongs only in the Supabase dashboard.

## 1. Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Create or select a project.
3. **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - App name: `SellMate`
   - User support email: your email
   - Developer email: your email
   - Add your own email as a **Test user** while testing.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `SellMate Web`
5. **Authorized JavaScript origins** — add:
   ```text
   https://sellmate-draft.netlify.app
   http://localhost:5500
   ```
6. **Authorized redirect URIs** — add:
   ```text
   https://dklxzmaifcffzmaiiilo.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client secret**.

## 2. Supabase Dashboard

1. Open the project: `dklxzmaifcffzmaiiilo`
2. **Authentication → Providers → Google**
3. Enable Google provider.
4. Paste:
   - **Client ID** from Google
   - **Client secret** from Google
5. Save.
6. **Authentication → URL Configuration** — confirm these are present:
   ```text
   Site URL: https://sellmate-draft.netlify.app
   Redirect URLs:
   https://sellmate-draft.netlify.app
   https://sellmate-draft.netlify.app/?type=recovery
   http://localhost:5500
   ```

## 3. Test (internal only — not a public launch)

1. Open https://sellmate-draft.netlify.app
2. Click **Continue with Google**.
3. Approve the consent screen.
4. You should land back in SellMate with your own cloud workspace.

## Notes

- A custom domain plus Google **brand verification** must be completed before this can be offered publicly; also add the domain to Google **Authorized JavaScript origins** and Supabase **Redirect URLs**.
- Email/password login and password reset are independent of Google and keep working.
- Each Google account gets its own private workspace via Supabase RLS.
