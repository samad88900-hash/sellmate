# SellMate — Phone OTP login (Pakistan, free tier)

Phone login is already built into the app (**Continue with phone** button). It uses Supabase Auth for the code and **textbee Free** to deliver the SMS from your own paired Android phone, so no Twilio bill is needed.

## Cost
- Supabase Free: Send SMS hook is available on the Free plan.
- textbee Free: 300 SMS/month, 50/day (at the time of writing).
- Your own SIM's normal SMS rate applies. Pakistan numbers (`+92`) work because the message goes out from your paired phone.

## 1. textbee (your phone becomes the SMS sender)
1. Sign up at https://textbee.dev/ (free plan).
2. On the Android phone, open **https://textbee.dev/download** and install the official **APK**.  
   - The official textbee app is **not on Google Play**.  
   - Ignore Play Store apps named **“TextBee: Send SMS Bangladesh”** or **“TextBee – Ad Powered SMS”** (`com.amatullah.textbee`) — they are unrelated ad-based apps and will not connect to your textbee dashboard.  
   - If Play Protect warns “App not scanned”, tap **More details → Install anyway** only when the APK came from `textbee.dev` or `github.com/textbee/textbee/releases`.
3. Open the app and scan the QR code shown by **Add device** in your textbee dashboard. Use a phone with an active Pakistan SIM.
4. In the app, open **Settings → Device Health** and make sure every row is green (SMS permissions, notifications, battery usage Unrestricted, sticky notification On, battery saver Off). Keep the phone online + charging.
5. In the textbee dashboard, create an **API key** just for this project.

## 2. Supabase SQL (one time)
1. Open `supabase-sms-hook.sql` in this repo.
2. Replace `PASTE_TEXTBEE_API_KEY_HERE` with your textbee API key.
3. Paste the whole file into **Supabase Dashboard → SQL Editor → New query → Run**.

The SQL creates `public.sellmate_send_sms`, enables `pg_net`, and locks the function down so only Supabase Auth can call it. Your API key stays in the database function, not in this repo or the website.

## 3. Supabase Auth settings
1. **Authentication → Providers → Phone** → enable it.
   - Keep automatic phone confirmation **off**, so a code is actually sent.
   - The dashboard may show Twilio by default and still require its fields even with a Send SMS hook. In that case, first **disable the hook**, enter dummy-but-format-valid values (Account SID `AC` + 32 chars, Auth Token any string, Message Service SID `MG` + 32 chars), enable Phone and **Save**, then re-enable the hook. No real Twilio account is needed; the hook bypasses it at runtime.
2. **Authentication → Hooks → Add hook**
   - Hook: **Send SMS**
   - Type: **Postgres Function**
   - Function: `public.sellmate_send_sms`
   - Save / enable the hook toggle.
3. Keep the default OTP rate limit (one code every 60 seconds) to avoid abuse.

## 4. Test
1. Open https://sellmate-draft.netlify.app and click **Continue with phone**.
2. Enter `03001234567` (or `+923001234567`) and press **Send code**.
3. The SMS arrives from your paired phone. Enter the 6-digit code and press **Verify & sign in**.
4. You get your own private cloud workspace, same as email/Google users.

## iPhone users
- Logging in from an iPhone is fully supported. The customer's phone can be Android or iPhone — only the SMS text is entered.
- The SMS is kept short and plain (`SellMate code: 123456. Do not share this code.`) so carriers are less likely to filter it as spam. Type the 6 digits into the OTP field manually.
- For the app as a home-screen icon on iPhone: open the site in **Safari** → **Share** → **Add to Home Screen**.
- The only Android requirement is the **sender/gateway** phone paired with textbee. An iPhone cannot be used as that sender; it can only receive the code.

## Limits and notes
- One phone sends roughly 10–15 SMS/minute. Add more phones in textbee for more volume.
- If the paired phone is offline, codes queue and may expire. Keep it online.
- No Twilio/MessageBird credentials are needed anywhere.
- If you later move to more than 300 SMS/month, textbee Pro is a flat paid plan; the app code does not change.
- Email/password and Google login keep working exactly as before.
