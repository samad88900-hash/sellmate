/* ============================================================
   SellMate v3 — cloud accounts (Supabase) + existing workspace
   Plain JavaScript · no build step
   ============================================================ */

(function () {
  "use strict";

  const STORE = "sellmate.v2"; // legacy local key (not used for cloud mode)
  const THEME_KEY = "sellmate-theme";
  const APP_VIEWS = ["home", "products", "orders", "customers", "chat", "more"];
  const STATUSES = ["New", "Confirmed", "Packed", "Dispatched", "Delivered", "Returned", "Cancelled"];
  const PRE_DISPATCH = ["New", "Confirmed", "Packed"];
  const STOCK_CONSUMING = ["Dispatched", "Delivered"];
  const METHODS = ["Cash", "Easypaisa", "JazzCash", "Bank transfer", "Other"];
  const SOURCES = ["WhatsApp", "Instagram", "Phone", "In person"];
  const EXPENSE_CATEGORIES = ["Packaging", "Transport", "Rent", "Utilities", "Supplies", "Other"];
  const REPLY_LABELS = {
    stock: "Availability", quote: "Price quote", confirm: "Confirmation",
    reminder: "Payment reminder", dispatch: "Dispatch update",
    delivered: "Delivered thanks", followup: "Follow-up"
  };

  const blank = () => ({
    products: [],
    customers: [],
    orders: [],
    expenses: [],
    suppliers: [],
    chats: {},
    settings: {
      shopName: "My Shop", theme: "light", language: "ur", nextCode: 1001,
      lastBackupAt: null, backupSnoozedAt: null, replies: {}
    }
  });

  let state = blank();
  let currentUser = null;
  let sb = null;
  let recoveryIntent = false;
  let recoveryNeedsOld = false;
  let suppressAuthHandling = false;
  let pendingPhone = null;
  let cloudReady = false;
  let lastAuthUserId = null;
  let workspaceLoaded = false;
  let workspaceChannel = null;
  let saveTimer = null;
  let saving = false;
  let queuedSave = false;
  let editingProduct = null;
  let editingOrder = null;
  let editingCustomer = null;
  let activePhone = null;
  let currentDraft = "";

  function uiText(ur, en) {
    return window.SellMateLang && window.SellMateLang.isEnglish() ? en : ur;
  }
  function friendlyError(error, fallback) {
    const msg = String((error && error.message) || error || "");
    if (!msg || /Cannot read properties|undefined|null|Invalid attempt|not a function/i.test(msg)) return fallback;
    return msg;
  }
  function clearDraft() {
    currentDraft = "";
    const box = document.getElementById("aiDraftBox");
    if (box) box.hidden = true;
    document.querySelectorAll("#templateBar .mini-btn").forEach((b) => b.classList.remove("active"));
  }
  function clearPriceList() {
    priceListText = "";
    const out = document.getElementById("priceOutput");
    if (out) out.textContent = "";
  }
  let paymentOpenId = null;
  let activeLedgerId = null;
  let parsedPaste = null;
  let selectedPriceIds = null;
  let dayBookText = "";
  let priceListText = "";
  let restockText = "";
  let insightsText = "";
  let activeSupplierId = null;
  let editingSupplier = null;
  let selectedFollowups = new Set();

/* ---------- Small helpers ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[c]);
  }

  function money(value) {
    return "PKR " + num(value).toLocaleString();
  }

  function cleanPhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function validPhone(value) {
    const raw = String(value || "").trim();
    if (/[A-Za-z]/.test(raw)) return false;
    const digits = cleanPhone(raw);
    if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15;
    return /^3\d{9}$/.test(digits) || (digits.length >= 8 && digits.length <= 15);
  }

  function dateField(id) {
    const value = String((document.getElementById(id) || {}).value || "");
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayISO();
  }

  function readThemePreference() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === "light" || saved === "dark" ? saved : null;
    } catch (_) { return null; }
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  }

  function todayISO(value) {
    const d = value instanceof Date ? value : new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function parseDate(iso) {
    if (!iso) return new Date(NaN);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return new Date(String(iso) + "T00:00:00");
    return new Date(iso);
  }

  function prettyDate(iso) {
    if (!iso) return "";
    const d = parseDate(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString();
  }

  function shortDate(iso) {
    if (!iso) return "—";
    const d = parseDate(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  }

  function daysSince(iso) {
    if (!iso) return Infinity;
    const diff = Date.now() - parseDate(iso).getTime();
    return Number.isFinite(diff) ? Math.floor(diff / 86400000) : Infinity;
  }

  function itemsSummary(order) {
    return (order.items || []).map((i) => num(i.qty) + " × " + i.name).join(", ");
  }

  function monthLabel(key) {
    const parts = String(key || "").split("-");
    return parts.length === 2 ? parts[1] + "/" + parts[0] : String(key || "");
  }

  function fillReply(template, ctx) {
    return String(template).replace(/\{\{(\w+)\}\}/g, (full, key) => (
      Object.prototype.hasOwnProperty.call(ctx, key) ? String(ctx[key]) : full
    ));
  }

  function replyContext(order, customer) {
    const balance = order ? orderBalance(order) : 0;
    const balanceLine = balance > 0
      ? "Pending balance is " + money(balance) + "."
      : (balance < 0 ? "You have an advance of " + money(Math.abs(balance)) + "." : "Payment is clear.");
    return {
      name: customer ? customer.name : (order ? order.customerName : "there"),
      items: order ? itemsSummary(order) : "your items",
      total: order ? money(orderTotal(order)) : "the agreed amount",
      paid: order ? money(orderPaid(order)) : money(0),
      balance: order ? money(balance) : money(0),
      balanceLine,
      code: order ? order.code : "",
      due: order && order.dueDate ? prettyDate(order.dueDate) : "—",
      courier: order && order.courier ? order.courier : "—",
      tracking: order && order.tracking ? order.tracking : "—",
      shop: state.settings.shopName || "My Shop"
    };
  }

  const MESSAGES_UR = {
    "Add your Supabase Project URL and anon key in supabase-config.js, then reload.": "Supabase URL aur anon key supabase-config.js me daalein, phir reload karein.",
    "Supabase library could not load. Check your internet connection.": "Supabase library load nahi hui. Internet connection check karein.",
    "Reset link is invalid or expired. Please request a new one.": "Reset link invalid ya expire ho gaya. Naya link mangayein.",
    "Enter your email first.": "Pehle email likhein.",
    "Sending password reset email...": "Password reset email bheja ja raha hai...",
    "Account created. Check your email to confirm, then log in.": "Account ban gaya. Email confirm karke phir login karein.",
    "Password reset email sent. Check your inbox/spam.": "Password reset email bhej diya gaya. Inbox/spam check karein.",
    "Signing in...": "Sign in ho raha hai...",
    "Creating account...": "Account banaya ja raha hai...",
    "Redirecting to Google...": "Google ki taraf bheja ja raha hai...",
    "Use digits only (0, not O), e.g. 03001234567.": "Sirf number likhein (0, O nahi), masalan 03001234567.",
    "Request a code first.": "Pehle code mangayein.",
    "Enter the 6-digit code.": "6 digit ka code likhein.",
    "Verifying code...": "Code verify ho raha hai...",
    "Could not load your cloud workspace. Check Supabase URL/key and SQL schema.": "Cloud workspace load nahi hua. Supabase URL/key aur SQL schema check karein.",
    "Cloud save failed. Check your connection.": "Cloud save failed. Connection check karein.",
    "Logout failed.": "Logout failed.",
    "Login failed.": "Login failed.",
    "Signup failed.": "Signup failed.",
    "Google sign-in failed.": "Google sign-in failed.",
    "Could not send SMS code.": "SMS code nahi bhej gaya.",
    "Could not verify code.": "Code verify nahi ho saka.",
    "Could not resend code.": "Code dobara nahi bhej gaya.",
    "Could not send reset email.": "Reset email nahi bhej gaya.",
    "Could not update password. Check your sign-in method and try again.": "Password update nahi hua. Sign-in method check karke dobara koshish karein.",
    "Password updated. You can now use the app.": "Password update ho gaya. Ab app use kar sakte hain.",
    "Sign in first, then change your password.": "Pehle sign in karein, phir password badlein.",
    "Account and all data deleted.": "Account aur saara data delete ho gaya.",
    "Could not delete account.": "Account delete nahi ho saka.",
    "Owner setup pending. SQL ready to copy.": "Owner setup baaki hai. SQL copy ke liye tayyar hai.",
    "SQL copied. Paste it in Supabase SQL Editor.": "SQL copy ho gaya. Supabase SQL Editor me paste karein.",
    "Select the SQL and copy it manually.": "SQL select karke manually copy karein.",
    "Select a conversation first.": "Pehle conversation select karein.",
    "Paste the buyer's message first.": "Pehle buyer ka message paste karein.",
    "Product updated.": "Product update ho gaya.",
    "Product saved.": "Product save ho gaya.",
    "A product with this name already exists.": "Is naam ka product pehle se hai.",
    "Add at least one item to the order.": "Order me kam se kam ek item daalein.",
    "Enter a phone number with country code.": "Country code ke saath phone number likhein.",
    "Order updated.": "Order update ho gaya.",
    "Order saved.": "Order save ho gaya.",
    "Not enough available stock for these changes.": "In badlaavon ke liye stock kam hai.",
    "Not enough available stock for this order.": "Is order ke liye available stock kam hai.",
    "Not enough available stock to reverse this return.": "Return wapas karne ke liye stock kam hai.",
    "Enter a payment amount.": "Payment amount likhein.",
    "Advance recorded.": "Advance record ho gaya.",
    "Payment recorded.": "Payment record ho gaya.",
    "Allow pop-ups to open the invoice.": "Invoice kholne ke liye pop-ups allow karein.",
    "Customer updated.": "Customer update ho gaya.",
    "Customer saved.": "Customer save ho gaya.",
    "A customer with this phone already exists.": "Is phone ka customer pehle se hai.",
    "Backup downloaded.": "Backup download ho gaya.",
    "Restore this backup? Current data will be replaced.": "Ye backup restore karein? Abhi ka data replace ho jayega.",
    "Backup restored.": "Backup restore ho gaya.",
    "That file is not a valid SellMate backup.": "Ye file valid SellMate backup nahi hai.",
    "Could not read that file.": "Ye file read nahi ho saki.",
    "Select customers in the follow-up queue first.": "Pehle follow-up queue se customers select karein.",
    "Order loaded — review and save when ready.": "Order load ho gaya. Review karke save karein.",
    "Paste a buyer message first.": "Pehle buyer ka message paste karein.",
    "Order form filled — please review and save.": "Order form bhar gaya. Review karke save karein.",
    "Payment recorded in ledger.": "Payment ledger me record ho gaya.",
    "Statement copied.": "Statement copy ho gaya.",
    "Copy failed — select the text manually.": "Copy failed. Text manually select karke copy karein.",
    "Supplier updated.": "Supplier update ho gaya.",
    "Supplier saved.": "Supplier save ho gaya.",
    "Enter a bill amount.": "Bill amount likhein.",
    "Enter a paid amount.": "Paid amount likhein.",
    "Supplier deleted.": "Supplier delete ho gaya.",
    "Supplier statement copied.": "Supplier statement copy ho gaya.",
    "Suppliers CSV downloaded.": "Suppliers CSV download ho gaya.",
    "Select at least one product.": "Kam se kam ek product select karein.",
    "Quick replies saved.": "Quick replies save ho gayein.",
    "Reset all custom replies to the built-in wording?": "Saari custom replies built-in text par reset karein?",
    "Replies reset to defaults.": "Replies default par reset ho gayein.",
    "Orders CSV downloaded.": "Orders CSV download ho gaya.",
    "Payments CSV downloaded.": "Payments CSV download ho gaya.",
    "Customers CSV downloaded.": "Customers CSV download ho gaya.",
    "Products CSV downloaded.": "Products CSV download ho gaya.",
    "Reset this workspace? This clears your cloud data for this account.": "Ye workspace reset karein? Is account ka saara cloud data clear ho jayega.",
    "Workspace reset.": "Workspace reset ho gaya.",
    "Stock updated.": "Stock update ho gaya.",
    "Delete this product? Existing orders keep their item details.": "Ye product delete karein? Purane orders ke item details rahenge.",
    "Remove this payment entry?": "Ye payment entry hataayein?",
    "Payment removed.": "Payment hata diya gaya.",
    "Delete this order? Stock and payments recorded for it will also be removed from the app.": "Ye order delete karein? Iska stock aur payments bhi app se hata diye jayein ge.",
    "No previous order for this customer.": "Is customer ka koi purana order nahi hai.",
    "This customer has orders. Delete the orders first.": "Is customer ke orders hain. Pehle orders delete karein.",
    "Delete this customer?": "Ye customer delete karein?",
    "Draft copied.": "Draft copy ho gaya.",
    "Add an Instagram handle to this customer first.": "Pehle is customer ka Instagram handle daalein.",
    "Day Book generated.": "Day Book ban gaya.",
    "Price list generated.": "Price list ban gayi.",
    "Restock list generated.": "Restock list ban gayi.",
    "Monthly summary generated.": "Monthly summary ban gaya.",
    "Expense saved.": "Expense save ho gaya.",
    "Workspace synced from another tab.": "Workspace doosre tab se sync ho gaya.",
    "Delete your account and ALL cloud data? This cannot be undone.": "Account aur saara cloud data delete karein? Ye wapas nahi ho sakta.",
    "Could not start the cloud connection.": "Cloud connection start nahi ho saka."
  };

  function localizeMessage(message) {
    const text = String(message == null ? "" : message);
    if (!text || !window.SellMateLang || window.SellMateLang.isEnglish()) return text;
    if (Object.prototype.hasOwnProperty.call(MESSAGES_UR, text)) return MESSAGES_UR[text];
    let match = text.match(/^Status changed to (.+)\.$/);
    if (match) return "Status " + match[1] + " ho gaya.";
    match = text.match(/^Ready (.+) reply — review before sending\.$/);
    if (match) return match[1] + " reply tayyar hai — bhejne se pehle check karein.";
    match = text.match(/^Opening (\d+) WhatsApp chats?\.$/);
    if (match) return match[1] + " WhatsApp chat kholein ge.";
    match = text.match(/^Open WhatsApp for (\d+) customers\? Allow pop-ups if your browser asks\.$/);
    if (match) return match[1] + " customers ke liye WhatsApp kholein? Browser pooche to pop-ups allow karein.";
    match = text.match(/^Generate the (.+) first\.$/);
    if (match) return "Pehle " + match[1] + " banayein.";
    match = text.match(/^(.+) copied\.$/);
    if (match) return match[1] + " copy ho gaya.";
    match = text.match(/^Only (\d+) (.+) available \(others reserved\)\.$/);
    if (match) return "Sirf " + match[1] + " " + match[2] + " available hain (baaki reserve hain).";
    match = text.match(/^Account deletion is temporarily unavailable\. Please contact (.+)\.$/);
    if (match) return "Account deletion abhi unavailable hai. " + match[1] + " se contact karein.";
    return text;
  }

  function askConfirm(message) {
    return window["confirm"](localizeMessage(message));
  }

  function toast(message, type) {
    const area = document.getElementById("toastArea");
    const el = document.createElement("div");
    el.className = "toast " + (type || "ok");
    el.innerHTML = "<span>" + (type === "warn" ? "⚠" : "✓") + "</span><span>" + esc(localizeMessage(message)) + "</span>";
    area.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(14px)";
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  function triggerDownload(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvCell(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, header, rows) {
    const lines = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    triggerDownload(filename, new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8" }));
  }

  function openWhatsAppTo(phone, text) {
    const clean = cleanPhone(phone);
    window.open("https://wa.me/" + (clean ? clean : "") + "?text=" + encodeURIComponent(text || "Hello!"), "_blank", "noopener");
  }

  /* ---------- Cloud (Supabase) ---------- */
  function supabaseConfig() {
    const cfg = window.SELLMATE_SUPABASE || {};
    const url = String(cfg.url || "").trim();
    const anonKey = String(cfg.anonKey || "").trim();
    if (!url || !anonKey || /YOUR_SUPABASE|PASTE_YOUR/i.test(url + anonKey)) return null;
    return { url, anonKey };
  }

  function normalizeSettings(saved) {
    const base = blank().settings;
    const replies = saved && saved.replies && typeof saved.replies === "object" ? saved.replies : {};
    const out = Object.assign(base, saved || {}, { replies });
    out.shopName = String(out.shopName || "My Shop").trim() || "My Shop";
    out.theme = out.theme === "dark" ? "dark" : "light";
    out.language = out.language === "en" ? "en" : "ur";
    out.nextCode = Math.max(1001, Math.floor(num(out.nextCode, 1001)));
    return out;
  }

  function normalizeSupplier(supplier) {
    return {
      id: supplier.id || uid(),
      name: supplier.name || "Supplier",
      phone: supplier.phone || "",
      notes: supplier.notes || "",
      bills: Array.isArray(supplier.bills) ? supplier.bills.map((b) => ({
        id: b.id || uid(), amount: num(b.amount), note: b.note || "", date: b.date || todayISO()
      })) : [],
      payments: Array.isArray(supplier.payments) ? supplier.payments.map((p) => ({
        id: p.id || uid(), amount: num(p.amount), method: p.method || "Cash",
        note: p.note || "", date: p.date || todayISO()
      })) : []
    };
  }

  function normalizeExpense(expense) {
    return {
      id: expense.id || uid(),
      name: expense.name || "Expense",
      amount: num(expense.amount),
      date: expense.date || todayISO(),
      category: EXPENSE_CATEGORIES.includes(expense.category) ? expense.category : "Other"
    };
  }

  function normalizePayment(payment) {
    return {
      id: payment.id || uid(),
      amount: num(payment.amount),
      method: payment.method || "Cash",
      note: payment.note || "",
      date: payment.date || todayISO()
    };
  }

  function normalizeState(raw) {
    const base = blank();
    const src = raw && typeof raw === "object" ? raw : {};
    const products = Array.isArray(src.products) ? src.products.map((p) => ({
      id: p.id || uid(),
      name: String(p.name || "Product"),
      sku: p.sku || "",
      price: num(p.price),
      cost: num(p.cost),
      stock: num(p.stock),
      low: num(p.low, 3),
      unit: p.unit || "pc"
    })) : base.products;
    const customers = Array.isArray(src.customers) ? src.customers.map((c) => ({
      id: c.id || uid(),
      name: String(c.name || "Customer"),
      phone: c.phone || "",
      instagram: c.instagram || "",
      notes: c.notes || "",
      createdAt: c.createdAt || todayISO(),
      payments: Array.isArray(c.payments) ? c.payments.map(normalizePayment) : []
    })) : base.customers;
    const orders = Array.isArray(src.orders) ? src.orders.map((o) => {
      const status = STATUSES.includes(o.status) ? o.status : "New";
      return {
        id: o.id || uid(),
        code: o.code || "SM-" + uid(),
        customerId: o.customerId || null,
        customerName: String(o.customerName || "Customer"),
        phone: o.phone || "",
        instagram: o.instagram || "",
        date: o.date || todayISO(),
        status,
        dispatched: !!o.dispatched || STOCK_CONSUMING.includes(status),
        returned: !!o.returned || status === "Returned",
        cancelled: !!o.cancelled || status === "Cancelled",
        items: Array.isArray(o.items) ? o.items.map((i) => ({
          name: String(i.name || "Item"),
          productId: i.productId || null,
          qty: num(i.qty, 1),
          price: num(i.price),
          cost: num(i.cost)
        })).filter((i) => i.name) : [],
        discount: num(o.discount),
        delivery: num(o.delivery),
        payments: Array.isArray(o.payments) ? o.payments.map(normalizePayment) : [],
        dueDate: o.dueDate || "",
        courier: o.courier || "",
        tracking: o.tracking || "",
        address: o.address || "",
        notes: o.notes || "",
        updatedAt: o.updatedAt || o.date || todayISO()
      };
    }) : base.orders;
    const chats = {};
    if (src.chats && typeof src.chats === "object") {
      Object.keys(src.chats).forEach((phone) => {
        chats[phone] = Array.isArray(src.chats[phone]) ? src.chats[phone].map((m) => ({
          from: m.from === "buyer" ? "buyer" : "seller",
          text: String(m.text || ""),
          time: m.time || ""
        })) : [];
      });
    }
    return {
      products,
      customers,
      orders,
      expenses: Array.isArray(src.expenses) ? src.expenses.map(normalizeExpense) : base.expenses,
      suppliers: Array.isArray(src.suppliers) ? src.suppliers.map(normalizeSupplier) : base.suppliers,
      chats,
      settings: normalizeSettings(src.settings)
    };
  }

  function setAuthStatus(message, type) {
    const text = localizeMessage(message || "");
    const cls = "auth-status" + (type ? " " + type : "");
    [document.getElementById("authStatus"), document.getElementById("phoneStatus")].forEach((el) => {
      if (!el) return;
      el.textContent = text;
      el.className = cls + (el.id === "phoneStatus" ? " phone-status" : "");
    });
  }

  function showAuthScreen() {
    closeSidebar();
    document.getElementById("authScreen").hidden = false;
    document.getElementById("appShell").hidden = true;
  }

  function showAppShell() {
    document.getElementById("authScreen").hidden = true;
    document.getElementById("appShell").hidden = false;
  }

  function authTab(tab) {
    const login = tab === "login";
    const signup = tab === "signup";
    const phone = tab === "phone";
    document.getElementById("loginForm").hidden = !login;
    document.getElementById("signupForm").hidden = !signup;
    document.getElementById("phoneForm").hidden = !phone;
    document.getElementById("recoveryForm").hidden = true;
    document.getElementById("phoneAuthBtn").hidden = phone;
    document.getElementById("otpBox").hidden = !(phone && !!pendingPhone);
    document.querySelectorAll("[data-auth-tab]").forEach((b) => {
      const active = b.dataset.authTab === tab;
      b.classList.toggle("active", active);
      if (b.hasAttribute("role")) b.setAttribute("aria-selected", String(active));
    });
    setAuthStatus("");
  }

  function showRecovery(mode, message) {
    recoveryNeedsOld = mode === "change" && !!(currentUser && currentUser.email);
    const oldField = document.getElementById("recoveryOldField");
    const oldInput = document.getElementById("recoveryOldPassword");
    oldField.hidden = !recoveryNeedsOld;
    oldInput.required = recoveryNeedsOld;
    oldInput.value = "";
    document.getElementById("recoveryHelp").textContent = recoveryNeedsOld
      ? "Enter your current password, then choose a new one."
      : "Set a new password for your account.";
    document.getElementById("loginForm").hidden = true;
    document.getElementById("signupForm").hidden = true;
    document.getElementById("phoneForm").hidden = true;
    document.getElementById("otpBox").hidden = true;
    document.getElementById("phoneAuthBtn").hidden = true;
    document.getElementById("recoveryForm").hidden = false;
    document.querySelectorAll("[data-auth-tab]").forEach((b) => b.classList.remove("active"));
    showAuthScreen();
    setAuthStatus(message || (recoveryNeedsOld ? "Verify your current password." : "Link verified. Choose a new password."), "ok");
  }

  function cancelRecovery() {
    recoveryIntent = false;
    document.getElementById("recoveryForm").hidden = true;
    if (currentUser && sb) {
      showAppShell();
      applySettings();
      renderAll();
    } else {
      authTab("login");
    }
  }

  async function ensureProfile(user) {
    const email = user.email || "";
    const fallback = email ? email.split("@")[0] : "My Shop";
    const shopName = (user.user_metadata && user.user_metadata.shop_name) ? String(user.user_metadata.shop_name) : fallback;
    await sb.from("profiles").upsert({ id: user.id, shop_name: shopName, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }

  async function loadCloudState(user) {
    const { data, error } = await sb.from("workspaces").select("data").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (data && data.data && Object.keys(data.data).length) {
      state = normalizeState(data.data);
      return;
    }
    state = blank();
    const shop = (user.user_metadata && user.user_metadata.shop_name) ? String(user.user_metadata.shop_name) : (user.email ? user.email.split("@")[0] : "My Shop");
    state.settings.shopName = shop || "My Shop";
    await persistStateNow();
  }

  async function persistStateNow() {
    if (!cloudReady || !currentUser || !sb) return;
    if (saving) { queuedSave = true; return; }
    saving = true;
    try {
      const payload = { user_id: currentUser.id, data: state, updated_at: new Date().toISOString() };
      const { error } = await sb.from("workspaces").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      if (workspaceChannel) workspaceChannel.postMessage({ userId: currentUser.id, at: Date.now() });
    } catch (error) {
      console.warn("SellMate cloud save failed");
      toast("Cloud save failed. Check your connection.", "warn");
    } finally {
      saving = false;
      if (queuedSave) { queuedSave = false; await persistStateNow(); }
    }
  }

  function save() {
    if (!cloudReady || !currentUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; persistStateNow(); }, 350);
  }

  function cancelPendingSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    queuedSave = false;
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      return persistStateNow();
    }
    return Promise.resolve();
  }

  async function handleSession(session) {
    const nextUser = session ? session.user : null;
    if (workspaceLoaded && currentUser && nextUser && currentUser.id === nextUser.id) return;
    if (currentUser && (!nextUser || nextUser.id !== currentUser.id)) await flushSave();
    cancelPendingSave();
    clearDraft();
    currentUser = nextUser;
    lastAuthUserId = currentUser ? currentUser.id : null;
    cloudReady = !!currentUser;
    workspaceLoaded = false;
    if (!currentUser) {
      state = blank();
      applySettings();
      showAuthScreen();
      return;
    }
    try {
      await ensureProfile(currentUser);
      await loadCloudState(currentUser);
      const lang = window.SellMateLang;
      if (lang) {
        const cloudLang = state.settings.language;
        if (lang.hasPreference()) {
          state.settings.language = lang.get();
          save();
        } else if (cloudLang === "en" || cloudLang === "ur") {
          lang.set(cloudLang, false);
        }
      }
      editingProduct = editingOrder = editingCustomer = null;
      activePhone = null; paymentOpenId = null; activeLedgerId = null; activeSupplierId = null; editingSupplier = null;
      parsedPaste = null; selectedPriceIds = null; selectedFollowups = new Set(); clearPriceList();
      const emailEl = document.getElementById("accountEmail");
      if (emailEl) emailEl.textContent = currentUser.email || currentUser.phone || "Signed in";
      showAppShell();
      applySettings();
      renderProductOptions();
      renderReplyTemplates();
      resetOrderForm();
      renderAll();
      workspaceLoaded = true;
    } catch (error) {
      console.warn("SellMate cloud workspace load failed");
      cancelPendingSave();
      currentUser = null;
      lastAuthUserId = null;
      cloudReady = false;
      workspaceLoaded = false;
      state = blank();
      setAuthStatus("Could not load your cloud workspace. Check Supabase URL/key and SQL schema.", "warn");
      applySettings();
      showAuthScreen();
    }
  }

  async function signInWithPassword(email, password) {
    setAuthStatus("Signing in...");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithPassword(email, password, shopName) {
    setAuthStatus("Creating account...");
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { shop_name: shopName || "My Shop" } }
    });
    if (error) throw error;
    if (data.session) return "signed-in";
    return "confirm-email";
  }

  async function signInWithGoogle() {
    setAuthStatus("Redirecting to Google...");
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) throw error;
  }

  function normalizePhone(raw) {
    const trimmed = String(raw || "").trim();
    if (/[A-Za-z]/.test(trimmed)) return null;
    const cleaned = trimmed.replace(/[\s\-()]/g, "");
    if (cleaned.startsWith("+")) return /^\+[0-9]{8,15}$/.test(cleaned) ? cleaned : null;
    let digits = cleaned.replace(/\D/g, "");
    if (digits.startsWith("92")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = digits.slice(1);
    if (/^3[0-9]{9}$/.test(digits)) return "+92" + digits;
    if (/^[0-9]{8,15}$/.test(digits)) return "+" + digits;
    return null;
  }

  async function sendPhoneCode() {
    const phone = normalizePhone(document.getElementById("phoneNumber").value);
    if (!phone) throw new Error("Use digits only (0, not O), e.g. 03001234567.");
    const shopName = document.getElementById("phoneShop").value.trim();
    setAuthStatus("Sending SMS code...");
    const { error } = await sb.auth.signInWithOtp({
      phone,
      options: { data: { shop_name: shopName || "My Shop" } }
    });
    if (error) throw error;
    pendingPhone = phone;
    document.getElementById("otpBox").hidden = false;
    setAuthStatus("Code sent to " + phone + ". Enter the 6-digit code below.", "ok");
  }

  async function verifyPhoneCode() {
    if (!pendingPhone) throw new Error("Request a code first.");
    const token = document.getElementById("phoneOtp").value.trim();
    if (!/^\d{6}$/.test(token)) throw new Error("Enter the 6-digit code.");
    setAuthStatus("Verifying code...");
    const { error } = await sb.auth.verifyOtp({ phone: pendingPhone, token, type: "sms" });
    if (error) throw error;
    setAuthStatus("");
  }

  async function signOut() {
    await flushSave();
    await persistStateNow();
    await sb.auth.signOut();
    state = blank();
    currentUser = null;
    lastAuthUserId = null;
    cloudReady = false;
    workspaceLoaded = false;
    clearDraft();
    applySettings();
    showAuthScreen();
  }

  const DELETE_ACCOUNT_SQL = `create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in.';
  end if;
  delete from public.workspaces where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;`;

  const OWNER_EMAIL = "samad88900@gmail.com";

  function isOwnerContext() {
    return String((currentUser && currentUser.email) || "").toLowerCase() === OWNER_EMAIL;
  }

  function showDeleteSetup() {
    if (document.querySelector(".setup-modal")) return;
    const english = !!(window.SellMateLang && window.SellMateLang.isEnglish());
    const box = document.createElement("div");
    box.className = "setup-modal";
    box.innerHTML = `<div class="setup-card">
      <h3>One-time owner setup</h3>
      <p>${english
        ? "This is for the app owner only. Run this SQL <strong>once</strong> in <strong>Supabase → SQL Editor → New query → Run</strong>. After that, no user will see this screen — they only tap the button."
        : "Ye sirf app owner ke liye hai. <strong>Ek dafa</strong> ye SQL <strong>Supabase → SQL Editor → New query → Run</strong> kar do. Uske baad kisi bhi user ko ye screen nahi dikhegi — sab sirf button dabayenge."}</p>
      <textarea readonly spellcheck="false">${esc(DELETE_ACCOUNT_SQL)}</textarea>
      <div class="row-actions">
        <button class="btn primary" type="button" data-copy-setup>Copy SQL</button>
        <button class="btn ghost" type="button" data-close-setup>Close</button>
      </div>
    </div>`;
    document.body.appendChild(box);
    let onKey = null;
    const close = () => {
      if (onKey) document.removeEventListener("keydown", onKey);
      box.remove();
    };
    box.addEventListener("click", (event) => {
      if (event.target === box || event.target.hasAttribute("data-close-setup")) { close(); return; }
      if (!event.target.hasAttribute("data-copy-setup")) return;
      const area = box.querySelector("textarea");
      const fallback = () => {
        area.focus();
        area.select();
        let done = false;
        try { done = document.execCommand("copy"); } catch (_) {}
        toast(done ? "SQL copied. Paste it in Supabase SQL Editor." : "Select the SQL and copy it manually.", done ? "ok" : "warn");
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value)
          .then(() => toast("SQL copied. Paste it in Supabase SQL Editor.", "ok"))
          .catch(fallback);
      } else fallback();
    });
    onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
  }

  async function deleteAccount() {
    if (!askConfirm("Delete your account and ALL cloud data? This cannot be undone.")) return;
    const btn = document.getElementById("deleteAccountBtn");
    if (btn) btn.disabled = true;
    suppressAuthHandling = true;
    try {
      const { error } = await sb.rpc("delete_account");
      if (error) throw error;
      await sb.auth.signOut();
      cancelPendingSave();
      state = blank();
      currentUser = null;
      lastAuthUserId = null;
      cloudReady = false;
      workspaceLoaded = false;
      clearDraft();
      applySettings();
      showAuthScreen();
      setAuthStatus("Account and all data deleted.", "ok");
    } catch (err) {
      const code = String((err && err.code) || "");
      const message = String((err && err.message) || "");
      const missingFunction = code === "PGRST202" || /Could not find the function/i.test(message);
      if (missingFunction && isOwnerContext()) {
        showDeleteSetup();
        toast("Owner setup pending. SQL ready to copy.", "warn");
      } else if (missingFunction) {
        toast("Account deletion is temporarily unavailable. Please contact " + OWNER_EMAIL + ".", "warn");
      } else {
        toast(message || "Could not delete account.", "warn");
      }
    } finally {
      suppressAuthHandling = false;
      if (btn) btn.disabled = false;
    }
  }

  async function resetPassword(email) {
    if (!email) throw new Error("Enter your email first.");
    setAuthStatus("Sending password reset email...");
    const redirect = new URL(window.location.href);
    redirect.searchParams.delete("type");
    redirect.searchParams.delete("code");
    redirect.searchParams.delete("error");
    redirect.searchParams.delete("error_description");
    redirect.hash = "";
    redirect.searchParams.set("type", "recovery");
    const redirectTo = redirect.toString();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function updatePassword(password, oldPassword) {
    if (!password || password.length < 6) throw new Error("New password must be at least 6 characters.");
    if (oldPassword && currentUser && currentUser.email) {
      suppressAuthHandling = true;
      let signInError;
      try {
        ({ error: signInError } = await sb.auth.signInWithPassword({ email: currentUser.email, password: oldPassword }));
      } finally { suppressAuthHandling = false; }
      if (signInError) throw new Error("Current password is incorrect.");
    }
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
  }

  async function initCloud() {
    const cfg = supabaseConfig();
    if (!cfg) {
      showAuthScreen();
      setAuthStatus("Add your Supabase Project URL and anon key in supabase-config.js, then reload.", "warn");
      applySettings();
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      showAuthScreen();
      setAuthStatus("Supabase library could not load. Check your internet connection.", "warn");
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    recoveryIntent = searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error_description") || hashParams.get("error_description")
      || searchParams.get("error") || hashParams.get("error");
    if (oauthError && !recoveryIntent) {
      let readable = oauthError;
      try { readable = decodeURIComponent(oauthError).replace(/\+/g, " "); } catch (_) {}
      showAuthScreen();
      setAuthStatus(readable, "warn");
      return;
    }

    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    sb.auth.onAuthStateChange((event, session) => {
      if (suppressAuthHandling) return;
      if (event === "PASSWORD_RECOVERY" || (recoveryIntent && session)) { showRecovery("reset"); return; }
      if (recoveryIntent && !session) return;
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      if (event === "SIGNED_IN" && cloudReady && session && session.user.id === lastAuthUserId) return;
      handleSession(session);
    });

    const { data } = await sb.auth.getSession();
    if (recoveryIntent) {
      if (!data.session && code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          showAuthScreen();
          setAuthStatus("Reset link is invalid or expired. Please request a new one.", "warn");
          return;
        }
      }
      if (!data.session && !code) {
        showAuthScreen();
        setAuthStatus("Reset link is invalid or expired. Please request a new one.", "warn");
        return;
      }
      showRecovery("reset");
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    await handleSession(data.session);
  }

  /* ---------- Derived data ---------- */
  function orderSubtotal(order) {
    return (order.items || []).reduce((sum, item) => sum + num(item.qty) * num(item.price), 0);
  }

  function orderTotal(order) {
    return Math.max(0, orderSubtotal(order) - num(order.discount) + num(order.delivery));
  }

  function orderCost(order) {
    return (order.items || []).reduce((sum, item) => sum + num(item.qty) * num(item.cost), 0);
  }

  function orderPaid(order) {
    return (order.payments || []).reduce((sum, payment) => sum + num(payment.amount), 0);
  }

  function orderBalance(order) {
    return orderTotal(order) - orderPaid(order);
  }

  function balanceTag(value) {
    if (value > 0) return '<span class="tag balance-due">Due ' + money(value) + "</span>";
    if (value < 0) return '<span class="tag balance-advance">Advance ' + money(Math.abs(value)) + "</span>";
    return '<span class="tag balance-clear">Paid</span>';
  }

  function customerFor(order) {
    return state.customers.find((c) => c.id === order.customerId) ||
      state.customers.find((c) => cleanPhone(c.phone) === cleanPhone(order.phone));
  }

  function customerBalance(customer) {
    const fromOrders = state.orders
      .filter((o) => o.customerId === customer.id && !o.cancelled && !o.returned)
      .reduce((sum, o) => sum + orderBalance(o), 0);
    const unallocated = (customer.payments || []).reduce((sum, p) => sum + num(p.amount), 0);
    return fromOrders - unallocated;
  }

  function customerOrders(customer) {
    return state.orders.filter((o) => o.customerId === customer.id || cleanPhone(o.phone) === cleanPhone(customer.phone));
  }

  function followupOrders() {
    const today = todayISO();
    return state.orders
      .filter((o) => o.dueDate && o.dueDate <= today && orderBalance(o) > 0 && !o.cancelled && !o.returned)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  function supplierBalance(supplier) {
    const billed = (supplier.bills || []).reduce((sum, b) => sum + num(b.amount), 0);
    const paid = (supplier.payments || []).reduce((sum, p) => sum + num(p.amount), 0);
    return billed - paid;
  }

  function supplierEvents(supplier) {
    const events = [
      ...(supplier.bills || []).map((b) => ({ id: b.id, date: b.date, kind: "bill", title: b.note || "Bill", amount: num(b.amount), method: "" })),
      ...(supplier.payments || []).map((p) => ({ id: p.id, date: p.date, kind: "payment", title: p.note || p.method, amount: -num(p.amount), method: p.method }))
    ];
    events.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    let running = 0;
    events.forEach((e) => { running += e.amount; e.balance = running; });
    return events;
  }

  function supplierStatement(supplier) {
    const lines = ["*" + (state.settings.shopName || "My Shop") + " — Supplier Statement*", "Supplier: " + supplier.name + (supplier.phone ? " · " + supplier.phone : ""), ""];
    supplierEvents(supplier).forEach((e) => {
      lines.push(shortDate(e.date) + "  " + (e.kind === "bill" ? "Bill " : "Paid ") + e.title + "  " + money(Math.abs(e.amount)) + "  →  " + money(e.balance));
    });
    if (!(supplier.bills || []).length && !(supplier.payments || []).length) lines.push("No entries yet.");
    const balance = supplierBalance(supplier);
    lines.push("", "Total " + (balance >= 0 ? "payable" : "advance") + ": " + money(Math.abs(balance)), "Thank you!");
    return lines.join("\n");
  }

  function reservedFor(productId) {
    return state.orders
      .filter((o) => PRE_DISPATCH.includes(o.status) && !o.cancelled)
      .reduce((sum, o) => sum + (o.items || []).filter((i) => i.productId === productId).reduce((s, i) => s + num(i.qty), 0), 0);
  }

  function availability(product) {
    return num(product.stock) - reservedFor(product.id);
  }

  function qtyByProduct(items) {
    const map = new Map();
    (items || []).forEach((item) => {
      if (!item.productId) return;
      map.set(item.productId, (map.get(item.productId) || 0) + num(item.qty));
    });
    return map;
  }

  function reservedExcluding(productId, orderId) {
    return state.orders
      .filter((o) => o.id !== orderId && PRE_DISPATCH.includes(o.status) && !o.cancelled)
      .reduce((sum, o) => sum + (o.items || []).filter((i) => i.productId === productId).reduce((s, i) => s + num(i.qty), 0), 0);
  }

  function canConsumeProduct(productId, qty, orderId) {
    if (qty <= 0 || !productId) return true;
    const product = state.products.find((p) => p.id === productId);
    if (!product) return true;
    return num(product.stock) - reservedExcluding(productId, orderId) >= qty;
  }

  function canConsumeItems(items, orderId) {
    return [...qtyByProduct(items).entries()].every(([id, qty]) => canConsumeProduct(id, qty, orderId));
  }

  function applyStockDelta(items, direction) {
    qtyByProduct(items).forEach((qty, id) => {
      const product = state.products.find((p) => p.id === id);
      if (product) product.stock = num(product.stock) + direction * qty;
    });
  }

  function canApplyConsumingEdit(oldItems, newItems, orderId) {
    const oldMap = qtyByProduct(oldItems);
    const newMap = qtyByProduct(newItems);
    const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
    return [...ids].every((id) => canConsumeProduct(id, (newMap.get(id) || 0) - (oldMap.get(id) || 0), orderId));
  }

  function applyConsumingEdit(oldItems, newItems) {
    const oldMap = qtyByProduct(oldItems);
    const newMap = qtyByProduct(newItems);
    const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
    ids.forEach((id) => {
      const product = state.products.find((p) => p.id === id);
      if (product) product.stock = num(product.stock) - ((newMap.get(id) || 0) - (oldMap.get(id) || 0));
    });
  }

  function lowProducts() {
    return state.products.filter((p) => availability(p) <= num(p.low, 3));
  }

  function todayOrders() {
    return state.orders.filter((o) => o.date === todayISO());
  }

  function todayCollections() {
    const date = todayISO();
    const fromOrders = state.orders.reduce((sum, o) =>
      sum + (o.payments || []).filter((p) => p.date === date).reduce((s, p) => s + num(p.amount), 0), 0);
    const unallocated = state.customers.reduce((sum, c) =>
      sum + (c.payments || []).filter((p) => p.date === date).reduce((s, p) => s + num(p.amount), 0), 0);
    return fromOrders + unallocated;
  }

  function pendingCustomers() {
    return state.customers
      .map((c) => ({ customer: c, balance: customerBalance(c) }))
      .filter((x) => Math.abs(x.balance) > 0)
      .sort((a, b) => b.balance - a.balance);
  }

  function totals() {
    const delivered = state.orders.filter((o) => o.status === "Delivered");
    const sales = delivered.reduce((s, o) => s + orderTotal(o), 0);
    const cost = delivered.reduce((s, o) => s + orderCost(o), 0);
    const expenses = state.expenses.reduce((s, e) => s + num(e.amount), 0);
    return { sales, profit: sales - cost - expenses };
  }

  /* ---------- Navigation ---------- */
  function setSidebar(open) {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    document.body.classList.toggle("nav-open", open);
  }
  function closeSidebar() { setSidebar(false); }

  function switchView(view) {
    const target = APP_VIEWS.includes(view) ? view : "home";
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + target));
    document.querySelectorAll("[data-view], [data-go]").forEach((b) => {
      const active = (b.dataset.view || b.dataset.go) === target;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------- Render: dashboard ---------- */
  function renderMetrics() {
    document.getElementById("mTodayOrders").textContent = todayOrders().length;
    document.getElementById("mTodayNote").textContent = state.orders.filter((o) => PRE_DISPATCH.includes(o.status)).length + " active";
    document.getElementById("mCollected").textContent = money(todayCollections());
    const pending = pendingCustomers();
    const due = pending.filter((x) => x.balance > 0).reduce((s, x) => s + x.balance, 0);
    document.getElementById("mBalance").textContent = money(due);
    document.getElementById("mBalanceNote").textContent = "From " + pending.filter((x) => x.balance > 0).length + " customers";
    document.getElementById("mLow").textContent = lowProducts().length;
    document.getElementById("mLowNote").textContent = "Available at or below alert";
  }

  function renderRecent() {
    const box = document.getElementById("recentOrders");
    if (!state.orders.length) {
      box.innerHTML = '<div class="empty-state">No orders yet. Your latest orders will appear here.</div>';
      return;
    }
    box.innerHTML = [...state.orders].reverse().slice(0, 5).map((o) => `
      <div class="row">
        <div class="row-main">
          <div>
            <div class="row-title">${esc(o.code)} · ${esc(o.customerName)}</div>
            <div class="row-sub">${esc(o.items.map((i) => num(i.qty) + " × " + i.name).join(", "))} · ${money(orderTotal(o))}</div>
          </div>
          <span class="tag ${esc(o.status)}">${esc(o.status)}</span>
        </div>
      </div>
    `).join("");
  }

  function renderStockWatch() {
    const box = document.getElementById("stockWatch");
    const items = lowProducts().length ? lowProducts() : [...state.products].sort((a, b) => availability(a) - availability(b)).slice(0, 5);
    if (!items.length) {
      box.innerHTML = '<div class="empty-state">Add products to watch availability.</div>';
      return;
    }
    box.innerHTML = items.slice(0, 6).map((p) => `
      <div class="row">
        <div class="row-main">
          <div>
            <div class="row-title">${esc(p.name)}</div>
            <div class="row-sub">${money(p.price)} · ${num(p.stock)} in shop · ${reservedFor(p.id)} reserved</div>
          </div>
          <span class="tag ${availability(p) <= num(p.low, 3) ? "low" : ""}">${availability(p)} ${esc(p.unit || "pc")} available</span>
        </div>
      </div>
    `).join("");
  }

  function renderPendingPayments() {
    const box = document.getElementById("pendingPayments");
    const items = pendingCustomers().filter((x) => x.balance > 0).slice(0, 6);
    if (!items.length) {
      box.innerHTML = '<div class="empty-state">No pending balances. Nice work!</div>';
      return;
    }
    box.innerHTML = items.map((x) => `
      <div class="row">
        <div class="row-main">
          <div>
            <div class="row-title">${esc(x.customer.name)}</div>
            <div class="row-sub">${cleanPhone(x.customer.phone)} · ${state.orders.filter((o) => o.customerId === x.customer.id).length} orders</div>
          </div>
          ${balanceTag(x.balance)}
        </div>
        <div class="row-actions">
          <button class="btn ghost" data-message-customer="${esc(x.customer.phone)}">Message</button>
          <button class="btn primary" data-order-for="${esc(x.customer.phone)}">New order</button>
        </div>
      </div>
    `).join("");
  }

  function renderPipeline() {
    const box = document.getElementById("pipeline");
    box.innerHTML = STATUSES.map((status) => `
      <div class="pipe-cell"><strong>${state.orders.filter((o) => o.status === status).length}</strong><span>${esc(status)}</span></div>
    `).join("");
  }

  /* ---------- Render: products ---------- */
  function renderProductOptions() {
    let list = document.getElementById("productOptions");
    if (!list) {
      list = document.createElement("datalist");
      list.id = "productOptions";
      document.getElementById("itemRows").appendChild(list);
    }
    list.innerHTML = state.products
      .map((p) => `<option value="${esc(p.name)}"></option>`).join("");
  }

  function renderProducts() {
    const query = (document.getElementById("productSearch").value || "").trim().toLowerCase();
    const list = document.getElementById("productList");
    const items = state.products.filter((p) => p.name.toLowerCase().includes(query));
    renderProductOptions();

    if (!items.length) {
      list.innerHTML = '<div class="empty-state">' + (query ? "No products match that search." : "No products yet. Add your first one on the left.") + '</div>';
      return;
    }
    list.innerHTML = items.map((p) => {
      const available = availability(p);
      return `
        <div class="row">
          <div class="row-main">
            <div>
              <div class="row-title">${esc(p.name)}${p.sku ? ' <span class="tag sku-tag">' + esc(p.sku) + "</span>" : ""}</div>
              <div class="row-sub">${money(p.price)} · cost ${money(p.cost)} · ${num(p.stock)} in shop · ${reservedFor(p.id)} reserved</div>
            </div>
            <span class="tag ${available <= num(p.low, 3) ? "low" : ""}">${available} ${esc(p.unit || "pc")} available</span>
          </div>
          <div class="row-actions">
            <input type="number" min="0" step="1" value="${num(p.stock)}" data-stock-input="${p.id}" aria-label="Stock for ${esc(p.name)}" />
            <button class="btn ghost" data-stock-add="${p.id}">+ Stock</button>
            <button class="btn ghost" data-stock-set="${p.id}">Set</button>
            <button class="btn ghost" data-product-edit="${p.id}">Edit</button>
            <button class="btn danger-ghost" data-product-delete="${p.id}">Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  /* ---------- Order form items ---------- */
  function addItemRow(item) {
    const rows = document.getElementById("itemRows");
    const wrap = document.createElement("div");
    wrap.className = "item-row";
    wrap.innerHTML = `
      <label class="field">Product<input class="i-product" list="productOptions" required placeholder="Type product" value="${esc(item ? item.name : "")}" /></label>
      <label class="field">Qty<input class="i-qty" type="number" min="1" step="1" value="${item ? num(item.qty, 1) : 1}" /></label>
      <label class="field">Price<input class="i-price" type="number" min="0" step="1" value="${item ? num(item.price) : ""}" placeholder="0" /></label>
      <label class="field">Cost<input class="i-cost" type="number" min="0" step="1" value="${item ? num(item.cost) : ""}" placeholder="0" /></label>
      <button type="button" class="btn danger-ghost i-remove" aria-label="Remove item">×</button>
    `;
    rows.appendChild(wrap);
    const list = document.getElementById("productOptions");
    if (list) rows.appendChild(list);
  }

  function collectItems() {
    return [...document.querySelectorAll("#itemRows .item-row")].map((row) => ({
      name: row.querySelector(".i-product").value.trim(),
      productId: (state.products.find((p) => p.name.toLowerCase() === row.querySelector(".i-product").value.trim().toLowerCase()) || {}).id || null,
      qty: num(row.querySelector(".i-qty").value, 1),
      price: num(row.querySelector(".i-price").value),
      cost: num(row.querySelector(".i-cost").value)
    })).filter((item) => item.name);
  }

  function updateTotals() {
    const items = collectItems();
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = Math.min(num(document.getElementById("oDiscount").value), subtotal);
    const delivery = num(document.getElementById("oDelivery").value);
    const total = Math.max(0, subtotal - discount + delivery);
    const paid = num(document.getElementById("oPaid").value);
    const balance = total - paid;
    document.getElementById("orderTotals").innerHTML = `
      <div class="total-item">Subtotal<strong>${money(subtotal)}</strong></div>
      <div class="total-item">Discount<strong>− ${money(discount)}</strong></div>
      <div class="total-item">Delivery<strong>${money(delivery)}</strong></div>
      <div class="total-item accent">Total<strong>${money(total)}</strong></div>
      <div class="total-item">Paid now<strong>${money(paid)}</strong></div>
      <div class="total-item ${balance > 0 ? "due" : ""}">${balance < 0 ? "Advance" : "Balance"}<strong>${money(Math.abs(balance))}</strong></div>
    `;
  }

  function resetOrderForm() {
    const form = document.getElementById("orderForm");
    form.reset();
    const dateInput = document.getElementById("orderDate");
    if (dateInput) dateInput.value = todayISO();
    document.getElementById("oDiscount").value = 0;
    document.getElementById("oDelivery").value = 0;
    document.getElementById("oPaid").value = 0;
    document.getElementById("oSource").value = "WhatsApp";
    document.getElementById("oMethod").value = "Cash";
    document.getElementById("oDueDate").value = "";
    document.getElementById("oCourier").value = "";
    document.getElementById("oTracking").value = "";
    document.getElementById("itemRows").innerHTML = "";
    addItemRow(null);
    renderProductOptions();
    editingOrder = null;
    document.getElementById("orderFormTitle").textContent = "New order";
    document.getElementById("orderSubmit").textContent = "Save order";
    document.getElementById("cancelOrderEdit").hidden = true;
    updateTotals();
  }

  /* ---------- Render: orders ---------- */
  function renderOrders() {
    const query = (document.getElementById("orderSearch").value || "").trim().toLowerCase();
    const filter = document.getElementById("orderFilter").value;
    const from = document.getElementById("orderFrom").value;
    const to = document.getElementById("orderTo").value;
    const list = document.getElementById("orderList");
    document.getElementById("customerOptions").innerHTML = state.customers.map((c) => `<option value="${esc(c.name)}"></option>`).join("");

    const items = [...state.orders].reverse().filter((o) => {
      const matchesFilter = filter === "All" || o.status === filter;
      const matchesFrom = !from || String(o.date || "") >= from;
      const matchesTo = !to || String(o.date || "") <= to;
      const haystack = [o.code, o.customerName, o.phone, o.source, ...(o.items || []).map((i) => i.name)].join(" ").toLowerCase();
      return matchesFilter && matchesFrom && matchesTo && (!query || haystack.includes(query));
    });

    if (!items.length) {
      list.innerHTML = '<div class="empty-state">No orders match this view.</div>';
      return;
    }

    list.innerHTML = items.map((o) => {
      const balance = orderBalance(o);
      const overdue = o.dueDate && o.dueDate <= todayISO() && balance > 0;
      const detail = paymentOpenId === o.id ? `
        <div class="order-detail">
          <div class="detail-grid">
            <div class="detail-cell">Source<strong>${esc(o.source || "—")}</strong></div>
            <div class="detail-cell">Date<strong>${esc(prettyDate(o.date))}</strong></div>
            <div class="detail-cell">Total<strong>${money(orderTotal(o))}</strong></div>
            <div class="detail-cell">Cost<strong>${money(orderCost(o))}</strong></div>
            <div class="detail-cell">Paid<strong>${money(orderPaid(o))}</strong></div>
            <div class="detail-cell">Balance<strong>${money(balance)}</strong></div>
          </div>
          <p class="detail-section-title">Items</p>
          <div class="pay-list">
            ${(o.items || []).map((i) => `<div class="pay-row"><span>${num(i.qty)} × ${esc(i.name)}</span><span>${money(num(i.qty) * num(i.price))}</span></div>`).join("")}
          </div>
          ${o.discount || o.delivery ? `<div class="detail-grid" style="margin-top:8px"><div class="detail-cell">Discount<strong>${money(o.discount)}</strong></div><div class="detail-cell">Delivery<strong>${money(o.delivery)}</strong></div></div>` : ""}
          ${o.dueDate || o.courier || o.tracking ? `
            <div class="detail-grid" style="margin-top:8px">
              ${o.dueDate ? `<div class="detail-cell">Payment due<strong>${esc(prettyDate(o.dueDate))}</strong></div>` : ""}
              ${o.courier ? `<div class="detail-cell">Courier<strong>${esc(o.courier)}</strong></div>` : ""}
              ${o.tracking ? `<div class="detail-cell">Tracking no.<strong>${esc(o.tracking)}</strong></div>` : ""}
            </div>
          ` : ""}
          ${o.address ? `<p class="detail-section-title">Address</p><div class="detail-cell">${esc(o.address)}</div>` : ""}
          ${o.notes ? `<p class="detail-section-title">Notes</p><div class="detail-cell">${esc(o.notes)}</div>` : ""}
          <p class="detail-section-title">Payments</p>
          <div class="pay-list">
            ${(o.payments || []).length ? o.payments.map((p) => `
              <div class="pay-row">
                <span>${money(p.amount)} · ${esc(p.method)} <small>${esc(prettyDate(p.date))}${p.note ? " · " + esc(p.note) : ""}</small></span>
                <button class="text-btn" data-payment-delete="${p.id}" data-order-id="${o.id}">Remove</button>
              </div>
            `).join("") : '<div class="pay-row"><span>No payments recorded yet.</span></div>'}
          </div>
          <div class="pay-form">
            <label class="field">Amount<input class="pay-amount" type="number" min="1" step="1" placeholder="0" /></label>
            <label class="field">Method<select class="pay-method">${METHODS.map((m) => `<option>${m}</option>`).join("")}</select></label>
            <label class="field">Note<input class="pay-note" placeholder="Optional" /></label>
            <button class="btn primary" data-payment-add="${o.id}">Add</button>
          </div>
        </div>
      ` : "";

      return `
        <div class="row" id="order-${esc(o.id)}">
          <div class="row-main">
            <div>
              <div class="row-title">${esc(o.code)} — ${esc(o.customerName)}</div>
              <div class="row-sub">${esc(itemsSummary(o))} · ${esc(o.source || "")}</div>
              <div class="customer-meta">
                ${balanceTag(balance)}
                ${o.dueDate ? `<span class="tag ${overdue ? "balance-due" : ""}">Due ${esc(shortDate(o.dueDate))}</span>` : ""}
                ${o.tracking ? `<span class="tag">Tracking ${esc(o.tracking)}</span>` : ""}
              </div>
            </div>
            <span class="tag ${esc(o.status)}">${esc(o.status)}</span>
          </div>
          <div class="row-actions">
            <select data-order-status="${o.id}" aria-label="Status for ${esc(o.code)}">
              ${STATUSES.map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <button class="btn ghost" data-payment-toggle="${o.id}">Payment</button>
            <button class="btn ghost" data-order-repeat="${esc(o.id)}">Repeat</button>
            <button class="btn ghost" data-order-edit="${o.id}">Edit</button>
            <button class="btn ghost" data-invoice="${esc(o.id)}">Invoice</button>
            <button class="btn ghost" data-message-order="${esc(o.phone)}">Message</button>
            <a href="https://wa.me/${cleanPhone(o.phone)}?text=${encodeURIComponent("Hello " + o.customerName + ", update on order " + o.code + ".")}" target="_blank" rel="noopener">WhatsApp</a>
            <button class="btn danger-ghost" data-order-delete="${o.id}">Delete</button>
          </div>
          ${detail}
        </div>
      `;
    }).join("");
  }

  /* ---------- Render: customers ---------- */
  function renderCustomers() {
    const query = (document.getElementById("customerSearch").value || "").trim().toLowerCase();
    const list = document.getElementById("customerList");
    const items = state.customers.filter((c) => [c.name, c.phone, c.instagram, c.notes].join(" ").toLowerCase().includes(query));
    if (!items.length) {
      list.innerHTML = '<div class="empty-state">' + (query ? "No customers match that search." : "Add a customer, or save an order to create one automatically.") + '</div>';
      return;
    }
    list.innerHTML = items.map((c) => {
      const balance = customerBalance(c);
      const orders = customerOrders(c);
      return `
        <div class="row ${activeLedgerId === c.id ? "active-ledger" : ""}">
          <div class="row-main">
            <div>
              <div class="row-title">${esc(c.name)}</div>
              <div class="row-sub">${esc(c.phone)}${c.instagram ? " · " + esc(c.instagram) : ""} · ${orders.length} orders</div>
              <div class="customer-meta">${balanceTag(balance)}${c.notes ? '<span class="tag">' + esc(c.notes.slice(0, 28)) + "</span>" : ""}</div>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn ghost" data-message-customer="${esc(c.phone)}">Message</button>
            <button class="btn ghost" data-ledger="${c.id}">Ledger</button>
            ${orders.length ? `<button class="btn ghost" data-repeat-customer="${esc(c.phone)}">Repeat</button>` : ""}
            <button class="btn primary" data-order-for="${esc(c.phone)}">New order</button>
            <button class="btn ghost" data-customer-edit="${c.id}">Edit</button>
            <button class="btn danger-ghost" data-customer-delete="${c.id}">Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  /* ---------- Render: chat ---------- */
  function renderThreads() {
    const box = document.getElementById("threadList");
    if (!state.customers.length) {
      box.innerHTML = '<div class="empty-state">Add a customer or order to start a conversation.</div>';
      return;
    }
    box.innerHTML = state.customers.map((c) => {
      const chat = state.chats[c.phone] || [];
      const last = chat.length ? chat[chat.length - 1].text : "Start the conversation";
      return `
        <button class="thread ${activePhone === c.phone ? "active" : ""}" data-thread="${esc(c.phone)}">
          <span class="avatar">${esc(initials(c.name))}</span>
          <span class="thread-meta">
            <strong>${esc(c.name)}</strong>
            <small>${esc(last.slice(0, 34))}${last.length > 34 ? "…" : ""}</small>
          </span>
        </button>
      `;
    }).join("");
  }

  function renderChat() {
    const messages = document.getElementById("chatMessages");
    const nameEl = document.getElementById("chatName");
    const metaEl = document.getElementById("chatMeta");
    if (!activePhone) {
      nameEl.textContent = "Select a conversation";
      metaEl.textContent = "Choose a customer on the left.";
      messages.innerHTML = '<div class="empty-state">Pick a customer to get started.</div>';
      return;
    }
    const customer = state.customers.find((c) => cleanPhone(c.phone) === cleanPhone(activePhone));
    const order = [...state.orders].reverse().find((o) => cleanPhone(o.phone) === cleanPhone(activePhone));
    nameEl.textContent = customer ? customer.name : activePhone;
    metaEl.textContent = order
      ? `${order.code} · ${money(orderTotal(order))} · ${balanceTag(orderBalance(order)).replace(/<[^>]+>/g, "")}`
      : cleanPhone(activePhone);

    const chat = state.chats[activePhone] || [];
    messages.innerHTML = chat.length ? chat.map((m) => `
      <div class="bubble ${esc(m.from)}">${esc(m.text)}<small>${esc(m.time)}</small></div>
    `).join("") : '<div class="empty-state">No notes yet. Use a template below or type one.</div>';
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(from, text) {
    if (!activePhone || !text.trim()) return;
    if (!state.chats[activePhone]) state.chats[activePhone] = [];
    state.chats[activePhone].push({
      from,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    save();
    renderChat();
    renderThreads();
  }

  /* ---------- Smart draft templates ---------- */
  function draftText(kind, orderOverride) {
    const order = orderOverride || [...state.orders].reverse().find((o) => cleanPhone(o.phone) === cleanPhone(activePhone));
    const customer = (order ? customerFor(order) : null) || state.customers.find((c) => cleanPhone(c.phone) === cleanPhone(activePhone));
    const name = customer ? customer.name : (order ? order.customerName : "there");
    const itemList = order ? itemsSummary(order) : "your items";
    const total = order ? money(orderTotal(order)) : "the agreed amount";
    const balance = order ? orderBalance(order) : 0;
    const balanceLine = balance > 0 ? " Pending balance is " + money(balance) + "." : (balance < 0 ? " You have an advance of " + money(Math.abs(balance)) + "." : " Payment is clear.");
    const dueLine = order && order.dueDate ? " The payment due date was " + prettyDate(order.dueDate) + "." : "";
    const shipBits = order ? [order.courier ? "via " + order.courier : "", order.tracking ? "tracking " + order.tracking : ""].filter(Boolean) : [];
    const shipLine = shipBits.length ? " Shipped " + shipBits.join(" · ") + "." : "";

    if (order && (order.returned || order.cancelled) && ["confirm", "reminder", "dispatch", "delivered"].includes(kind)) {
      return `Hi ${name}, this order is ${order.returned ? "returned" : "cancelled"}, so there is no payment follow-up needed. Let me know if you'd like to place a new order.`;
    }

    const custom = (state.settings.replies || {})[kind];
    if (custom && String(custom).trim()) return fillReply(custom, replyContext(order, customer));

    if (kind === "stock") {
      const first = order && order.items[0];
      const product = first && state.products.find((p) => p.id === first.productId);
      const available = product ? availability(product) : null;
      if (available === null) return uiText(
        `Assalam o alaikum ${name}! Yes, ${itemList} is available. Shall I book it for you?`,
        `Hello ${name}! Yes, ${itemList} is available. Shall I book it for you?`
      );
      return available > 0
        ? uiText(
          `Assalam o alaikum ${name}! Yes, ${product.name} is available — ${available} ${product.unit || "pc"} in stock right now. Shall I book one for you?`,
          `Hello ${name}! Yes, ${product.name} is available — ${available} ${product.unit || "pc"} in stock right now. Shall I book one for you?`
        )
        : uiText(
          `Assalam o alaikum ${name}! Sorry, ${product.name} is currently out of stock. Shall I message you when it arrives?`,
          `Hello ${name}! Sorry, ${product.name} is currently out of stock. Shall I message you when it arrives?`
        );
    }
    if (kind === "quote") {
      return `Hi ${name}, your quote: ${itemList}. Total ${total}${order && num(order.delivery) ? " (including delivery " + money(order.delivery) + ")" : ""}${order && num(order.discount) ? ", discount " + money(order.discount) : ""}. Let me know if you'd like to confirm.`;
    }
    if (kind === "confirm") {
      const dateLine = order && order.dueDate ? " Payment due by " + prettyDate(order.dueDate) + "." : "";
      return `Hi ${name}, your order ${order ? order.code : ""} is confirmed: ${itemList}. Total ${total}. Paid ${order ? money(orderPaid(order)) : money(0)}.${balanceLine}${dateLine} Thank you!`;
    }
    if (kind === "reminder") {
      return uiText(
        `Assalam o alaikum ${name}, a friendly reminder for order ${order ? order.code : ""}:${dueLine} ${balanceLine} You can pay by cash, Easypaisa, JazzCash or bank transfer. JazakAllah khair!`,
        `Hello ${name}, a friendly reminder for order ${order ? order.code : ""}:${dueLine} ${balanceLine} You can pay by cash, Easypaisa, JazzCash or bank transfer. Thank you!`
      );
    }
    if (kind === "dispatch") {
      return `Hi ${name}, your order ${order ? order.code : ""} (${itemList}) has been dispatched.${shipLine} Total ${total}.${balanceLine} I'll share the delivery update soon.`;
    }
    if (kind === "delivered") {
      return uiText(
        `Assalam o alaikum ${name}, your order ${order ? order.code : ""} has been delivered. JazakAllah khair for shopping with us!${balanceLine}`,
        `Hello ${name}, your order ${order ? order.code : ""} has been delivered. Thank you for shopping with us!${balanceLine}`
      );
    }
    if (kind === "followup") {
      return `Hi ${name}, hope you're well! We have new stock available. Would you like me to share the latest list and prices?`;
    }
    return `Hi ${name}, thanks for reaching out about ${itemList}. How can I help you today?`;
  }

  function showTemplate(kind) {
    if (!activePhone) {
      toast("Select a conversation first.", "warn");
      return;
    }
    currentDraft = draftText(kind);
    document.getElementById("aiDraftText").textContent = currentDraft;
    document.getElementById("aiDraftBox").hidden = false;
    document.querySelectorAll("#templateBar .mini-btn").forEach((b) => b.classList.toggle("active", b.dataset.template === kind));
  }

  function replyKindFromMessage(text) {
    const t = String(text || "").toLowerCase();
    if (/\b(available|in stock|stock left|have it)\b/.test(t)) return "stock";
    if (/\b(price|rate|cost|how much|quote|charges)\b/.test(t)) return "quote";
    if (/\b(pending|balance|due|payment|paid|remind)\b/.test(t)) return "reminder";
    if (/\b(dispatched|shipped|shipment|tracking|courier|when will it reach)\b/.test(t)) return "dispatch";
    if (/\b(delivered|received|got it|jazak|thank you)\b/.test(t)) return "delivered";
    if (/\b(order|confirm|book|place|booking)\b/.test(t)) return "confirm";
    return "followup";
  }

  function preparePasteReply() {
    const text = document.getElementById("replyPasteText").value.trim();
    if (!text) {
      toast("Paste the buyer's message first.", "warn");
      return;
    }
    const kind = replyKindFromMessage(text);
    showTemplate(kind);
    if (activePhone) toast("Ready " + REPLY_LABELS[kind].toLowerCase() + " reply — review before sending.");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* fall through */
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (error) { ok = false; }
    area.remove();
    return ok;
  }

  function openWhatsApp(text) {
    if (!activePhone) {
      toast("Select a conversation first.", "warn");
      return;
    }
    window.open("https://wa.me/" + cleanPhone(activePhone) + "?text=" + encodeURIComponent(text || "Hello!"), "_blank", "noopener");
  }

  /* ---------- Actions: products ---------- */
  function saveProduct(event) {
    event.preventDefault();
    const data = {
      name: document.getElementById("pName").value.trim(),
      sku: document.getElementById("pSku").value.trim(),
      price: num(document.getElementById("pPrice").value),
      cost: num(document.getElementById("pCost").value),
      stock: num(document.getElementById("pStock").value),
      low: num(document.getElementById("pLow").value, 3),
      unit: document.getElementById("pUnit").value.trim() || "pc"
    };
    if (!data.name) return;
    const duplicate = state.products.find((p) =>
      p.name.toLowerCase() === data.name.toLowerCase() && p.id !== editingProduct);
    if (duplicate) {
      toast("A product with this name already exists.", "warn");
      return;
    }
    if (editingProduct) {
      const product = state.products.find((p) => p.id === editingProduct);
      if (product) Object.assign(product, data);
      toast("Product updated.");
    } else {
      state.products.push(Object.assign({ id: uid() }, data));
      toast("Product saved.");
    }
    selectedPriceIds = null;
    clearPriceList();
    save();
    resetProductForm();
    renderAll();
  }

  function resetProductForm() {
    document.getElementById("productForm").reset();
    document.getElementById("pLow").value = 3;
    document.getElementById("pUnit").value = "pc";
    editingProduct = null;
    document.getElementById("productFormTitle").textContent = "Add a product";
    document.getElementById("productSubmit").textContent = "Save product";
    document.getElementById("cancelProductEdit").hidden = true;
  }

  /* ---------- Actions: orders ---------- */
  function saveOrder(event) {
    event.preventDefault();
    const items = collectItems();
    if (!items.length) {
      toast("Add at least one item to the order.", "warn");
      return;
    }
    const phone = document.getElementById("oPhone").value.trim();
    if (!validPhone(phone)) {
      toast("Enter a phone number with country code.", "warn");
      return;
    }
    const oldItems = editingOrder ? [...(editingOrder.items || [])] : [];
    if (editingOrder && STOCK_CONSUMING.includes(editingOrder.status)) {
      if (!canApplyConsumingEdit(oldItems, items, editingOrder.id)) {
        toast("Not enough available stock for these changes.", "warn");
        return;
      }
    } else if (!canConsumeItems(items, editingOrder ? editingOrder.id : null)) {
      toast("Not enough available stock for this order.", "warn");
      return;
    }

    const name = document.getElementById("oCustomer").value.trim() || "Customer";
    let customer = state.customers.find((c) => cleanPhone(c.phone) === cleanPhone(phone));
    if (!customer) {
      customer = { id: uid(), name, phone, instagram: document.getElementById("oInstagram").value.trim(), notes: "", payments: [], createdAt: todayISO() };
      state.customers.push(customer);
    } else {
      if (!Array.isArray(customer.payments)) customer.payments = [];
      customer.name = name;
      customer.instagram = document.getElementById("oInstagram").value.trim() || customer.instagram;
    }

    const paidNow = num(document.getElementById("oPaid").value);
    const payments = editingOrder ? [...(editingOrder.payments || [])] : [];
    if (paidNow > 0) {
      payments.push({
        id: uid(), amount: paidNow, method: document.getElementById("oMethod").value,
        note: "With order", date: todayISO()
      });
    }

    const data = {
      customerId: customer.id,
      customerName: name,
      phone,
      instagram: customer.instagram || "",
      source: document.getElementById("oSource").value,
      date: dateField("orderDate"),
      items,
      discount: num(document.getElementById("oDiscount").value),
      delivery: num(document.getElementById("oDelivery").value),
      payments,
      dueDate: document.getElementById("oDueDate").value || "",
      courier: document.getElementById("oCourier").value.trim(),
      tracking: document.getElementById("oTracking").value.trim(),
      address: document.getElementById("oAddress").value.trim(),
      notes: document.getElementById("oNotes").value.trim(),
      updatedAt: todayISO()
    };

    if (editingOrder) {
      if (STOCK_CONSUMING.includes(editingOrder.status)) applyConsumingEdit(oldItems, items);
      Object.assign(editingOrder, data);
      toast("Order updated.");
    } else {
      const newOrder = Object.assign({
        id: uid(),
        code: "SM-" + state.settings.nextCode++,
        status: "New",
        dispatched: false,
        returned: false,
        cancelled: false
      }, data);
      state.orders.push(newOrder);
      if (!state.chats[phone]) state.chats[phone] = [];
      toast("Order saved.");
    }
    save();
    resetOrderForm();
    renderAll();
  }

  function startOrderEdit(id) {
    const order = state.orders.find((o) => o.id === id);
    if (!order) return;
    editingOrder = order;
    document.getElementById("oCustomer").value = order.customerName;
    document.getElementById("oPhone").value = order.phone;
    document.getElementById("oInstagram").value = order.instagram || "";
    document.getElementById("oSource").value = order.source || "WhatsApp";
    document.getElementById("oDiscount").value = num(order.discount);
    document.getElementById("oDelivery").value = num(order.delivery);
    document.getElementById("oPaid").value = 0;
    const dateInput = document.getElementById("orderDate");
    if (dateInput) dateInput.value = order.date || todayISO();
    document.getElementById("oDueDate").value = order.dueDate || "";
    document.getElementById("oCourier").value = order.courier || "";
    document.getElementById("oTracking").value = order.tracking || "";
    document.getElementById("oAddress").value = order.address || "";
    document.getElementById("oNotes").value = order.notes || "";
    document.getElementById("itemRows").innerHTML = "";
    (order.items || []).forEach((item) => addItemRow(item));
    addItemRow(null);
    renderProductOptions();
    document.getElementById("orderFormTitle").textContent = "Edit " + order.code;
    document.getElementById("orderSubmit").textContent = "Update order";
    document.getElementById("cancelOrderEdit").hidden = false;
    updateTotals();
    switchView("orders");
  }

  function changeStatus(id, next) {
    const order = state.orders.find((o) => o.id === id);
    if (!order || order.status === next || !STATUSES.includes(next)) return;
    const previous = order.status;
    const wasConsuming = STOCK_CONSUMING.includes(previous);
    const willConsume = STOCK_CONSUMING.includes(next);

    if (!wasConsuming && willConsume && !canConsumeItems(order.items, order.id)) {
      toast("Not enough available stock for this order.", "warn");
      renderOrders();
      return;
    }
    if (wasConsuming && !willConsume) applyStockDelta(order.items, 1);
    if (!wasConsuming && willConsume) applyStockDelta(order.items, -1);

    order.status = next;
    order.dispatched = willConsume;
    order.returned = next === "Returned";
    order.cancelled = next === "Cancelled";
    order.updatedAt = todayISO();
    save();
    renderAll();
    toast("Status changed to " + next + ".");
  }

  function addPayment(id) {
    const row = document.querySelector('[data-payment-add="' + id + '"]');
    const order = state.orders.find((o) => o.id === id);
    if (!row || !order) return;
    const container = row.closest(".pay-form");
    const amount = num(container.querySelector(".pay-amount").value);
    if (amount <= 0) {
      toast("Enter a payment amount.", "warn");
      return;
    }
    const before = orderBalance(order);
    order.payments.push({
      id: uid(), amount,
      method: container.querySelector(".pay-method").value,
      note: container.querySelector(".pay-note").value.trim(),
      date: todayISO()
    });
    save();
    renderAll();
    toast(amount > before && before >= 0 ? "Advance recorded." : "Payment recorded.");
  }

  function invoiceText(order) {
    const lines = [
      (state.settings.shopName || "My Shop").toUpperCase(),
      "Order: " + (order.code || "—") + "   Date: " + prettyDate(order.date),
      "Customer: " + (order.customerName || "Customer"),
      order.phone ? "Phone: " + order.phone : "",
      order.address ? "Address: " + order.address : "",
      "",
      "Items"
    ];
    (order.items || []).forEach((i) => {
      lines.push(num(i.qty) + " × " + i.name + " @ " + money(i.price) + " = " + money(num(i.qty) * num(i.price)));
    });
    lines.push(
      "",
      "Subtotal: " + money(orderSubtotal(order)),
      "Discount: " + money(order.discount),
      "Delivery: " + money(order.delivery),
      "Total: " + money(orderTotal(order)),
      "Paid: " + money(orderPaid(order)),
      "Balance: " + money(orderBalance(order)),
      "Status: " + (order.status || "New")
    );
    if (order.notes) lines.push("", "Notes: " + order.notes);
    lines.push("", "Thank you for shopping with us!");
    return lines.filter((line) => line !== null && line !== undefined).join("\n");
  }

  function openInvoice(id) {
    const order = state.orders.find((o) => o.id === id);
    if (!order) return;
    const itemRows = (order.items || []).map((i) => `
      <tr>
        <td>${esc(i.name)}${i.sku ? " <small>" + esc(i.sku) + "</small>" : ""}</td>
        <td class="num">${num(i.qty)}</td>
        <td class="num">${esc(money(i.price))}</td>
        <td class="num">${esc(money(num(i.qty) * num(i.price)))}</td>
      </tr>
    `).join("");
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Invoice ${esc(order.code || "")}</title>
<style>
  body { font: 14px/1.5 Arial, sans-serif; color: #27313b; margin: 0; padding: 28px; background: #fff; }
  .sheet { max-width: 720px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 22px; color: #146b52; }
  h2 { margin: 0 0 18px; font-size: 15px; font-weight: 400; color: #6b6f68; }
  .meta { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
  .meta div { flex: 1; }
  .meta small { display: block; color: #6b6f68; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  th, td { padding: 9px 8px; border-bottom: 1px solid #e6e1d6; text-align: left; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b6f68; }
  td.num, th.num { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 17px; border-top: 2px solid #27313b; margin-top: 6px; padding-top: 9px; }
  .note { margin-top: 22px; color: #6b6f68; }
  .no-print { max-width: 720px; margin: 0 auto 18px; display: flex; gap: 8px; }
  button { font: inherit; padding: 9px 14px; border: 1px solid #146b52; border-radius: 8px; background: #146b52; color: #fff; cursor: pointer; }
  button.ghost { background: #fff; color: #146b52; }
  textarea { display: none; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style></head><body>
<div class="no-print">
  <button onclick="window.print()">Print / Save PDF</button>
  <button class="ghost" onclick="copyInvoice()">Copy text</button>
  <button class="ghost" onclick="window.close()">Close</button>
</div>
<div class="sheet">
  <h1>${esc(state.settings.shopName || "My Shop")}</h1>
  <h2>SellMate invoice</h2>
  <div class="meta">
    <div><small>Order</small><strong>${esc(order.code || "—")}</strong></div>
    <div><small>Date</small><strong>${esc(prettyDate(order.date))}</strong></div>
    <div><small>Status</small><strong>${esc(order.status || "New")}</strong></div>
  </div>
  <div class="meta">
    <div><small>Customer</small><strong>${esc(order.customerName || "Customer")}</strong></div>
    <div><small>Phone</small><strong>${esc(order.phone || "—")}</strong></div>
  </div>
  ${order.address ? '<p><small>Address</small><br />' + esc(order.address) + '</p>' : ""}
  <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
  <tbody>${itemRows || '<tr><td colspan="4">No items.</td></tr>'}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${esc(money(orderSubtotal(order)))}</span></div>
    <div><span>Discount</span><span>${esc(money(order.discount))}</span></div>
    <div><span>Delivery</span><span>${esc(money(order.delivery))}</span></div>
    <div class="grand"><span>Total</span><span>${esc(money(orderTotal(order)))}</span></div>
    <div><span>Paid</span><span>${esc(money(orderPaid(order)))}</span></div>
    <div><span>Balance</span><span>${esc(money(orderBalance(order)))}</span></div>
  </div>
  ${order.notes ? '<p class="note"><strong>Notes:</strong> ' + esc(order.notes) + '</p>' : ""}
  <p class="note">Thank you for shopping with us!</p>
</div>
<textarea id="invoiceText">${esc(invoiceText(order))}</textarea>
<script>
function copyInvoice() {
  var t = document.getElementById('invoiceText');
  var fallback = function () {
    t.style.display = 'block'; t.focus(); t.select();
    var done = false;
    try { done = document.execCommand('copy'); } catch (e) {}
    t.style.display = 'none';
    alert(done ? 'Invoice text copied.' : 'Select the invoice text and copy it manually.');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t.value).then(function () { alert('Invoice text copied.'); }).catch(fallback);
  } else fallback();
}
</script></body></html>`;
    const win = window.open("", "_blank");
    if (!win) { toast("Allow pop-ups to open the invoice.", "warn"); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  /* ---------- Actions: customers ---------- */
  function saveCustomer(event) {
    event.preventDefault();
    const phone = document.getElementById("cPhone").value.trim();
    if (!validPhone(phone)) {
      toast("Enter a phone number with country code.", "warn");
      return;
    }
    const duplicate = state.customers.find((c) =>
      cleanPhone(c.phone) === cleanPhone(phone) && c.id !== editingCustomer);
    if (duplicate) {
      toast("A customer with this phone already exists.", "warn");
      return;
    }
    const data = {
      name: document.getElementById("cName").value.trim() || "Customer",
      phone,
      instagram: document.getElementById("cInstagram").value.trim(),
      notes: document.getElementById("cNotes").value.trim()
    };
    if (editingCustomer) {
      const customer = state.customers.find((c) => c.id === editingCustomer);
      if (customer) Object.assign(customer, data);
      state.orders.filter((o) => cleanPhone(o.phone) === cleanPhone(phone)).forEach((o) => { o.customerName = data.name; });
      toast("Customer updated.");
    } else {
      state.customers.push(Object.assign({ id: uid(), payments: [], createdAt: todayISO() }, data));
      toast("Customer saved.");
    }
    save();
    resetCustomerForm();
    renderAll();
  }

  function resetCustomerForm() {
    document.getElementById("customerForm").reset();
    editingCustomer = null;
    document.getElementById("customerFormTitle").textContent = "Add a customer";
    document.getElementById("customerSubmit").textContent = "Save customer";
    document.getElementById("cancelCustomerEdit").hidden = true;
  }

  /* ---------- Backup / settings ---------- */
  function exportBackup() {
    state.settings.lastBackupAt = new Date().toISOString();
    state.settings.backupSnoozedAt = null;
    save();
    const data = { app: "SellMate", version: 2, createdAt: state.settings.lastBackupAt, ...state };
    triggerDownload("SellMate-backup-" + todayISO() + ".json", new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    renderBackupNotice();
    toast("Backup downloaded.");
  }

  function importBackup(file) {
    const input = document.getElementById("restoreFile");
    const finish = () => { if (input) input.value = ""; };
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== "object" || !Array.isArray(data.products) ||
            !Array.isArray(data.customers) || !Array.isArray(data.orders) || !Array.isArray(data.expenses)) {
          throw new Error("invalid");
        }
        const restored = normalizeState(data);
        if (!askConfirm("Restore this backup? Current data will be replaced.")) return;
        state = restored;
        activePhone = null;
        paymentOpenId = null;
        activeLedgerId = null;
        activeSupplierId = null;
        editingSupplier = null;
        editingProduct = editingOrder = editingCustomer = null;
        selectedPriceIds = null;
        selectedFollowups = new Set();
        clearDraft();
        clearPriceList();
        resetReportOutputs();
        resetProductForm();
        resetOrderForm();
        resetCustomerForm();
        save();
        applySettings();
        renderReplyTemplates();
        renderAll();
        toast("Backup restored.");
      } catch (error) {
        toast("That file is not a valid SellMate backup.", "warn");
      } finally {
        finish();
      }
    };
    reader.onerror = () => { toast("Could not read that file.", "warn"); finish(); };
    reader.onabort = () => { finish(); };
    reader.readAsText(file);
  }

  function syncLanguageControls() {
    const lang = window.SellMateLang ? window.SellMateLang.get() : "ur";
    const english = lang === "en";
    document.querySelectorAll("[data-lang-code]").forEach((el) => { el.textContent = lang.toUpperCase(); });
    const skip = document.querySelector(".skip-link");
    if (skip) skip.textContent = uiText("Main par jayein", "Skip to main content");
    document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
      const action = english
        ? uiText("Roman Urdu par switch karein", "Switch to Roman Urdu")
        : uiText("English par switch karein", "Switch to English");
      btn.setAttribute("title", action);
      btn.setAttribute("aria-label", lang.toUpperCase() + " — " + action);
    });
    const placeholders = {
      pName: ["e.g. Blue kurta", "e.g. Blue shirt"],
      pasteText: [
        "e.g. Assalam o alaikum, I need 2 Blue kurta and 1 Black kurta. My number is 923001234567",
        "e.g. Hello, I need 2 Blue shirts and 1 Black shirt. My number is 923001234567"
      ],
      replyPasteText: [
        "e.g. Is the blue kurta available? What is the price?",
        "e.g. Is the blue shirt available? What is the price?"
      ]
    };
    Object.entries(placeholders).forEach(([id, pair]) => {
      const el = document.getElementById(id);
      if (el) el.placeholder = english ? pair[1] : pair[0];
    });
    if (state.settings.language !== lang) {
      state.settings.language = lang;
      save();
    }
    const appShell = document.getElementById("appShell");
    if (appShell && !appShell.hidden) renderAll();
  }

  function applySettings() {
    syncLanguageControls();
    const theme = readThemePreference() || state.settings.theme;
    const light = theme !== "dark";
    document.documentElement.dataset.theme = light ? "light" : "dark";
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = light ? "#fbf8f1" : "#050605";
    const shop = state.settings.shopName || "My Shop";
    document.getElementById("shopName").value = shop;
    document.getElementById("shopChip").textContent = shop;
    const acct = document.getElementById("accountName"); if (acct) acct.textContent = shop;
    const hour = new Date().getHours();
    const greet = hour < 12
      ? uiText("Good morning", "Good morning")
      : hour < 17 ? uiText("Good afternoon", "Good afternoon") : uiText("Good evening", "Good evening");
    document.getElementById("greeting").textContent = greet + ", " + shop;
    document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  function renderAll() {
    renderMetrics();
    renderRecent();
    renderStockWatch();
    renderPendingPayments();
    renderPipeline();
    renderProducts();
    renderOrders();
    renderCustomers();
    renderThreads();
    renderChat();
    renderExpenses();
    renderFollowups();
    renderLedger();
    renderSuppliers();
    renderSupplierLedger();
    renderBackupNotice();
    renderPriceProducts();
    updateTotals();
  }

  function renderExpenses() {
    const list = document.getElementById("expenseList");
    if (!state.expenses.length) {
      list.innerHTML = '<div class="empty-state">No expenses recorded.</div>';
      return;
    }
    const total = totals();
    list.innerHTML = [...state.expenses].reverse().map((e) => `
      <div class="row">
        <div class="row-main">
          <div><div class="row-title">${esc(e.name)} — ${money(e.amount)}</div><div class="row-sub">${esc(e.category || "Other")} · ${esc(prettyDate(e.date))}</div></div>
          <button class="btn danger-ghost" data-expense-delete="${e.id}">Delete</button>
        </div>
      </div>
    `).join("") + `<div class="row"><div class="row-main"><div><div class="row-title">Delivered sales ${money(total.sales)}</div><div class="row-sub">Costs and expenses subtracted</div></div><strong>${money(total.profit)}</strong></div></div>`;
  }

  /* ---------- Backup reminder ---------- */
  function renderBackupNotice() {
    const notice = document.getElementById("backupNotice");
    const last = state.settings.lastBackupAt || null;
    let show = !last;
    let message = "Back up your shop data so it stays safe if this device is cleared.";
    if (last) {
      const days = daysSince(last);
      if (days >= 7) {
        show = true;
        message = "It's been " + days + " days since your last backup. Download a fresh copy.";
      }
    }
    if (show && state.settings.backupSnoozedAt && daysSince(state.settings.backupSnoozedAt) < 3) show = false;
    notice.hidden = !show;
    document.getElementById("backupNoticeText").textContent = message;
    document.getElementById("lastBackupLabel").textContent = last ? "Last backup: " + prettyDate(last) : "No backup downloaded yet.";
  }

  function snoozeBackup() {
    state.settings.backupSnoozedAt = todayISO();
    save();
    renderBackupNotice();
  }

  /* ---------- Follow-up queue ---------- */
  function renderFollowups() {
    const box = document.getElementById("followupList");
    const items = followupOrders();
    const valid = new Set(items.map((o) => o.id));
    [...selectedFollowups].forEach((id) => { if (!valid.has(id)) selectedFollowups.delete(id); });
    const selectAll = document.getElementById("selectAllFollowups");
    if (selectAll) selectAll.textContent = items.length && items.every((o) => selectedFollowups.has(o.id)) ? "Clear selection" : "Select all";
    if (!items.length) {
      box.innerHTML = '<div class="empty-state">Nothing due. Set a payment due date on an order to see it here.</div>';
      return;
    }
    box.innerHTML = items.map((o) => {
      const overdue = o.dueDate < todayISO();
      return `
        <div class="row">
          <label class="followup-check" title="Select for bulk follow-up">
            <input type="checkbox" data-followup-check="${esc(o.id)}" ${selectedFollowups.has(o.id) ? "checked" : ""} aria-label="Select ${esc(o.customerName)}" />
          </label>
          <div class="row-main">
            <div>
              <div class="row-title">${esc(o.customerName)} · ${esc(o.code)}</div>
              <div class="row-sub">${esc(itemsSummary(o))}</div>
              <div class="customer-meta">
                <span class="tag ${overdue ? "balance-due" : ""}">${overdue ? "Overdue" : "Due"} ${esc(shortDate(o.dueDate))}</span>
                ${balanceTag(orderBalance(o))}
              </div>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn ghost" data-followup-pay="${esc(o.id)}">Record payment</button>
            <button class="btn primary" data-followup-message="${esc(o.phone)}">Message</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function reminderForOrder(order) {
    return draftText("reminder", order);
  }

  function toggleAllFollowups() {
    const items = followupOrders();
    if (!items.length) return;
    const allSelected = items.every((o) => selectedFollowups.has(o.id));
    selectedFollowups = new Set(allSelected ? [] : items.map((o) => o.id));
    renderFollowups();
  }

  function bulkFollowup() {
    const orders = followupOrders().filter((o) => selectedFollowups.has(o.id));
    if (!orders.length) {
      toast("Select customers in the follow-up queue first.", "warn");
      return;
    }
    if (orders.length > 3 && !askConfirm("Open WhatsApp for " + orders.length + " customers? Allow pop-ups if your browser asks.")) return;
    orders.forEach((o) => openWhatsAppTo(o.phone, reminderForOrder(o)));
    toast("Opening " + orders.length + " WhatsApp chat" + (orders.length === 1 ? "" : "s") + ".");
  }

  function openChatForPhone(phone) {
    if (!phone) return;
    activePhone = phone;
    clearDraft();
    renderThreads();
    renderChat();
    switchView("chat");
  }

  /* ---------- One-tap repeat order ---------- */
  function startRepeatOrder(order) {
    if (!order) return;
    resetOrderForm();
    document.getElementById("oCustomer").value = order.customerName || "";
    document.getElementById("oPhone").value = order.phone || "";
    document.getElementById("oInstagram").value = order.instagram || "";
    document.getElementById("oSource").value = order.source || "WhatsApp";
    document.getElementById("oDiscount").value = num(order.discount);
    document.getElementById("oDelivery").value = num(order.delivery);
    document.getElementById("oPaid").value = 0;
    document.getElementById("oDueDate").value = "";
    document.getElementById("oCourier").value = "";
    document.getElementById("oTracking").value = "";
    document.getElementById("oAddress").value = order.address || "";
    document.getElementById("oNotes").value = order.notes || "";
    document.getElementById("itemRows").innerHTML = "";
    (order.items || []).forEach((item) => addItemRow({ name: item.name, qty: item.qty, price: item.price, cost: item.cost }));
    addItemRow(null);
    renderProductOptions();
    updateTotals();
    switchView("orders");
    toast("Order loaded — review and save when ready.");
  }

  /* ---------- Paste-from-chat order builder ---------- */
  function parseBuyerMessage() {
    const raw = document.getElementById("pasteText").value || "";
    if (!raw.trim()) {
      toast("Paste a buyer message first.", "warn");
      return;
    }
    let work = raw;
    let phone = "";
    const runs = work.match(/\+?\d[\d\s\-()]{7,}\d/g) || [];
    for (const run of runs) {
      const cleaned = cleanPhone(run);
      if (cleaned.length >= 10) {
        phone = cleaned;
        work = work.replace(run, " ");
        break;
      }
    }
    let customer = phone ? state.customers.find((c) => cleanPhone(c.phone) === phone) : null;
    let name = customer ? customer.name : "";
    const nameMatch = work.match(/(?:my name is|name\s*[:=]|this is|from)\s+([A-Za-z][\w' -]{1,28})/i);
    if (!name && nameMatch) {
      const guess = nameMatch[1].trim().replace(/\s+/g, " ");
      const named = state.customers.find((c) => c.name.toLowerCase() === guess.toLowerCase());
      if (named) {
        customer = named;
        if (!phone) phone = named.phone;
      }
      name = named ? named.name : guess;
    }
    const handleMatch = work.match(/@[A-Za-z0-9._]+/);
    const instagram = customer ? (customer.instagram || "") : (handleMatch ? handleMatch[0] : "");

    const lower = work.toLowerCase();
    const items = [];
    for (const product of state.products) {
      const key = String(product.name || "").toLowerCase().trim();
      if (!key) continue;
      const idx = lower.indexOf(key);
      if (idx < 0) continue;
      let qty = 1;
      const before = lower.slice(Math.max(0, idx - 14), idx).match(/(\d{1,3})\s*(?:x\s*)?$/);
      if (before) qty = num(before[1], 1);
      const after = lower.slice(idx + key.length, idx + key.length + 12).match(/^\s*(?:x|×)\s*(\d{1,3})/);
      if (after) qty = num(after[1], 1);
      items.push({ name: product.name, productId: product.id, qty, price: num(product.price), cost: num(product.cost) });
    }

    parsedPaste = { phone, name, instagram, items };
    renderPasteResult();
  }

  function renderPasteResult() {
    const box = document.getElementById("pasteResult");
    if (!parsedPaste) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const p = parsedPaste;
    box.innerHTML = `
      <strong>Suggested from your message</strong>
      <p class="field-hint">Customer: ${esc(p.name || (p.phone ? "From message" : "Not detected"))}${p.phone ? " · " + esc(p.phone) : ""}</p>
      <p class="field-hint">Items: ${p.items.length ? esc(p.items.map((i) => num(i.qty) + " × " + i.name).join(", ")) : "No catalogue items detected — add products first, or fill the form manually."}</p>
      <div class="row-actions"><button class="btn primary" data-paste-use>Fill order form →</button></div>
    `;
    box.hidden = false;
  }

  function applyPaste() {
    if (!parsedPaste) return;
    resetOrderForm();
    const p = parsedPaste;
    if (p.name) document.getElementById("oCustomer").value = p.name;
    if (p.phone) document.getElementById("oPhone").value = p.phone;
    if (p.instagram) document.getElementById("oInstagram").value = p.instagram;
    document.getElementById("itemRows").innerHTML = "";
    p.items.forEach((item) => addItemRow(item));
    addItemRow(null);
    renderProductOptions();
    updateTotals();
    toast("Order form filled — please review and save.");
    document.getElementById("orderForm").scrollIntoView({ behavior: "auto", block: "start" });
  }

  /* ---------- Customer ledger / khata ---------- */
  function ledgerEvents(customer) {
    const events = [];
    customerOrders(customer).filter((o) => !o.cancelled && !o.returned).forEach((o) => {
      events.push({ date: o.date, kind: "order", title: o.code + " · " + itemsSummary(o), amount: orderTotal(o), note: o.status });
      (o.payments || []).forEach((p) => events.push({ date: p.date, kind: "payment", title: p.method, amount: -num(p.amount), note: p.note || "Payment against " + o.code }));
    });
    (customer.payments || []).forEach((p) => events.push({ date: p.date, kind: "payment", title: p.method, amount: -num(p.amount), note: p.note || "Unallocated payment" }));
    events.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    let running = 0;
    events.forEach((e) => { running += e.amount; e.balance = running; });
    return events;
  }

  function renderLedger() {
    const panel = document.getElementById("ledgerPanel");
    const customer = activeLedgerId ? state.customers.find((c) => c.id === activeLedgerId) : null;
    if (!customer) {
      panel.hidden = true;
      return;
    }
    const events = ledgerEvents(customer);
    const orders = events.filter((e) => e.kind === "order");
    const billed = orders.reduce((s, e) => s + e.amount, 0);
    const received = events.filter((e) => e.kind === "payment").reduce((s, e) => s - e.amount, 0);
    const balance = customerBalance(customer);
    document.getElementById("ledgerTitle").textContent = customer.name + " · Ledger";
    document.getElementById("ledgerSummary").innerHTML = `
      <div class="total-item">Orders<strong>${orders.length}</strong></div>
      <div class="total-item">Billed<strong>${money(billed)}</strong></div>
      <div class="total-item">Received<strong>${money(received)}</strong></div>
      <div class="total-item ${balance > 0 ? "due" : "accent"}">Balance<strong>${money(balance)}</strong></div>
    `;
    document.getElementById("ledgerTimeline").innerHTML = events.length ? events.map((e) => `
      <div class="row">
        <div class="row-main">
          <div>
            <div class="row-title">${e.kind === "order" ? "Order / billed" : "Payment / received"}</div>
            <div class="row-sub">${esc(shortDate(e.date))} · ${esc(e.title)}${e.note ? " · " + esc(e.note) : ""}</div>
          </div>
          <strong class="${e.kind === "order" ? "ledger-debit" : "ledger-credit"}">${e.kind === "order" ? "+" : "−"} ${money(Math.abs(e.amount))}</strong>
        </div>
        <div class="row-sub ledger-running">Running balance: ${money(e.balance)}</div>
      </div>
    `).join("") : `<div class="empty-state">${uiText(
      "No ledger entries yet. Save an order for this customer to start the khata.",
      "No ledger entries yet. Save an order for this customer to start the ledger."
    )}</div>`;
    panel.hidden = false;
  }

  function recordLedgerPayment() {
    const customer = activeLedgerId ? state.customers.find((c) => c.id === activeLedgerId) : null;
    if (!customer) return;
    const amount = num(document.getElementById("ledgerAmount").value);
    if (amount <= 0) {
      toast("Enter a payment amount.", "warn");
      return;
    }
    const method = document.getElementById("ledgerMethod").value;
    const note = document.getElementById("ledgerNote").value.trim();
    let left = amount;
    const owed = customerOrders(customer)
      .filter((o) => !o.cancelled && !o.returned && orderBalance(o) > 0)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    for (const order of owed) {
      if (left <= 0) break;
      const pay = Math.min(left, orderBalance(order));
      order.payments.push({ id: uid(), amount: pay, method, note: note || "Ledger payment", date: todayISO() });
      left -= pay;
    }
    if (!Array.isArray(customer.payments)) customer.payments = [];
    if (left > 0 || !owed.length) {
      customer.payments.push({ id: uid(), amount: left > 0 ? left : amount, method, note: note || "Unallocated payment", date: todayISO() });
    }
    save();
    document.getElementById("ledgerAmount").value = "";
    document.getElementById("ledgerNote").value = "";
    renderAll();
    toast("Payment recorded in ledger.");
  }

  function statementText(customer) {
    const events = ledgerEvents(customer);
    const balance = customerBalance(customer);
    const lines = ["*" + (state.settings.shopName || "My Shop") + " — Account Statement*", "Customer: " + customer.name + " · " + customer.phone, ""];
    events.forEach((e) => {
      lines.push(shortDate(e.date) + "  " + (e.kind === "order" ? "Billed " : "Received ") + e.title + "  " + money(Math.abs(e.amount)) + "  →  " + money(e.balance));
    });
    if (!events.length) lines.push("No entries yet.");
    lines.push("", "Total " + (balance >= 0 ? "due" : "advance") + ": " + money(Math.abs(balance)), "Thank you!");
    return lines.join("\n");
  }

  async function shareStatement(viaWhatsApp) {
    const customer = activeLedgerId ? state.customers.find((c) => c.id === activeLedgerId) : null;
    if (!customer) return;
    const text = statementText(customer);
    if (viaWhatsApp) {
      openWhatsAppTo(customer.phone, text);
      return;
    }
    const ok = await copyText(text);
    toast(ok ? "Statement copied." : "Copy failed — select the text manually.", ok ? "ok" : "warn");
  }

  /* ---------- Supplier khata ---------- */
  function supplierBalanceTag(value) {
    if (value > 0) return '<span class="tag balance-due">Owe ' + money(value) + "</span>";
    if (value < 0) return '<span class="tag balance-advance">Advance ' + money(Math.abs(value)) + "</span>";
    return '<span class="tag balance-clear">Clear</span>';
  }

  function renderSuppliers() {
    const list = document.getElementById("supplierList");
    if (!state.suppliers.length) {
      list.innerHTML = '<div class="empty-state">No suppliers yet. Add one to track what you owe.</div>';
      return;
    }
    list.innerHTML = state.suppliers.map((s) => {
      const balance = supplierBalance(s);
      return `
        <div class="row ${activeSupplierId === s.id ? "active-ledger" : ""}">
          <div class="row-main">
            <div>
              <div class="row-title">${esc(s.name)}</div>
              <div class="row-sub">${esc(s.phone || "No number")} · ${(s.bills || []).length} bills · ${(s.payments || []).length} payments</div>
              ${s.notes ? '<div class="row-sub">' + esc(s.notes.slice(0, 40)) + "</div>" : ""}
            </div>
            ${supplierBalanceTag(balance)}
          </div>
          <div class="row-actions">
            <button class="btn ghost" data-supplier-ledger="${s.id}">Ledger</button>
            ${s.phone ? `<button class="btn ghost" data-supplier-message="${esc(s.phone)}">Message</button>` : ""}
            <button class="btn ghost" data-supplier-edit="${s.id}">Edit</button>
            <button class="btn danger-ghost" data-supplier-delete="${s.id}">Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderSupplierLedger() {
    const panel = document.getElementById("supplierLedger");
    const supplier = activeSupplierId ? state.suppliers.find((s) => s.id === activeSupplierId) : null;
    if (!supplier) {
      panel.hidden = true;
      return;
    }
    const events = supplierEvents(supplier);
    const billed = (supplier.bills || []).reduce((sum, b) => sum + num(b.amount), 0);
    const paid = (supplier.payments || []).reduce((sum, p) => sum + num(p.amount), 0);
    const balance = supplierBalance(supplier);
    document.getElementById("supplierLedgerTitle").textContent = supplier.name + " · Ledger";
    document.getElementById("supplierSummary").innerHTML = `
      <div class="total-item">Bills<strong>${money(billed)}</strong></div>
      <div class="total-item">Paid<strong>${money(paid)}</strong></div>
      <div class="total-item ${balance > 0 ? "due" : "accent"}">Balance<strong>${balance >= 0 ? money(balance) : "Advance " + money(Math.abs(balance))}</strong></div>
    `;
    document.getElementById("supplierTimeline").innerHTML = events.length ? events.map((e) => `
      <div class="row">
        <div class="row-main">
          <div>
            <div class="row-title">${e.kind === "bill" ? "Bill / you owe" : "Payment / you paid"}</div>
            <div class="row-sub">${esc(shortDate(e.date))} · ${esc(e.title)}${e.method ? " · " + esc(e.method) : ""}</div>
          </div>
          <strong class="${e.kind === "bill" ? "ledger-debit" : "ledger-credit"}">${e.kind === "bill" ? "+" : "−"} ${money(Math.abs(e.amount))}</strong>
        </div>
        <div class="row-sub ledger-running">Running balance: ${money(e.balance)}</div>
      </div>
    `).join("") : '<div class="empty-state">No entries yet. Add a bill or a payment below.</div>';
    panel.hidden = false;
  }

  function openSupplier(id) {
    if (!state.suppliers.some((s) => s.id === id)) return;
    activeSupplierId = id;
    renderSuppliers();
    renderSupplierLedger();
    document.getElementById("supplierLedger").scrollIntoView({ behavior: "auto", block: "start" });
  }

  function saveSupplier(event) {
    event.preventDefault();
    const data = {
      name: document.getElementById("sName").value.trim(),
      phone: document.getElementById("sPhone").value.trim(),
      notes: document.getElementById("sNotes").value.trim()
    };
    if (!data.name) return;
    if (editingSupplier) {
      const supplier = state.suppliers.find((s) => s.id === editingSupplier);
      if (supplier) Object.assign(supplier, data);
      toast("Supplier updated.");
    } else {
      state.suppliers.push(Object.assign({ id: uid(), bills: [], payments: [] }, data));
      toast("Supplier saved.");
    }
    save();
    resetSupplierForm();
    renderAll();
  }

  function resetSupplierForm() {
    document.getElementById("supplierForm").reset();
    editingSupplier = null;
    document.getElementById("supplierSubmit").textContent = "Save supplier";
    document.getElementById("cancelSupplierEdit").hidden = true;
  }

  function addSupplierBill() {
    const supplier = activeSupplierId ? state.suppliers.find((s) => s.id === activeSupplierId) : null;
    if (!supplier) return;
    const amount = num(document.getElementById("supplierBillAmount").value);
    if (amount <= 0) {
      toast("Enter a bill amount.", "warn");
      return;
    }
    supplier.bills.push({
      id: uid(), amount,
      note: document.getElementById("supplierBillNote").value.trim() || "Bill",
      date: todayISO()
    });
    save();
    document.getElementById("supplierBillAmount").value = "";
    document.getElementById("supplierBillNote").value = "";
    renderAll();
    toast(uiText("Bill added to supplier khata.", "Bill added to supplier ledger."));
  }

  function addSupplierPayment() {
    const supplier = activeSupplierId ? state.suppliers.find((s) => s.id === activeSupplierId) : null;
    if (!supplier) return;
    const amount = num(document.getElementById("supplierPayAmount").value);
    if (amount <= 0) {
      toast("Enter a paid amount.", "warn");
      return;
    }
    supplier.payments.push({
      id: uid(), amount,
      method: document.getElementById("supplierPayMethod").value,
      note: document.getElementById("supplierPayNote").value.trim(),
      date: todayISO()
    });
    save();
    document.getElementById("supplierPayAmount").value = "";
    document.getElementById("supplierPayNote").value = "";
    renderAll();
    toast(uiText("Payment recorded in supplier khata.", "Payment recorded in supplier ledger."));
  }

  function deleteSupplier() {
    const supplier = activeSupplierId ? state.suppliers.find((s) => s.id === activeSupplierId) : null;
    if (!supplier) return;
    if (!askConfirm(uiText(
      "Delete " + supplier.name + " and their khata entries?",
      "Delete " + supplier.name + " and their ledger entries?"
    ))) return;
    state.suppliers = state.suppliers.filter((s) => s.id !== supplier.id);
    if (editingSupplier === supplier.id) resetSupplierForm();
    activeSupplierId = null;
    save();
    renderAll();
    toast("Supplier deleted.");
  }

  async function shareSupplierStatement(viaWhatsApp) {
    const supplier = activeSupplierId ? state.suppliers.find((s) => s.id === activeSupplierId) : null;
    if (!supplier) return;
    const text = supplierStatement(supplier);
    if (viaWhatsApp) {
      openWhatsAppTo(supplier.phone, text);
      return;
    }
    const ok = await copyText(text);
    toast(ok ? "Supplier statement copied." : "Copy failed — select the text manually.", ok ? "ok" : "warn");
  }

  function exportSuppliersCsv() {
    const header = ["Supplier", "Phone", "Notes", "Billed", "Paid", "Balance"];
    const rows = state.suppliers.map((s) => [
      s.name, s.phone || "", s.notes || "",
      (s.bills || []).reduce((sum, b) => sum + num(b.amount), 0),
      (s.payments || []).reduce((sum, p) => sum + num(p.amount), 0),
      supplierBalance(s)
    ]);
    downloadCsv("SellMate-suppliers-" + todayISO() + ".csv", header, rows);
    toast("Suppliers CSV downloaded.");
  }

  /* ---------- Reports and tools ---------- */
  function resetReportOutputs() {
    dayBookText = "";
    priceListText = "";
    restockText = "";
    insightsText = "";
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("dayBookOutput", "Choose a date and generate a summary.");
    set("priceOutput", "Generate a price list to share.");
    set("restockOutput", "Generate a restock list to send to your supplier.");
    set("insightsOutput", "Generate a monthly summary.");
  }

  function generateDayBookText() {
    const date = document.getElementById("reportDate").value || todayISO();
    const orders = state.orders.filter((o) => o.date === date);
    const payments = [];
    state.orders.forEach((o) => (o.payments || []).forEach((p) => {
      if (p.date === date) payments.push({ amount: p.amount, method: p.method, who: o.customerName });
    }));
    state.customers.forEach((c) => (c.payments || []).forEach((p) => {
      if (p.date === date) payments.push({ amount: p.amount, method: p.method, who: c.name });
    }));
    const expenses = state.expenses.filter((e) => e.date === date);
    const collections = payments.reduce((s, p) => s + num(p.amount), 0);
    const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
    const pending = pendingCustomers().filter((x) => x.balance > 0).reduce((s, x) => s + x.balance, 0);
    dayBookText = [
      "*Day Book — " + prettyDate(date) + "*",
      state.settings.shopName || "My Shop",
      "",
      "Orders taken: " + orders.length,
      "Order value: " + money(orders.reduce((s, o) => s + orderTotal(o), 0)),
      "",
      "Collections: " + money(collections),
      ...METHODS.map((m) => "   " + m + ": " + money(payments.filter((p) => p.method === m).reduce((s, p) => s + num(p.amount), 0))),
      "",
      "Expenses: " + money(expenseTotal),
      ...expenses.map((e) => "   " + e.name + " (" + (e.category || "Other") + "): " + money(e.amount)),
      "Net cash: " + money(collections - expenseTotal),
      "",
      "Outstanding balance (all customers): " + money(pending),
      "———",
      "Generated by SellMate"
    ].join("\n");
    document.getElementById("dayBookOutput").textContent = dayBookText;
    return dayBookText;
  }

  function renderPriceProducts() {
    const box = document.getElementById("priceProducts");
    const onlyAvail = document.getElementById("priceOnlyAvailable").checked;
    if (!selectedPriceIds) selectedPriceIds = new Set(state.products.map((p) => p.id));
    const products = state.products.filter((p) => !onlyAvail || availability(p) > 0);
    if (!products.length) {
      box.innerHTML = '<div class="empty-state">' + (onlyAvail ? "No products available right now." : "Add products to build a price list.") + "</div>";
      return;
    }
    box.innerHTML = products.map((p) => {
      const avail = availability(p);
      return `<label class="check-line">
        <input type="checkbox" data-price-product="${esc(p.id)}" ${selectedPriceIds.has(p.id) ? "checked" : ""} />
        <span>${esc(p.name)} · ${money(p.price)} <small>(${Math.max(0, avail)} ${esc(p.unit || "pc")} available)</small></span>
      </label>`;
    }).join("");
  }

  function generatePriceListText() {
    const onlyAvail = document.getElementById("priceOnlyAvailable").checked;
    const chosen = state.products.filter((p) => selectedPriceIds && selectedPriceIds.has(p.id) && (!onlyAvail || availability(p) > 0));
    if (!chosen.length) {
      toast("Select at least one product.", "warn");
      return "";
    }
    const lines = ["*" + (state.settings.shopName || "My Shop") + " — Price List*", ""];
    chosen.forEach((p, i) => {
      const avail = availability(p);
      lines.push((i + 1) + ". " + p.name + " — " + money(p.price) + " (" + (avail > 0 ? avail + " " + (p.unit || "pc") + " available" : "out of stock") + ")");
    });
    lines.push("", "Message me to order. Thank you!");
    priceListText = lines.join("\n");
    document.getElementById("priceOutput").textContent = priceListText;
    return priceListText;
  }

  function generateRestockText() {
    const low = lowProducts();
    const lines = ["*" + (state.settings.shopName || "My Shop") + " — Restock List*", ""];
    if (!low.length) lines.push("Nothing to restock right now.");
    low.forEach((p, i) => {
      const avail = availability(p);
      const shown = Math.max(0, avail);
      const target = Math.max(num(p.low, 3) * 3, 10);
      const suggested = Math.max(1, target - avail);
      lines.push((i + 1) + ". " + p.name + " — " + shown + " " + (p.unit || "pc") + " available, reorder " + suggested + " " + (p.unit || "pc"));
    });
    lines.push("", "Please share prices and availability. Thank you!");
    restockText = lines.join("\n");
    document.getElementById("restockOutput").textContent = restockText;
    return restockText;
  }

  function generateInsights() {
    const month = document.getElementById("insightMonth").value || todayISO().slice(0, 7);
    const prefix = month + "-";
    const orders = state.orders.filter((o) => String(o.date || "").startsWith(prefix));
    const delivered = orders.filter((o) => o.status === "Delivered");
    const sales = delivered.reduce((s, o) => s + orderTotal(o), 0);
    const cost = delivered.reduce((s, o) => s + orderCost(o), 0);
    const expenses = state.expenses.filter((e) => String(e.date || "").startsWith(prefix));
    const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
    const collections = [];
    orders.forEach((o) => (o.payments || []).forEach((p) => { if (String(p.date || "").startsWith(prefix)) collections.push(num(p.amount)); }));
    state.customers.forEach((c) => (c.payments || []).forEach((p) => { if (String(p.date || "").startsWith(prefix)) collections.push(num(p.amount)); }));
    const collected = collections.reduce((s, a) => s + a, 0);
    const monthlyDue = orders.filter((o) => !o.cancelled && !o.returned && orderBalance(o) > 0).reduce((s, o) => s + orderBalance(o), 0);
    const sellers = new Map();
    delivered.forEach((o) => (o.items || []).forEach((i) => {
      const key = i.name || "Item";
      const entry = sellers.get(key) || { name: key, sku: i.sku || "", qty: 0, revenue: 0, profit: 0 };
      const revenue = num(i.qty) * num(i.price);
      entry.qty += num(i.qty);
      entry.revenue += revenue;
      entry.profit += revenue - num(i.qty) * num(i.cost);
      sellers.set(key, entry);
    }));
    const top = [...sellers.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const categoryLines = EXPENSE_CATEGORIES
      .map((cat) => ({ cat, amount: expenses.filter((e) => e.category === cat).reduce((s, e) => s + num(e.amount), 0) }))
      .filter((x) => x.amount > 0)
      .map((x) => "   " + x.cat + ": " + money(x.amount));
    const supplierPayable = state.suppliers.reduce((s, x) => s + Math.max(0, supplierBalance(x)), 0);
    const lines = [
      "*SellMate — " + monthLabel(month) + " Summary*",
      state.settings.shopName || "My Shop",
      "",
      "Orders: " + orders.length + " (" + delivered.length + " delivered)",
      "Delivered sales: " + money(sales),
      "Cost of goods: " + money(cost),
      "Expenses: " + money(expenseTotal),
      ...categoryLines,
      "Net profit: " + money(sales - cost - expenseTotal),
      "",
      "Collected this month: " + money(collected),
      "Still due from these orders: " + money(monthlyDue),
      "Supplier payable: " + money(supplierPayable),
      ""
    ];
    if (top.length) {
      lines.push("*Top sellers*");
      top.forEach((p, i) => lines.push((i + 1) + ". " + p.name + (p.sku ? " [" + p.sku + "]" : "") + " — " + num(p.qty) + " sold · " + money(p.revenue) + " · profit " + money(p.profit)));
    } else {
      lines.push("Top sellers: no delivered orders this month.");
    }
    lines.push("———", "Generated by SellMate");
    insightsText = lines.join("\n");
    document.getElementById("insightsOutput").textContent = insightsText;
    return insightsText;
  }

  function renderReplyTemplates() {
    const box = document.getElementById("replyTemplates");
    if (!box) return;
    const replies = state.settings.replies || {};
    box.innerHTML = Object.keys(REPLY_LABELS).map((kind) => `
      <label class="field full reply-card">
        <span>${esc(REPLY_LABELS[kind])}</span>
        <textarea data-reply-kind="${esc(kind)}" rows="3" placeholder="Leave blank to use the built-in wording…">${esc(replies[kind] || "")}</textarea>
      </label>
    `).join("");
  }

  function saveReplies() {
    const replies = {};
    document.querySelectorAll("#replyTemplates [data-reply-kind]").forEach((area) => {
      replies[area.dataset.replyKind] = area.value.trim();
    });
    state.settings.replies = replies;
    save();
    toast("Quick replies saved.");
  }

  function resetReplies() {
    if (!askConfirm("Reset all custom replies to the built-in wording?")) return;
    state.settings.replies = {};
    save();
    renderReplyTemplates();
    toast("Replies reset to defaults.");
  }

  async function copyReportText(text, label) {
    if (!text) {
      toast("Generate the " + label + " first.", "warn");
      return;
    }
    const ok = await copyText(text);
    toast(ok ? label + " copied." : "Copy failed — select the text manually.", ok ? "ok" : "warn");
  }

  /* ---------- CSV exports ---------- */
  function exportOrdersCsv() {
    const header = ["Code", "Date", "Customer", "Phone", "Source", "Items", "Subtotal", "Discount", "Delivery", "Total", "Paid", "Balance", "Status", "Due Date", "Courier", "Tracking", "Address", "Notes"];
    const rows = state.orders.map((o) => [
      o.code, o.date, o.customerName, o.phone, o.source, itemsSummary(o),
      orderSubtotal(o), num(o.discount), num(o.delivery), orderTotal(o), orderPaid(o), orderBalance(o),
      o.status, o.dueDate || "", o.courier || "", o.tracking || "", o.address || "", o.notes || ""
    ]);
    downloadCsv("SellMate-orders-" + todayISO() + ".csv", header, rows);
    toast("Orders CSV downloaded.");
  }

  function exportPaymentsCsv() {
    const header = ["Date", "Customer", "Phone", "Order", "Amount", "Method", "Note", "Recorded In"];
    const rows = [];
    state.orders.forEach((o) => (o.payments || []).forEach((p) => rows.push([p.date, o.customerName, o.phone, o.code, num(p.amount), p.method, p.note || "", "Order"])));
    state.customers.forEach((c) => (c.payments || []).forEach((p) => rows.push([p.date, c.name, c.phone, "", num(p.amount), p.method, p.note || "", "Ledger"])));
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    downloadCsv("SellMate-payments-" + todayISO() + ".csv", header, rows);
    toast("Payments CSV downloaded.");
  }

  function exportCustomersCsv() {
    const header = ["Name", "Phone", "Instagram", "Notes", "Orders", "Balance", "Created"];
    const rows = state.customers.map((c) => [
      c.name, c.phone, c.instagram || "", c.notes || "",
      customerOrders(c).length, customerBalance(c), c.createdAt || ""
    ]);
    downloadCsv("SellMate-customers-" + todayISO() + ".csv", header, rows);
    toast("Customers CSV downloaded.");
  }

  function exportProductsCsv() {
    const header = ["SKU", "Name", "Sale Price", "Cost Price", "Stock", "Low Alert", "Unit", "Reserved", "Available"];
    const rows = state.products.map((p) => [
      p.sku || "", p.name, num(p.price), num(p.cost), num(p.stock), num(p.low, 3), p.unit || "pc", reservedFor(p.id), availability(p)
    ]);
    downloadCsv("SellMate-products-" + todayISO() + ".csv", header, rows);
    toast("Products CSV downloaded.");
  }

  /* ---------- Events ---------- */
  function bind() {
    document.querySelectorAll("[data-auth-tab]").forEach((b) => b.addEventListener("click", () => authTab(b.dataset.authTab)));
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("loginBtn"); btn.disabled = true;
      try { await signInWithPassword(document.getElementById("loginEmail").value.trim(), document.getElementById("loginPassword").value); setAuthStatus(""); }
      catch (err) { setAuthStatus(friendlyError(err, "Login failed."), "warn"); } finally { btn.disabled = false; }
    });
    document.getElementById("signupForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("signupBtn"); btn.disabled = true;
      try {
        const result = await signUpWithPassword(document.getElementById("signupEmail").value.trim(), document.getElementById("signupPassword").value, document.getElementById("signupShop").value.trim());
        if (result === "confirm-email") setAuthStatus("Account created. Check your email to confirm, then log in.", "ok");
        else setAuthStatus("");
      } catch (err) { setAuthStatus(friendlyError(err, "Signup failed."), "warn"); } finally { btn.disabled = false; }
    });
    document.getElementById("googleAuthBtn").addEventListener("click", async () => { try { await signInWithGoogle(); } catch (err) { setAuthStatus(friendlyError(err, "Google sign-in failed."), "warn"); } });
    document.getElementById("phoneAuthBtn").addEventListener("click", () => { authTab("phone"); document.getElementById("phoneNumber").focus(); });
    document.getElementById("phoneNumber").addEventListener("input", () => {
      pendingPhone = null;
      document.getElementById("otpBox").hidden = true;
    });
    document.getElementById("phoneForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("sendCodeBtn"); btn.disabled = true;
      try { await sendPhoneCode(); }
      catch (err) { setAuthStatus(friendlyError(err, "Could not send SMS code."), "warn"); }
      finally { btn.disabled = false; }
    });
    document.getElementById("verifyOtpBtn").addEventListener("click", async () => {
      const btn = document.getElementById("verifyOtpBtn"); btn.disabled = true;
      try { await verifyPhoneCode(); }
      catch (err) { setAuthStatus(friendlyError(err, "Could not verify code."), "warn"); }
      finally { btn.disabled = false; }
    });
    document.getElementById("resendCodeBtn").addEventListener("click", async () => {
      const btn = document.getElementById("resendCodeBtn"); btn.disabled = true;
      try { await sendPhoneCode(); }
      catch (err) { setAuthStatus(friendlyError(err, "Could not resend code."), "warn"); }
      finally { btn.disabled = false; }
    });
    document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
      const email = document.getElementById("loginEmail").value.trim();
      try { await resetPassword(email); setAuthStatus("Password reset email sent. Check your inbox/spam.", "ok"); }
      catch (err) { setAuthStatus(friendlyError(err, "Could not send reset email."), "warn"); }
    });
    document.getElementById("recoveryForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("recoveryBtn"); btn.disabled = true;
      const wasRecovery = recoveryIntent;
      recoveryIntent = false;
      try {
        const oldPassword = recoveryNeedsOld ? document.getElementById("recoveryOldPassword").value : "";
        await updatePassword(document.getElementById("recoveryPassword").value, oldPassword);
        setAuthStatus("Password updated. You can now use the app.", "ok");
        document.getElementById("recoveryForm").reset();
        if (currentUser && sb) { showAppShell(); applySettings(); renderAll(); }
      } catch (err) {
        if (wasRecovery) recoveryIntent = true;
        setAuthStatus(friendlyError(err, "Could not update password. Check your sign-in method and try again."), "warn");
      } finally { btn.disabled = false; }
    });
    document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
    document.getElementById("changePasswordBtn").addEventListener("click", () => showRecovery("change"));
    document.getElementById("recoveryCancelBtn").addEventListener("click", cancelRecovery);
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      const btn = document.getElementById("logoutBtn"); btn.disabled = true;
      try { await signOut(); } catch (err) { toast(friendlyError(err, "Logout failed."), "warn"); } finally { btn.disabled = false; }
    });
    document.getElementById("deleteAccountBtn").addEventListener("click", deleteAccount);

    document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
    document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.go)));
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.querySelector(".sidebar");
    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setSidebar(!sidebar.classList.contains("open"));
    });
    const navBackdrop = document.getElementById("navBackdrop");
    if (navBackdrop) navBackdrop.addEventListener("click", closeSidebar);
    document.addEventListener("click", (event) => {
      if (!sidebar.classList.contains("open")) return;
      if (sidebar.contains(event.target) || menuBtn.contains(event.target)) return;
      closeSidebar();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSidebar();
    });

    document.querySelectorAll("[data-lang-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.SellMateLang) return;
        window.SellMateLang.set(window.SellMateLang.isEnglish() ? "ur" : "en");
      });
    });
    if (window.SellMateLang) window.SellMateLang.onChange(syncLanguageControls);

    document.getElementById("themeBtn").addEventListener("click", () => {
      state.settings.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      try { localStorage.setItem(THEME_KEY, state.settings.theme); } catch (_) {}
      save();
      applySettings();
    });
    document.getElementById("backupBtn").addEventListener("click", exportBackup);
    document.getElementById("backupNow").addEventListener("click", exportBackup);
    document.getElementById("backupLater").addEventListener("click", snoozeBackup);
    document.getElementById("restoreBtn").addEventListener("click", () => document.getElementById("restoreFile").click());
    document.getElementById("restoreFile").addEventListener("change", (e) => e.target.files[0] && importBackup(e.target.files[0]));
    document.getElementById("resetBtn").addEventListener("click", () => {
      if (!askConfirm("Reset this workspace? This clears your cloud data for this account.")) return;
      state = blank();
      activePhone = null;
      paymentOpenId = null;
      activeLedgerId = null;
      activeSupplierId = null;
      editingSupplier = null;
      editingProduct = editingOrder = editingCustomer = null;
      selectedPriceIds = null;
      selectedFollowups = new Set();
      clearDraft();
      clearPriceList();
      resetReportOutputs();
      renderReplyTemplates();
      resetProductForm();
      resetOrderForm();
      resetCustomerForm();
      save();
      applySettings();
      renderAll();
      toast("Workspace reset.");
    });
    document.getElementById("shopName").addEventListener("change", (e) => {
      state.settings.shopName = e.target.value.trim() || "My Shop";
      save();
      applySettings();
    });

    /* Products */
    document.getElementById("productForm").addEventListener("submit", saveProduct);
    document.getElementById("cancelProductEdit").addEventListener("click", () => { resetProductForm(); });
    document.getElementById("productSearch").addEventListener("input", renderProducts);
    document.getElementById("productList").addEventListener("click", (event) => {
      const add = event.target.dataset.stockAdd;
      const set = event.target.dataset.stockSet;
      const edit = event.target.dataset.productEdit;
      const del = event.target.dataset.productDelete;
      const product = state.products.find((p) => p.id === (add || set));
      if (product) {
        const input = document.querySelector('[data-stock-input="' + product.id + '"]');
        const delta = num(input.value);
        if (add) product.stock = num(product.stock) + delta;
        if (set) product.stock = delta;
        save();
        renderAll();
        toast("Stock updated.");
        return;
      }
      if (edit) {
        const p = state.products.find((x) => x.id === edit);
        if (!p) return;
        editingProduct = edit;
        document.getElementById("pName").value = p.name;
        document.getElementById("pSku").value = p.sku || "";
        document.getElementById("pPrice").value = p.price;
        document.getElementById("pCost").value = p.cost;
        document.getElementById("pStock").value = p.stock;
        document.getElementById("pLow").value = p.low;
        document.getElementById("pUnit").value = p.unit || "pc";
        document.getElementById("productFormTitle").textContent = "Edit " + p.name;
        document.getElementById("productSubmit").textContent = "Update product";
        document.getElementById("cancelProductEdit").hidden = false;
        switchView("products");
        return;
      }
      if (del) {
        if (!askConfirm("Delete this product? Existing orders keep their item details.")) return;
        state.products = state.products.filter((p) => p.id !== del);
        selectedPriceIds = null;
        save();
        renderAll();
      }
    });

    /* Orders */
    document.getElementById("orderForm").addEventListener("submit", saveOrder);
    document.getElementById("cancelOrderEdit").addEventListener("click", resetOrderForm);
    document.getElementById("addItemBtn").addEventListener("click", () => { addItemRow(null); updateTotals(); });
    document.getElementById("orderSearch").addEventListener("input", renderOrders);
    document.getElementById("orderFilter").addEventListener("change", renderOrders);
    document.getElementById("orderFrom").addEventListener("change", renderOrders);
    document.getElementById("orderTo").addEventListener("change", renderOrders);
    document.getElementById("clearDateFilters").addEventListener("click", () => {
      document.getElementById("orderFrom").value = "";
      document.getElementById("orderTo").value = "";
      renderOrders();
    });
    ["oDiscount", "oDelivery", "oPaid"].forEach((id) => document.getElementById(id).addEventListener("input", updateTotals));
    document.getElementById("itemRows").addEventListener("input", updateTotals);
    document.getElementById("itemRows").addEventListener("change", (event) => {
      if (!event.target.classList.contains("i-product")) { updateTotals(); return; }
      const row = event.target.closest(".item-row");
      const product = state.products.find((p) => p.name.toLowerCase() === event.target.value.trim().toLowerCase());
      if (product) {
        row.querySelector(".i-price").value = product.price;
        row.querySelector(".i-cost").value = product.cost;
        const qty = num(row.querySelector(".i-qty").value, 1);
        if (qty > availability(product)) toast("Only " + availability(product) + " " + (product.unit || "pc") + " available (others reserved).", "warn");
      }
      renderProductOptions();
      updateTotals();
    });
    document.getElementById("itemRows").addEventListener("click", (event) => {
      if (!event.target.classList.contains("i-remove")) return;
      const rows = document.querySelectorAll("#itemRows .item-row");
      if (rows.length > 1) event.target.closest(".item-row").remove();
      else event.target.closest(".item-row").querySelectorAll("input").forEach((i) => { i.value = ""; });
      updateTotals();
    });

    document.getElementById("orderList").addEventListener("change", (event) => {
      const id = event.target.dataset.orderStatus;
      if (id) changeStatus(id, event.target.value);
    });
    document.getElementById("orderList").addEventListener("click", (event) => {
      const toggle = event.target.dataset.paymentToggle;
      const edit = event.target.dataset.orderEdit;
      const repeat = event.target.dataset.orderRepeat;
      const invoice = event.target.dataset.invoice;
      const message = event.target.dataset.messageOrder;
      const del = event.target.dataset.orderDelete;
      const add = event.target.dataset.paymentAdd;
      const remove = event.target.dataset.paymentDelete;

      if (toggle) { paymentOpenId = paymentOpenId === toggle ? null : toggle; renderOrders(); return; }
      if (repeat) { startRepeatOrder(state.orders.find((o) => o.id === repeat)); return; }
      if (edit) { startOrderEdit(edit); return; }
      if (invoice) { openInvoice(invoice); return; }
      if (message) { openChatForPhone(message); return; }
      if (add) { addPayment(add); return; }
      if (remove) {
        if (!askConfirm("Remove this payment entry?")) return;
        const order = state.orders.find((o) => o.id === event.target.dataset.orderId);
        if (order) {
          order.payments = order.payments.filter((p) => p.id !== remove);
          save();
          renderAll();
          toast("Payment removed.");
        }
        return;
      }
      if (del) {
        if (!askConfirm("Delete this order? Stock and payments recorded for it will also be removed from the app.")) return;
        const order = state.orders.find((o) => o.id === del);
        if (order && STOCK_CONSUMING.includes(order.status)) {
          applyStockDelta(order.items, 1);
        }
        state.orders = state.orders.filter((o) => o.id !== del);
        save();
        renderAll();
      }
    });

    /* Customers */
    document.getElementById("customerForm").addEventListener("submit", saveCustomer);
    document.getElementById("cancelCustomerEdit").addEventListener("click", resetCustomerForm);
    document.getElementById("customerSearch").addEventListener("input", renderCustomers);
    function handleCustomerAction(target) {
      const message = target.dataset.messageCustomer;
      const ledger = target.dataset.ledger;
      const repeat = target.dataset.repeatCustomer;
      const newOrder = target.dataset.orderFor;
      const edit = target.dataset.customerEdit;
      const del = target.dataset.customerDelete;

      if (message) { openChatForPhone(message); return; }
      if (ledger) {
        if (!state.customers.some((c) => c.id === ledger)) return;
        activeLedgerId = ledger;
        renderLedger();
        renderCustomers();
        document.getElementById("ledgerPanel").scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
      if (repeat) {
        const order = [...state.orders].reverse().find((o) => cleanPhone(o.phone) === cleanPhone(repeat));
        if (!order) {
          toast("No previous order for this customer.", "warn");
          return;
        }
        startRepeatOrder(order);
        return;
      }
      if (newOrder) {
        const customer = state.customers.find((c) => cleanPhone(c.phone) === cleanPhone(newOrder));
        resetOrderForm();
        if (customer) {
          document.getElementById("oCustomer").value = customer.name;
          document.getElementById("oPhone").value = customer.phone;
          document.getElementById("oInstagram").value = customer.instagram || "";
        }
        switchView("orders");
        return;
      }
      if (edit) {
        const customer = state.customers.find((c) => c.id === edit);
        if (!customer) return;
        editingCustomer = edit;
        document.getElementById("cName").value = customer.name;
        document.getElementById("cPhone").value = customer.phone;
        document.getElementById("cInstagram").value = customer.instagram || "";
        document.getElementById("cNotes").value = customer.notes || "";
        document.getElementById("customerFormTitle").textContent = "Edit " + customer.name;
        document.getElementById("customerSubmit").textContent = "Update customer";
        document.getElementById("cancelCustomerEdit").hidden = false;
        switchView("customers");
        return;
      }
      if (del) {
        const hasOrders = state.orders.some((o) => cleanPhone(o.phone) === cleanPhone((state.customers.find((c) => c.id === del) || {}).phone));
        if (hasOrders) {
          toast("This customer has orders. Delete the orders first.", "warn");
          return;
        }
        if (!askConfirm("Delete this customer?")) return;
        state.customers = state.customers.filter((c) => c.id !== del);
        if (activeLedgerId === del) activeLedgerId = null;
        save();
        renderAll();
      }
    }

    document.getElementById("customerList").addEventListener("click", (event) => handleCustomerAction(event.target));
    document.getElementById("pendingPayments").addEventListener("click", (event) => handleCustomerAction(event.target));

    /* Chat */
    document.getElementById("threadList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-thread]");
      if (!button) return;
      activePhone = button.dataset.thread;
      clearDraft();
      renderThreads();
      renderChat();
    });
    document.getElementById("templateBar").addEventListener("click", (event) => {
      const kind = event.target.dataset.template;
      if (kind) showTemplate(kind);
    });
    document.getElementById("toggleReplyPaste").addEventListener("click", () => {
      const body = document.getElementById("replyPasteBody");
      body.hidden = !body.hidden;
      document.getElementById("toggleReplyPaste").textContent = uiText(body.hidden ? "Kholen" : "Band karein", body.hidden ? "Open" : "Close");
    });
    document.getElementById("makePasteReply").addEventListener("click", preparePasteReply);
    document.getElementById("clearPasteReply").addEventListener("click", () => {
      document.getElementById("replyPasteText").value = "";
    });
    document.getElementById("useDraft").addEventListener("click", () => {
      if (!currentDraft) return;
      document.getElementById("chatInput").value = currentDraft;
      document.getElementById("chatInput").focus();
    });
    document.getElementById("copyDraft").addEventListener("click", async () => {
      if (!currentDraft) return;
      const copied = await copyText(currentDraft);
      toast(copied ? "Draft copied." : "Copy failed — select the text manually.", copied ? "ok" : "warn");
    });
    document.getElementById("sendWhatsApp").addEventListener("click", () => openWhatsApp(currentDraft));
    document.getElementById("whatsAppBtn").addEventListener("click", () => openWhatsApp(currentDraft || document.getElementById("chatInput").value));
    document.getElementById("instagramBtn").addEventListener("click", () => {
      if (!activePhone) { toast("Select a conversation first.", "warn"); return; }
      const customer = state.customers.find((c) => cleanPhone(c.phone) === cleanPhone(activePhone));
      if (!customer || !customer.instagram) { toast("Add an Instagram handle to this customer first.", "warn"); return; }
      window.open("https://instagram.com/" + customer.instagram.replace(/^@/, ""), "_blank", "noopener");
    });
    document.getElementById("chatForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("chatInput");
      if (!input.value.trim()) return;
      addMessage("seller", input.value);
      input.value = "";
      clearDraft();
    });

    /* Paste-from-chat order builder */
    document.getElementById("togglePaste").addEventListener("click", () => {
      const body = document.getElementById("pasteBody");
      body.hidden = !body.hidden;
      document.getElementById("togglePaste").textContent = uiText(body.hidden ? "Kholen" : "Band karein", body.hidden ? "Open" : "Close");
    });
    document.getElementById("parsePaste").addEventListener("click", parseBuyerMessage);
    document.getElementById("clearPaste").addEventListener("click", () => {
      document.getElementById("pasteText").value = "";
      parsedPaste = null;
      renderPasteResult();
    });
    document.getElementById("pasteResult").addEventListener("click", (event) => {
      if (event.target.dataset.pasteUse !== undefined) applyPaste();
    });

    /* Follow-up queue */
    document.getElementById("followupList").addEventListener("change", (event) => {
      const id = event.target.dataset.followupCheck;
      if (!id) return;
      if (event.target.checked) selectedFollowups.add(id);
      else selectedFollowups.delete(id);
      renderFollowups();
    });
    document.getElementById("selectAllFollowups").addEventListener("click", toggleAllFollowups);
    document.getElementById("bulkFollowup").addEventListener("click", bulkFollowup);
    document.getElementById("followupList").addEventListener("click", (event) => {
      const pay = event.target.dataset.followupPay;
      if (pay) {
        paymentOpenId = pay;
        switchView("orders");
        renderOrders();
        const row = document.getElementById("order-" + pay);
        if (row) row.scrollIntoView({ behavior: "auto", block: "center" });
        return;
      }
      const message = event.target.dataset.followupMessage;
      if (message) openChatForPhone(message);
    });

    /* Customer ledger */
    document.getElementById("closeLedger").addEventListener("click", () => {
      activeLedgerId = null;
      renderLedger();
      renderCustomers();
    });
    document.getElementById("ledgerPayBtn").addEventListener("click", recordLedgerPayment);
    document.getElementById("copyStatement").addEventListener("click", () => shareStatement(false));
    document.getElementById("whatsappStatement").addEventListener("click", () => shareStatement(true));

    /* Supplier khata */
    document.getElementById("supplierForm").addEventListener("submit", saveSupplier);
    document.getElementById("cancelSupplierEdit").addEventListener("click", resetSupplierForm);
    document.getElementById("supplierList").addEventListener("click", (event) => {
      const ledger = event.target.dataset.supplierLedger;
      const message = event.target.dataset.supplierMessage;
      const edit = event.target.dataset.supplierEdit;
      const del = event.target.dataset.supplierDelete;
      if (ledger) { openSupplier(ledger); return; }
      if (message) { openWhatsAppTo(message, "Hello! I'd like to check my payment balance."); return; }
      if (edit) {
        const supplier = state.suppliers.find((s) => s.id === edit);
        if (!supplier) return;
        editingSupplier = edit;
        document.getElementById("sName").value = supplier.name;
        document.getElementById("sPhone").value = supplier.phone || "";
        document.getElementById("sNotes").value = supplier.notes || "";
        document.getElementById("supplierSubmit").textContent = "Update supplier";
        document.getElementById("cancelSupplierEdit").hidden = false;
        document.getElementById("supplierForm").scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
      if (del) {
        activeSupplierId = del;
        deleteSupplier();
      }
    });
    document.getElementById("closeSupplierLedger").addEventListener("click", () => {
      activeSupplierId = null;
      renderSuppliers();
      renderSupplierLedger();
    });
    document.getElementById("supplierAddBill").addEventListener("click", addSupplierBill);
    document.getElementById("supplierAddPay").addEventListener("click", addSupplierPayment);
    document.getElementById("deleteSupplier").addEventListener("click", deleteSupplier);
    document.getElementById("copySupplierStatement").addEventListener("click", () => shareSupplierStatement(false));
    document.getElementById("whatsappSupplier").addEventListener("click", () => shareSupplierStatement(true));

    /* Quick replies */
    document.getElementById("saveReplies").addEventListener("click", saveReplies);
    document.getElementById("resetReplies").addEventListener("click", resetReplies);

    /* Reports and tools */
    document.getElementById("generateDayBook").addEventListener("click", () => {
      generateDayBookText();
      toast("Day Book generated.");
    });
    document.getElementById("copyDayBook").addEventListener("click", () => copyReportText(dayBookText, "Day Book"));
    document.getElementById("priceOnlyAvailable").addEventListener("change", () => { clearPriceList(); renderPriceProducts(); });
    document.getElementById("priceProducts").addEventListener("change", (event) => {
      const id = event.target.dataset.priceProduct;
      if (!id) return;
      if (!selectedPriceIds) selectedPriceIds = new Set();
      if (event.target.checked) selectedPriceIds.add(id);
      else selectedPriceIds.delete(id);
      clearPriceList();
    });
    document.getElementById("generatePriceList").addEventListener("click", () => {
      if (generatePriceListText()) toast("Price list generated.");
    });
    document.getElementById("copyPriceList").addEventListener("click", () => copyReportText(priceListText, "Price list"));
    document.getElementById("sendPriceList").addEventListener("click", () => {
      const text = priceListText || generatePriceListText();
      if (text) openWhatsAppTo(document.getElementById("pricePhone").value, text);
    });
    document.getElementById("generateRestock").addEventListener("click", () => {
      generateRestockText();
      toast("Restock list generated.");
    });
    document.getElementById("copyRestock").addEventListener("click", () => copyReportText(restockText, "Restock list"));
    document.getElementById("sendRestock").addEventListener("click", () => {
      openWhatsAppTo(document.getElementById("supplierPhone").value, generateRestockText());
    });
    document.getElementById("exportOrdersCsv").addEventListener("click", exportOrdersCsv);
    document.getElementById("exportPaymentsCsv").addEventListener("click", exportPaymentsCsv);
    document.getElementById("exportCustomersCsv").addEventListener("click", exportCustomersCsv);
    document.getElementById("exportProductsCsv").addEventListener("click", exportProductsCsv);
    document.getElementById("exportSuppliersCsv").addEventListener("click", exportSuppliersCsv);
    document.getElementById("generateInsights").addEventListener("click", () => {
      generateInsights();
      toast("Monthly summary generated.");
    });
    document.getElementById("copyInsights").addEventListener("click", () => copyReportText(insightsText, "Monthly summary"));

    /* Expenses */
    document.getElementById("expenseForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const date = dateField("expenseDate");
      state.expenses.push({
        id: uid(), name: document.getElementById("eName").value.trim(),
        amount: num(document.getElementById("eAmount").value), date,
        category: document.getElementById("eCategory").value
      });
      save();
      event.target.reset();
      const dateInput = document.getElementById("expenseDate");
      if (dateInput) dateInput.value = todayISO();
      renderAll();
      toast("Expense saved.");
    });
    document.getElementById("expenseList").addEventListener("click", (event) => {
      const id = event.target.dataset.expenseDelete;
      if (!id) return;
      state.expenses = state.expenses.filter((e) => e.id !== id);
      save();
      renderAll();
    });
  }

  /* ---------- Start ---------- */
  window.addEventListener("beforeunload", () => { flushSave(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });
  if ("BroadcastChannel" in window) {
    workspaceChannel = new BroadcastChannel("sellmate-workspace");
    workspaceChannel.addEventListener("message", async (event) => {
      const data = event.data || {};
      if (!currentUser || !cloudReady || data.userId !== currentUser.id || saving) return;
      try {
        await loadCloudState(currentUser);
        renderAll();
        toast("Workspace synced from another tab.", "ok");
      } catch (_) {}
    });
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.protocol === "http:")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => console.warn("SellMate: service worker unavailable"));
    });
  }

  bind();
  applySettings();
  const od = document.getElementById("orderDate"); if (od) od.value = todayISO();
  const ed = document.getElementById("expenseDate"); if (ed) ed.value = todayISO();
  const rd = document.getElementById("reportDate"); if (rd) rd.value = todayISO();
  const im = document.getElementById("insightMonth"); if (im) im.value = todayISO().slice(0, 7);
  initCloud().catch((error) => {
    console.warn("SellMate startup failed");
    showAuthScreen();
    setAuthStatus(friendlyError(error, "Could not start the cloud connection."), "warn");
  });

  /* Bridge used by the free offline help assistant (help-chat.js). */
  window.SellMateHelp = {
    openView: switchView,
    exportBackup: exportBackup,
    changePassword: () => {
      if (!currentUser) {
        authTab("login");
        showAuthScreen();
        setAuthStatus("Sign in first, then change your password.", "warn");
        return;
      }
      showRecovery("change");
    },
    isSignedIn: () => !!currentUser,
    showAuth: (tab) => {
      authTab(tab === "signup" ? "signup" : "login");
      showAuthScreen();
    },
    currentView: () => {
      const active = document.querySelector(".view.active");
      return active ? active.id.replace("view-", "") : "home";
    },
    snapshot: () => ({
      products: state.products.length,
      orders: state.orders.length,
      customers: state.customers.length,
      lowStock: lowProducts().length,
      due: state.orders.reduce((sum, o) => sum + Math.max(0, orderBalance(o)), 0)
    })
  };
})();
