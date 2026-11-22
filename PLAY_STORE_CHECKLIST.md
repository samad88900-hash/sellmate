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
- [x] Service worker with offline app-shell cache (`sw.js`, cache v9)
- [x] Minimal touch-first theme: charcoal + single mint accent, both dark and light
- [x] Paste-from-chat order builder (detects phone, customer and catalogue items for review)
- [x] Customer ledger / khata with running balance, payment recording and shareable statement
- [x] Day Book closing summary with WhatsApp-style copy text
- [x] One-tap repeat order from any customer or past order
- [x] Quick price-list share with availability filter and WhatsApp link
- [x] Restock list with suggested reorder quantities and supplier WhatsApp link
- [x] CSV export: orders, payments, customers and products
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
- [ ] Add real contact email and publish a privacy policy page
- [ ] Add `/.well-known/assetlinks.json` with the signing key SHA-256 fingerprint
- [ ] Capture phone screenshots (at least 2, usually 4–8)
- [ ] Complete Play Store listing: short description, full description, category, data-safety form
- [ ] Keep the signing keystore safe — losing it prevents future updates
- [ ] Test the generated app on a real Android phone

## Monetization goal (later, after the app is genuinely useful)
- User wants SellMate to eventually make money.
- Do not let monetization shape the core build yet; first make it excellent for retailers.
- Options to evaluate later: free local-first tier + Pro cloud sync/backups, one-time shop license, or subscription with a small backend.
- Any payments/subscriptions will need a backend and store billing rules; plan this after the local app is finished.

## Notes
- SellMate stores orders, customer names/numbers and notes in browser localStorage on the device.
- WhatsApp buttons open `wa.me` links; no messages are sent automatically.
- AI drafts are generated offline; no API key is used yet.
- Future: OpenAI key (added locally only), Meta WhatsApp Cloud API, Android-native polish.
