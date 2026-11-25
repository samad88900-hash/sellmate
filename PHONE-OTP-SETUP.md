# SellMate — Phone OTP login (Pakistan, free tier)

Phone login is already built into the app (**Continue with phone** button). It uses Supabase Auth for the code and **textbee Free** to deliver the SMS from your own paired Android phone, so no Twilio bill is needed.

## Cost
- Supabase Free: Send SMS hook is available on the Free plan.
- textbee Free: 300 SMS/month, 50/day (at the time of writing).
- Your own SIM's normal SMS rate applies. Pakistan numbers (`+92`) work because the message goes out from your paired phone.

## 1. textbee (your phone becomes the SMS sender)
1. Sign up at https://textbee.dev/ (free plan).
2. Install the textbee Android app on a phone with an active Pakistan SIM.
3. Pair that phone with your textbee account and keep it online + charging.
4. In the textbee dashboard, create an **API key** just for this project.

## 2. Supabase SQL (one time)
1. Open `supabase-sms-hook.sql` in this repo.
2. Replace `PASTE_TEXTBEE_API_KEY_HERE` with your textbee API key.
3. Paste the whole file into **Supabase Dashboard → SQL Editor → New query → Run**.

The SQL creates `public.sellmate_send_sms`, enables `pg_net`, and locks the function down so only Supabase Auth can call it. Your API key stays in the database function, not in this repo or the website.

## 3. Supabase Auth settings
1. **Authentication → Providers → Phone** → enable it.
   - Keep automatic phone confirmation **off**, so a code is actually sent.
2. **Authentication → Hooks → Add hook**
   - Hook: **Send SMS**
   - Type: **Postgres Function**
   - Function: `public.sellmate_send_sms`
   - Save.
3. Keep the default OTP rate limit (one code every 60 seconds) to avoid abuse.

## 4. Test
1. Open https://sellmate-draft.netlify.app and click **Continue with phone**.
2. Enter `03001234567` (or `+923001234567`) and press **Send code**.
3. The SMS arrives from your paired phone. Enter the 6-digit code and press **Verify & sign in**.
4. You get your own private cloud workspace, same as email/Google users.

## iPhone users
- Logging in from an iPhone is fully supported. The customer's phone can be Android or iPhone — only the SMS text is entered.
- The SMS is formatted for iPhone/Safari AutoFill: the last line is `@sellmate-draft.netlify.app #123456`, so Safari can suggest the code automatically in the OTP field.
- For the app as a home-screen icon on iPhone: open the site in **Safari** → **Share** → **Add to Home Screen**.
- The only Android requirement is the **sender/gateway** phone paired with textbee. An iPhone cannot be used as that sender; it can only receive the code.

## Limits and notes
- One phone sends roughly 10–15 SMS/minute. Add more phones in textbee for more volume.
- If the paired phone is offline, codes queue and may expire. Keep it online.
- No Twilio/MessageBird credentials are needed anywhere.
- If you later move to more than 300 SMS/month, textbee Pro is a flat paid plan; the app code does not change.
- Email/password and Google login keep working exactly as before.
