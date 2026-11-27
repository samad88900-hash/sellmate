/* SellMate Help Assistant — free, offline knowledge base.
   No API key, no external calls. Answers are written for sellers in Roman Urdu + English. */
(function () {
  "use strict";

  window.SELLMATE_HELP_KB = [
    {
      id: "login",
      keys: ["login", "log in", "sign in", "email password", "password se login", "login nahi"],
      q: "Log in kaise karun?",
      a: "Auth screen par 'Log in' tab rakho. Apna email aur password daalo aur 'Log in' dabao. Password bhool gaye ho to 'Forgot password?' se reset link mil jayega.",
      view: "login"
    },
    {
      id: "signup",
      keys: ["signup", "sign up", "account banayein", "new account", "create account", "register"],
      q: "Naya account kaise banayein?",
      a: "'Create account' tab kholo. Shop name, email aur 6+ characters ka password daalo. Email confirm ho gaya to app me wapas aakar login kar lo.",
      view: "signup"
    },
    {
      id: "forgot",
      keys: ["forgot", "reset password", "password bhool", "reset link", "password reset"],
      q: "Password reset kaise karein?",
      a: "Login screen par apna email daalo, phir 'Forgot password?' dabao. Email me reset link aayega. Link kholo, naya password do baar daalo — purana password zarurat nahi.",
      view: "login"
    },
    {
      id: "change-password",
      keys: ["change password", "password change", "new password", "purana password"],
      q: "Password kahan se badalun?",
      a: "Sidebar ke niche apne account card me 'Change password' hai. Current password aur naya password daal kar update kar do.",
      action: "changePassword"
    },
    {
      id: "otp",
      keys: ["otp", "code", "sms", "phone login", "number code", "6 digit", "text nahi aya", "sms nahi"],
      q: "Phone OTP code nahi aya?",
      a: "Pakistan number 03001234567 format me daalo. App use +923001234567 bana deti hai. Code 30–60 second me SMS se aata hai. 'Send code again' dabao. SMS free line se bheja jata hai, isliye sender dost ka number dikhega.",
      view: "login"
    },
    {
      id: "otp-typo",
      keys: ["o instead of 0", "letter o", "number me letters", "invalid number", "galat number"],
      q: "Number me error aa raha hai?",
      a: "Sirf digits use karo. Letter 'O' nahi — zero '0' likho. Example: 03100371974. App letters block kar deti hai.",
      view: "login"
    },
    {
      id: "google",
      keys: ["google", "google login", "google sign in", "brand verification"],
      q: "Google se login kab chalega?",
      a: "Google sign-in filhal testing mode me hai. Public launch ke liye custom domain aur Google brand verification pending hai. Abhi email/password ya phone OTP use karo.",
      view: "login"
    },
    {
      id: "shop-name",
      keys: ["shop name", "store name", "naam badal", "business name"],
      q: "Shop name kaise badalun?",
      a: "More → Shop settings → 'Shop name' field me naya naam likho aur field se bahar click karo. Naam turant save ho jayega.",
      view: "more"
    },
    {
      id: "add-product",
      keys: ["product", "item add", "catalogue", "sku", "stock add", "naya product"],
      q: "Product kaise add karun?",
      a: "Products view → 'Add a product' form. SKU, name, sale price, cost price aur stock daalo. 'Save product' dabao. Low-stock alert bhi set kar sakte ho.",
      view: "products"
    },
    {
      id: "edit-product",
      keys: ["edit product", "product change", "price update", "stock update", "product delete"],
      q: "Product edit ya stock update?",
      a: "Products list me har row ke paas Edit aur stock + / Set buttons hain. Price badalne ke liye Edit, stock badalne ke liye + ya Set use karo.",
      view: "products"
    },
    {
      id: "low-stock",
      keys: ["low stock", "stock alert", "stock kam", "available", "reserved"],
      q: "Low stock kaise dekhein?",
      a: "Home screen par 'Stock watch' panel dikhta hai. Order Confirmed/Packed hone par items reserve ho jate hain; Dispatched hone par stock actual kam hota hai.",
      view: "home"
    },
    {
      id: "new-order",
      keys: ["order", "new order", "order banayein", "sale", "bill banayein"],
      q: "Order kaise banayein?",
      a: "Orders view → 'New order'. Customer name/phone likho, item add karo, paid amount daalo aur 'Save order' dabao. Har order ko apna code milta hai.",
      view: "orders"
    },
    {
      id: "order-status",
      keys: ["status", "dispatch", "delivered", "cancel order", "return", "tracking"],
      q: "Order status kaise change karein?",
      a: "Orders list me har row ke paas status dropdown hai. New → Confirmed → Packed → Dispatched → Delivered. Dispatched par stock kam hota hai; cancel/return par wapas.",
      view: "orders"
    },
    {
      id: "payment",
      keys: ["payment", "due", "pending", "advance", "paid", "balance", "hisab", "bakaya"],
      q: "Payment / due kaise track karein?",
      a: "Order row par 'Payment' dabao. Amount, method aur note daal kar Add karo. Due, Advance aur Paid tags har order par dikhte hain. Home par 'Pending payments' bhi hai.",
      view: "orders"
    },
    {
      id: "invoice",
      keys: ["invoice", "bill", "print", "pdf", "slip", "receipt", "printable"],
      q: "Invoice ya PDF kaise nikalein?",
      a: "Orders view me us order ke paas 'Invoice' dabao. Nayi window me clean invoice khulegi — 'Print / Save PDF' se PDF save kar sakte ho ya 'Copy text' se text copy kar lo.",
      view: "orders"
    },
    {
      id: "repeat-order",
      keys: ["repeat", "same order", "dobar order", "copy order"],
      q: "Purana order dobara kaise banayein?",
      a: "Order row par 'Repeat' dabao. Customer aur items purane order se aa jayenge, phir required change karke save kar do.",
      view: "orders"
    },
    {
      id: "customer",
      keys: ["customer", "customer add", "ledger", "statement", "khata"],
      q: "Customer aur khata kaise dekhein?",
      a: "Customers view me customer add/edit kar sakte ho. Kisi customer ke khate ke liye row par 'Ledger' kholo — usme orders, payments aur running balance dikhta hai.",
      view: "customers"
    },
    {
      id: "supplier",
      keys: ["supplier", "bill", "payable", "supplier khata", "wholesale"],
      q: "Supplier ka bill/payment kaise record karein?",
      a: "More → Suppliers. Supplier add karo, phir uske ledger me 'Add bill' ya 'Record payment' dabao. 'Payable' amount wahin dikhta hai.",
      view: "more"
    },
    {
      id: "expense",
      keys: ["expense", "kharcha", "cost", "rent", "packaging"],
      q: "Expense kaise add karein?",
      a: "More → Expenses. Naam, amount aur category daalo. Monthly summary me ye expenses profit se subtract hote hain.",
      view: "more"
    },
    {
      id: "backup",
      keys: ["backup", "download", "save data", "export backup", "json"],
      q: "Backup kaise download karein?",
      a: "Upar right me download icon (⇩) ya More → Shop settings → 'Restore backup' ke paas backup option. Pure data JSON file me download hota hai.",
      action: "backup"
    },
    {
      id: "restore",
      keys: ["restore", "import", "backup wapas", "recover data"],
      q: "Backup wapas kaise restore karein?",
      a: "More → Shop settings → 'Restore backup' dabao, apni SellMate JSON file select karo. Confirm karte hi current data backup se replace ho jayega.",
      view: "more"
    },
    {
      id: "reset",
      keys: ["reset", "clear data", "workspace reset", "sab mitayein"],
      q: "Workspace reset kya karta hai?",
      a: "More → Shop settings → 'Reset workspace'. Is se is account ka saara cloud data clear ho jata hai. Pehle backup download kar lena zarurat se.",
      view: "more"
    },
    {
      id: "delete-account",
      keys: ["delete account", "account delete", "data delete", "account khatam"],
      q: "Account kaise delete karein?",
      a: "Sidebar account card me 'Delete account' dabao. Confirm ke baad account, workspaces aur profiles sab delete ho jate hain. Ye wapas nahi aata.",
      action: "deleteAccount"
    },
    {
      id: "csv",
      keys: ["csv", "excel", "export", "accounting", "tax"],
      q: "CSV export kahan hai?",
      a: "More → CSV export. Orders, Payments, Customers, Products aur Suppliers ki alag-alag CSV files milti hain.",
      view: "more"
    },
    {
      id: "profit",
      keys: ["profit", "monthly", "summary", "sales report", "top sellers", "hisab kitab"],
      q: "Monthly profit kaise dekhein?",
      a: "More → reports me 'Top sellers & monthly summary'. Month choose karke 'Generate' dabao — sales, cost, expenses, net profit aur top items dikhenge.",
      view: "more"
    },
    {
      id: "chat-studio",
      keys: ["chat studio", "draft", "whatsapp reply", "instagram dm", "message template"],
      q: "Chat Studio kya hai?",
      a: "Chat Studio me order ke hisaab se ready-made drafts milte hain: availability, quote, confirm, reminder, dispatch, delivered. Copy karke WhatsApp/Instagram par paste karo.",
      view: "chat"
    },
    {
      id: "theme",
      keys: ["theme", "dark", "light", "color", "screen dark"],
      q: "Dark mode kaise on karein?",
      a: "Upar right me aadha chand jaisa icon (◐) dabao. App default light mode me khulti hai; dark mode tumhari pasand ke sath save ho jata hai.",
      action: "theme"
    },
    {
      id: "offline",
      keys: ["offline", "internet", "cache", "slow", "load nahi"],
      q: "App offline chal sakti hai?",
      a: "Interface offline cache se khul jata hai, par data cloud me save hota hai. Save ke liye internet zaruri hai. 'Cloud save failed' aaye to connection check karo.",
      view: "home"
    },
    {
      id: "mobile",
      keys: ["mobile nav", "bottom nav", "menu", "sidebar"],
      q: "Mobile par navigation kahan hai?",
      a: "Mobile par niche bottom nav hai: Home, Products, Orders, Customers, Chat. Upar ☰ se bhi sidebar khul jata hai.",
      view: "home"
    },
    {
      id: "support",
      keys: ["support", "help", "contact", "email", "issue", "problem"],
      q: "Aur madad chahiye?",
      a: "Agar ye jawab kaam na aaye to samad88900@gmail.com par email kar do. Issue ka step naam aur screen bhej dena to jaldi fix ho jayega.",
      action: "support"
    }
  ];

  window.SELLMATE_HELP_CHIPS = [
    "Invoice kaise nikalein?",
    "OTP code nahi aya",
    "Backup kaise download?",
    "Payment due kaise dekhein?",
    "Account delete"
  ];
})();
