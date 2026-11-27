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

  /* English-only knowledge base. Same ids/actions as Roman Urdu, all text in English. */
  window.SELLMATE_HELP_KB_EN = [
    {
      id: "login",
      keys: ["login", "log in", "sign in", "email password", "forgot password", "access account"],
      q: "How do I log in?",
      a: "Keep the Log in tab selected. Enter your email and password, then tap Log in. If you forgot your password, use Forgot password? to get a reset link.",
      view: "login"
    },
    {
      id: "signup",
      keys: ["signup", "sign up", "new account", "create account", "register"],
      q: "How do I create a new account?",
      a: "Open the Create account tab. Enter a shop name, email, and a password with at least 6 characters. After email confirmation, return to the app and log in.",
      view: "signup"
    },
    {
      id: "forgot",
      keys: ["forgot", "reset password", "forgot password", "reset link", "lost password"],
      q: "How do I reset my password?",
      a: "Enter your email on the sign-in screen, then tap Forgot password?. You will receive a reset link by email. Open it and set a new password — your old password is not needed.",
      view: "login"
    },
    {
      id: "change-password",
      keys: ["change password", "new password", "current password", "update password"],
      q: "Where can I change my password?",
      a: "At the bottom of the sidebar, open your account card and tap Change password. Enter your current password and the new password.",
      action: "changePassword"
    },
    {
      id: "otp",
      keys: ["otp", "code", "sms", "phone login", "6 digit", "text not received", "no sms"],
      q: "I did not receive the OTP code",
      a: "Enter your Pakistan number as 03001234567. The app converts it to +923001234567. The 6-digit code arrives by SMS in 30–60 seconds. Tap Send code again if needed. The free SMS route sends from a paired phone, so the sender may appear as a personal number.",
      view: "login"
    },
    {
      id: "otp-typo",
      keys: ["invalid number", "letter o", "digits only", "wrong number", "number error"],
      q: "Why is my phone number rejected?",
      a: "Use digits only. Type zero (0), not the letter O. Example: 03100371974. The app blocks letters.",
      view: "login"
    },
    {
      id: "google",
      keys: ["google", "google login", "google sign in", "brand verification"],
      q: "When will Google sign-in be available?",
      a: "Google sign-in is currently in testing mode. Public launch requires a custom domain and Google brand verification. For now, use email/password or phone OTP.",
      view: "login"
    },
    {
      id: "shop-name",
      keys: ["shop name", "store name", "change name", "business name"],
      q: "How do I change the shop name?",
      a: "Go to More → Shop settings and edit the Shop name field. Click outside the field to save. The name updates everywhere.",
      view: "more"
    },
    {
      id: "add-product",
      keys: ["product", "item", "catalogue", "sku", "add product", "stock"],
      q: "How do I add a product?",
      a: "Open Products and use the Add a product form. Enter SKU, name, sale price, cost price, and stock, then tap Save product. You can also set a low-stock alert.",
      view: "products"
    },
    {
      id: "edit-product",
      keys: ["edit product", "price update", "stock update", "delete product"],
      q: "How do I edit a product or stock?",
      a: "In the product list, each row has Edit and stock + / Set buttons. Use Edit to change prices and + or Set to update stock.",
      view: "products"
    },
    {
      id: "low-stock",
      keys: ["low stock", "stock alert", "available", "reserved", "stock watch"],
      q: "How do I check low stock?",
      a: "The Stock watch panel on Home shows low stock. Items are reserved when an order is Confirmed or Packed, and stock is deducted when it is Dispatched.",
      view: "home"
    },
    {
      id: "new-order",
      keys: ["order", "new order", "sale", "create order", "bill"],
      q: "How do I create an order?",
      a: "Open Orders and tap New order. Enter the customer name and phone, add items, enter the paid amount, then tap Save order. Every order gets its own code.",
      view: "orders"
    },
    {
      id: "order-status",
      keys: ["status", "dispatch", "delivered", "cancel order", "return", "tracking"],
      q: "How do I change an order status?",
      a: "Each order row has a status dropdown: New → Confirmed → Packed → Dispatched → Delivered. Stock is deducted on Dispatched and restored on cancel or return.",
      view: "orders"
    },
    {
      id: "payment",
      keys: ["payment", "due", "pending", "advance", "paid", "balance", "outstanding"],
      q: "How do I track payments and dues?",
      a: "Tap Payment on an order row. Add the amount, method, and a note. Due, Advance, and Paid tags appear on every order. Pending payments are also on Home.",
      view: "orders"
    },
    {
      id: "invoice",
      keys: ["invoice", "bill", "print", "pdf", "slip", "receipt", "printable"],
      q: "How do I print an invoice?",
      a: "In Orders, tap Invoice on the order. A clean invoice opens in a new tab — use Print / Save PDF or Copy text.",
      view: "orders"
    },
    {
      id: "repeat-order",
      keys: ["repeat", "same order", "copy order", "reorder"],
      q: "How do I repeat an old order?",
      a: "Tap Repeat on an order row. The customer and items are copied from the old order. Make any changes and save.",
      view: "orders"
    },
    {
      id: "customer",
      keys: ["customer", "ledger", "statement", "customer history"],
      q: "How do I manage customers and ledgers?",
      a: "Add or edit customers in the Customers view. Tap Ledger on a row to see that customer's orders, payments, and running balance.",
      view: "customers"
    },
    {
      id: "supplier",
      keys: ["supplier", "payable", "wholesale", "supplier bill", "supplier payment"],
      q: "How do I record supplier bills?",
      a: "Go to More → Suppliers. Add a supplier, then open its ledger and tap Add bill or Record payment. The payable amount appears there.",
      view: "more"
    },
    {
      id: "expense",
      keys: ["expense", "cost", "rent", "packaging", "spend"],
      q: "How do I add an expense?",
      a: "Go to More → Expenses. Add a name, amount, and category. The monthly summary subtracts these expenses from profit.",
      view: "more"
    },
    {
      id: "backup",
      keys: ["backup", "download", "export", "json", "save data"],
      q: "How do I download a backup?",
      a: "Use the download icon (⇩) at the top right, or go to More → Shop settings near Restore backup. Your whole dataset downloads as a JSON file.",
      action: "backup"
    },
    {
      id: "restore",
      keys: ["restore", "import", "recover data", "upload backup"],
      q: "How do I restore a backup?",
      a: "Go to More → Shop settings → Restore backup. Select your SellMate JSON file. Confirming replaces the current data with the backup.",
      view: "more"
    },
    {
      id: "reset",
      keys: ["reset", "clear data", "workspace reset", "erase data"],
      q: "What does Reset workspace do?",
      a: "Go to More → Shop settings → Reset workspace. This clears all cloud data for this account. Download a backup first.",
      view: "more"
    },
    {
      id: "delete-account",
      keys: ["delete account", "account delete", "remove account", "close account"],
      q: "How do I delete my account?",
      a: "In the sidebar account card, tap Delete account. After confirmation, the account, workspaces, and profile are permanently deleted.",
      action: "deleteAccount"
    },
    {
      id: "csv",
      keys: ["csv", "excel", "export", "accounting", "tax"],
      q: "Where is CSV export?",
      a: "Go to More → CSV export. You get separate CSV files for Orders, Payments, Customers, Products, and Suppliers.",
      view: "more"
    },
    {
      id: "profit",
      keys: ["profit", "monthly", "summary", "sales report", "top sellers"],
      q: "How do I see monthly profit?",
      a: "Go to More → Top sellers & monthly summary. Choose a month and tap Generate to see sales, cost, expenses, net profit, and top items.",
      view: "more"
    },
    {
      id: "chat-studio",
      keys: ["chat studio", "draft", "whatsapp reply", "instagram dm", "message template"],
      q: "What is Chat Studio?",
      a: "Chat Studio has ready-made drafts based on your orders: availability, quote, confirm, reminder, dispatch, and delivered. Copy and paste them into WhatsApp or Instagram.",
      view: "chat"
    },
    {
      id: "theme",
      keys: ["theme", "dark", "light", "color", "dark mode"],
      q: "How do I turn on dark mode?",
      a: "Tap the half-moon icon (◐) at the top right. The app always opens in light mode; dark mode is saved only if you choose it.",
      action: "theme"
    },
    {
      id: "offline",
      keys: ["offline", "internet", "cache", "slow", "cloud save failed"],
      q: "Does the app work offline?",
      a: "The interface opens from the offline cache, but data is saved in the cloud. Internet is needed to save. If Cloud save failed appears, check your connection.",
      view: "home"
    },
    {
      id: "mobile",
      keys: ["mobile", "bottom nav", "menu", "sidebar", "navigation"],
      q: "Where is navigation on mobile?",
      a: "On mobile, use the bottom nav: Home, Products, Orders, Customers, and Chat. The ☰ button also opens the sidebar.",
      view: "home"
    },
    {
      id: "support",
      keys: ["support", "help", "contact", "email", "issue", "problem"],
      q: "I still need help",
      a: "If this answer did not help, email samad88900@gmail.com. Include the screen name and the steps that caused the issue.",
      action: "support"
    }
  ];

  window.SELLMATE_HELP_CHIPS_EN = [
    "How do I print an invoice?",
    "OTP code not received",
    "How do I download a backup?",
    "How do I see payment due?",
    "Delete my account"
  ];
})();
