# SellMate — Play Store launch checklist

## Done locally
- [x] Core app: products, orders, expenses, chat studio, smart drafts, backup/restore
- [x] Multi-item orders with discount, delivery charge, source, address and notes
- [x] Payment history with partial payments, advances and per-customer balances
- [x] Customer records with Instagram handles and pending balances
- [x] Stock availability = physical stock − reserved in active orders
- [x] Stock deducted on dispatch, restored on return/cancellation
- [x] Edit orders, remove payments, cancel and return flows
- [x] Today-focused dashboard: orders, collections, pending balance, low availability, pipeline
- [x] Seven smart draft templates with Copy / WhatsApp / Instagram actions
- [x] Responsive layout with mobile bottom navigation
- [x] PWA manifest (`manifest.webmanifest`)
- [x] Maskable app icons (192 px and 512 px)
- [x] Service worker with offline app-shell cache (`sw.js`, cache `sellmate-v55`)
- [x] Light-first palette: cream base with forest and champagne accents (no charcoal/mint scheme); dark theme optional
- [x] Accessibility: skip link, main landmarks, labelled auth tabs and 44px help feedback targets
- [x] Paste-from-chat order builder (detects phone, customer and catalogue items for review)
- [x] Customer ledger / khata with running balance, payment recording and shareable statement
- [x] Day Book closing summary with WhatsApp-style copy text
- [x] One-tap repeat order from any customer or past order
- [x] Quick price-list share with availability filter and WhatsApp link
- [x] Restock list with suggested reorder quantities and supplier WhatsApp link
- [x] CSV export: orders, payments, customers, products and suppliers
- [x] Weekly backup reminder with Later / Download actions
- [x] Courier and tracking number on orders, included in dispatch drafts
- [x] Payment due dates and a Home follow-up queue (overdue first)
- [x] Reports & tools live inside the existing More view (no new nav item)
- [x] Editable quick replies with `{{placeholders}}`, saved per shop, plus Reset defaults
- [x] Paste a buyer message in Chat → closest ready reply with order details filled in
- [x] Supplier khata: bills, payments, running balance, statement copy/WhatsApp, CSV export
- [x] Bulk follow-up: select due customers in Home and open their WhatsApp reminders together
- [x] Top sellers and monthly summary (sales, costs, expenses by category, collections, profit)
- [x] Expense categories with category breakdown in Day Book and monthly summary
- [x] SKU / product code on products, edit form, product list and CSV export
- [x] Date-range filter on Orders with one-tap Clear dates
- [x] Email/password and phone OTP sign-in, each opening a private cloud workspace
- [x] Zero browser console errors in local end-to-end testing
- [x] Local test server: `http://localhost:8123` (no internet deploy)

## Build route chosen
PWA-first. When the user approves hosting:
1. Deploy these static files to Netlify.
2. Use PWABuilder to generate a signed Android App Bundle (AAB).
3. Upload the AAB to Google Play Console.

This avoids installing Java and Android Studio on this computer.

## Pending before upload
- [ ] Confirm final store title: **SellMate: Seller Workspace** (26 characters)
- [ ] Confirm package name: **com.abdulsamad.sellmate** (hard to change after publishing)
- [ ] Create Google Play Developer account (one-time $25 fee)
- [ ] Confirm the contact email in `privacy.html` and `terms.html`; both pages exist and are live (Netlify rewrites `/privacy` and `/terms`)
- [ ] Add `/.well-known/assetlinks.json` with the signing key SHA-256 fingerprint
- [ ] Capture phone screenshots (at least 2, usually 4–8)
- [ ] Complete Play Store listing: short description, full description, category, data-safety form
- [ ] Keep the signing keystore safe — losing it prevents future updates
- [ ] Test the generated app on a real Android phone
- [ ] Keep Google sign-in private until the custom domain and brand verification are done; email/password and phone OTP are the public options for now

## Monetization goal (later, after the app is genuinely useful)
- User wants SellMate to eventually make money.
- Do not let monetization shape the core build yet; first make it excellent for retailers.
- Options to evaluate later: free cloud tier + Pro extras, one-time shop license, or subscription with a small backend.
- Any payments/subscriptions will need a backend and store billing rules; plan this after the local app is finished.

## Notes
- Business data (orders, customer names/numbers, notes, etc.) lives in a per-account Supabase cloud workspace protected by Row Level Security (RLS), not only in browser localStorage. The browser may cache the app shell for offline loading.
- WhatsApp buttons open `wa.me` links; no messages are sent automatically.
- AI drafts are generated offline; no API key is used yet.
- Future: OpenAI key (added locally only), Meta WhatsApp Cloud API, Android-native polish.
