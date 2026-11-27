/* SellMate Help Assistant — 100% free, offline, no API key. */
(function () {
  "use strict";

  const UR_KB = window.SELLMATE_HELP_KB || [];
  const EN_KB = window.SELLMATE_HELP_KB_EN || [];
  const UR_CHIPS = window.SELLMATE_HELP_CHIPS || [];
  const EN_CHIPS = window.SELLMATE_HELP_CHIPS_EN || [];
  const LANG = window.SellMateLang || null;
  const FALLBACK_BRIDGE = window.SellMateHelp || {};
  const SUPPORT_EMAIL = "samad88900@gmail.com";

  let KB = UR_KB;
  let CHIPS = UR_CHIPS;

  let fab = null;
  let panel = null;
  let log = null;
  let input = null;
  let headerTitle = null;
  let headerSub = null;
  let closeBtn = null;
  let sendBtn = null;
  let open = false;
  let greeted = false;

  function tr(ur, en) {
    return LANG && LANG.isEnglish() ? en : ur;
  }

  /* The bridge may be installed by script.js after this file loads, so look it
     up on window each time instead of holding a possibly stale reference. */
  function bridge() {
    return (window.SellMateHelp && typeof window.SellMateHelp === "object")
      ? window.SellMateHelp
      : FALLBACK_BRIDGE;
  }

  function callBridge(name) {
    const api = bridge();
    const fn = api && api[name];
    if (typeof fn !== "function") return false;
    try {
      fn.apply(api, Array.prototype.slice.call(arguments, 1));
      return true;
    } catch (_) {
      return false;
    }
  }

  /* Until the bridge provides isSignedIn(), keep the previous behaviour. */
  function isSignedIn() {
    const api = bridge();
    if (!api || typeof api.isSignedIn !== "function") return true;
    try { return !!api.isSignedIn(); } catch (_) { return true; }
  }

  function showAuth(tab) {
    const api = bridge();
    if (!api || typeof api.showAuth !== "function") return false;
    try { api.showAuth(tab); return true; } catch (_) { return false; }
  }

  function applyLanguage() {
    const english = !!(LANG && LANG.isEnglish());
    KB = english ? EN_KB : UR_KB;
    CHIPS = english ? EN_CHIPS : UR_CHIPS;
    if (input) {
      input.placeholder = tr("Apna sawal likho…", "Ask your question…");
      input.setAttribute("aria-label", tr("Apna sawal likho", "Ask a question"));
    }
    if (fab) fab.setAttribute("aria-label", tr("SellMate help kholein", "Open SellMate help"));
    if (panel) panel.setAttribute("aria-label", tr("SellMate madadgar", "SellMate help assistant"));
    if (headerTitle) headerTitle.textContent = tr("SellMate Madadgar", "SellMate Assistant");
    if (headerSub) headerSub.textContent = tr("Free madad · offline", "Free help · offline");
    if (closeBtn) closeBtn.setAttribute("aria-label", tr("Madad band karein", "Close help"));
    if (sendBtn) sendBtn.setAttribute("aria-label", tr("Sawal bhejein", "Send"));
    if (log) {
      log.innerHTML = "";
      greeted = false;
      if (open) {
        greeted = true;
        addMessage("bot", greeting(), null);
        showChips();
      }
    }
  }

  const STOP = new Set([
    "kaise", "kya", "hai", "mein", "main", "the", "a", "an", "and", "or", "to", "for",
    "of", "in", "on", "se", "par", "kar", "karo", "karein", "mujhe", "mera", "meri",
    "chahta", "chahte", "hun", "ho", "kahan", "kahin", "ye", "yeh", "woh", "is", "ko"
  ]);
  const SYNONYMS = {
    bill: "invoice", bills: "invoice", receipt: "invoice", slip: "invoice", print: "invoice", pdf: "invoice",
    hisab: "payment", bakaya: "payment", pending: "payment", due: "payment", paid: "payment",
    code: "otp", sms: "otp", text: "otp", "6": "otp", digit: "otp",
    item: "product", items: "product", catalogue: "product",
    save: "backup", download: "backup", json: "backup", import: "restore", recover: "restore",
    "dark mode": "theme", colour: "theme", color: "theme"
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[c]);
  }

  function norm(text) {
    return String(text || "").toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenize(text) {
    const raw = norm(text).replace(/[^\p{L}\p{N} ]/gu, " ").split(" ").filter(Boolean);
    const out = [];
    raw.forEach((word) => {
      if (STOP.has(word) || word.length < 2) return;
      out.push(SYNONYMS[word] || word);
    });
    return out;
  }

  function scoreEntry(entry, text) {
    const tokens = tokenize(text);
    const phrase = norm(text);
    let score = 0;
    (entry.keys || []).forEach((key) => {
      const k = norm(key);
      if (phrase === k) score += 6;
      else if (phrase.includes(k)) score += k.split(" ").length >= 2 ? 4 : 3;
      else if (tokens.includes(k)) score += 2;
      else if (k.split(" ").length === 1 && tokens.some((t) => t.startsWith(k) && k.length >= 3)) score += 1;
    });
    tokens.forEach((t) => {
      if (norm(entry.q || "").includes(t)) score += 1;
    });
    return score;
  }

  function findAnswer(text) {
    let best = null;
    let bestScore = 0;
    KB.forEach((entry) => {
      const s = scoreEntry(entry, text);
      if (s > bestScore) { bestScore = s; best = entry; }
    });
    return bestScore >= 2 ? { entry: best, score: bestScore } : null;
  }

  function bridgeFn(name) {
    const api = bridge();
    return api ? api[name] : null;
  }

  function currentView() {
    const fn = bridgeFn("currentView");
    if (typeof fn === "function") return fn();
    const active = document.querySelector(".view.active");
    return active ? active.id.replace("view-", "") : "home";
  }

  function entryTokens(entry) {
    const out = new Set();
    [entry.id, entry.q || ""].concat(entry.keys || []).forEach((part) => {
      tokenize(part).forEach((token) => out.add(token));
    });
    return out;
  }

  /* Match a chip label to its KB entry: exact id/question first, then
     normalized token overlap (so short labels such as "Account delete" work). */
  function matchChip(label) {
    const phrase = norm(label);
    const tokens = tokenize(label);
    if (!phrase) return null;
    let best = null;
    let bestScore = 0;
    KB.forEach((entry) => {
      let score = 0;
      if (norm(entry.id) === phrase || norm(entry.q || "") === phrase) {
        score = 100;
      } else {
        const known = entryTokens(entry);
        tokens.forEach((token) => { if (known.has(token)) score += 2; });
        (entry.keys || []).forEach((key) => {
          const k = norm(key);
          if (!k) return;
          if (phrase === k) score += 6;
          else if (phrase.includes(k)) score += k.indexOf(" ") > -1 ? 4 : 3;
        });
      }
      if (score > bestScore) { bestScore = score; best = entry; }
    });
    return bestScore > 0 ? best : null;
  }

  function quickChipItems() {
    const view = currentView();
    const viewIds = {
      home: ["backup", "profit", "otp", "low-stock"],
      products: ["add-product", "edit-product", "low-stock", "invoice"],
      orders: ["invoice", "payment", "order-status", "new-order"],
      customers: ["customer", "payment", "chat-studio", "csv"],
      chat: ["chat-studio", "customer", "support"],
      more: ["backup", "restore", "csv", "delete-account"],
      login: ["login", "signup", "forgot", "otp"],
      signup: ["signup", "login", "otp", "privacy"]
    }[view] || [];

    const seen = new Set();
    const inView = [];
    const others = [];
    CHIPS.forEach((label) => {
      const entry = matchChip(label);
      if (!entry || seen.has(entry.id)) return;
      seen.add(entry.id);
      const item = { label: label, id: entry.id, entry: entry };
      if (entry.view === view) inView.push(item);
      else others.push(item);
    });

    const items = inView.concat(others).slice(0, 5);
    /* Always top up to five, with current-view topics first. */
    viewIds.concat(["invoice", "payment", "backup", "otp", "support", "profit", "language", "privacy"]).forEach((id) => {
      if (items.length >= 5 || seen.has(id)) return;
      const entry = KB.find((e) => e.id === id);
      if (!entry) return;
      seen.add(id);
      items.push({ label: entry.q, id: id, entry: entry });
    });
    return items.slice(0, 5);
  }

  function quickChips() {
    return quickChipItems().map((item) => item.label);
  }

  function addMessage(role, text, entry) {
    const row = document.createElement("div");
    row.className = "help-msg " + role;
    const bubble = document.createElement("div");
    bubble.className = "help-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);

    if (role === "bot" && entry) {
      if (entry.action || entry.view) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "help-action";
        btn.textContent = actionLabel(entry);
        btn.addEventListener("click", () => runAction(entry));
        bubble.appendChild(btn);
      }
      const feedback = document.createElement("div");
      feedback.className = "help-feedback";
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "help-feedback-btn";
      yes.setAttribute("data-help-yes", "");
      yes.setAttribute("aria-label", tr("Madadgar", "Helpful"));
      yes.textContent = "👍";
      const no = document.createElement("button");
      no.type = "button";
      no.className = "help-feedback-btn";
      no.setAttribute("data-help-no", "");
      no.setAttribute("aria-label", tr("Madad nahi mili", "Not helpful"));
      no.textContent = "👎";
      yes.addEventListener("click", () => {
        feedback.textContent = tr("Shukriya, aapki raay mil gayi.", "Thanks for the feedback!");
      });
      no.addEventListener("click", () => {
        feedback.textContent = tr(
          "Maaf karo, dobara poochho ya " + SUPPORT_EMAIL + " par email kar do.",
          "Sorry about that. Try another question or email " + SUPPORT_EMAIL + "."
        );
      });
      feedback.appendChild(yes);
      feedback.appendChild(no);
      bubble.appendChild(feedback);
    }
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function actionLabel(entry) {
    if (!entry) return tr("Section kholein", "Open section");
    const actions = {
      backup: tr("Backup download karein", "Download backup"),
      changePassword: tr("Password badlein", "Change password"),
      deleteAccount: tr("Account delete karein", "Delete account"),
      theme: tr("Theme badlein", "Toggle theme"),
      support: tr("Support ko email karein", "Email support"),
      language: tr("Zabaan badlein", "Switch language"),
      privacy: tr("Privacy page kholein", "Open Privacy page"),
      terms: tr("Terms page kholein", "Open Terms page")
    };
    if (entry.action && actions[entry.action]) return actions[entry.action];
    const views = {
      home: tr("Home kholein", "Open Home"),
      products: tr("Products kholein", "Open Products"),
      orders: tr("Orders kholein", "Open Orders"),
      customers: tr("Customers kholein", "Open Customers"),
      chat: tr("Chat Studio kholein", "Open Chat Studio"),
      more: tr("More kholein", "Open More"),
      login: tr("Login kholein", "Open log in"),
      signup: tr("Account banayein", "Create account"),
      forgot: tr("Password reset karein", "Reset password"),
      auth: tr("Auth screen kholein", "Open sign in")
    };
    return (entry.view && views[entry.view]) || tr("Section kholein", "Open section");
  }

  function runAction(entry) {
    if (!entry) return;
    const action = entry.action;

    /* login/signup/forgot target the auth screen, never an app view. */
    if (entry.view === "login" || entry.view === "signup" || action === "auth") {
      const tab = entry.view === "signup" ? "signup" : "login";
      if (isSignedIn()) {
        addMessage("bot", tr(
          "Tum pehle se hi login ho — ye step karne ki zarurat nahi.",
          "You are already signed in — you do not need this step."
        ), null);
        return;
      }
      if (showAuth(tab)) { setOpen(false); return; }
      addMessage("bot", tr(
        "Pehle login ya account bana lo, phir ye step dekhein.",
        "Please log in or create an account first."
      ), null);
      return;
    }

    /* These actions touch signed-in account data. */
    if (action === "backup" || action === "changePassword" || action === "deleteAccount" || action === "theme") {
      if (!isSignedIn()) {
        addMessage("bot", tr(
          "Pehle login kar lo, phir main ye kaam kar dunga.",
          "Please log in first and I can do that for you."
        ), null);
        return;
      }
    }

    const unavailable = tr(
      "Ye feature abhi available nahi hai — dobara koshish karein.",
      "That feature is not available right now — please try again."
    );

    if (action === "backup") {
      if (!callBridge("exportBackup")) addMessage("bot", unavailable, null);
      return;
    }
    if (action === "changePassword") {
      if (!callBridge("changePassword")) addMessage("bot", unavailable, null);
      return;
    }
    if (action === "deleteAccount") {
      const btn = document.getElementById("deleteAccountBtn");
      if (btn) btn.click(); else addMessage("bot", unavailable, null);
      return;
    }
    if (action === "theme") {
      const btn = document.getElementById("themeBtn");
      if (btn) btn.click(); else addMessage("bot", unavailable, null);
      return;
    }
    if (action === "support") {
      window.location.href = "mailto:" + SUPPORT_EMAIL + "?subject=SellMate%20help";
      return;
    }
    if (action === "language") {
      if (LANG && typeof LANG.set === "function") {
        LANG.set(LANG.isEnglish() ? "ur" : "en");
      } else {
        const toggle = document.querySelector("[data-lang-toggle]");
        if (toggle) toggle.click();
        else addMessage("bot", unavailable, null);
      }
      return;
    }
    if (action === "privacy") { window.location.href = "privacy.html"; return; }
    if (action === "terms") { window.location.href = "terms.html"; return; }

    const shell = document.getElementById("appShell");
    if (entry.view && shell && !shell.hidden) {
      if (callBridge("openView", entry.view)) return;
    }
    addMessage("bot", tr(
      "Ye step auth screen par hai — pehle login ya account bana lo.",
      "This step is on the sign-in screen — please log in or create an account first."
    ), null);
  }

  function showChips() {
    const old = panel.querySelector(".help-chips");
    if (old) old.remove();
    const box = document.createElement("div");
    box.className = "help-chips";
    quickChipItems().forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = item.label;
      chip.addEventListener("click", () => send(item.label, item.entry));
      box.appendChild(chip);
    });
    log.appendChild(box);
    log.scrollTop = log.scrollHeight;
  }

  function send(text, forcedEntry) {
    const value = String(text || "").trim();
    if (!value) return;
    addMessage("user", value);
    input.value = "";
    const typing = document.createElement("div");
    typing.className = "help-msg bot typing";
    typing.innerHTML = '<div class="help-bubble"><span></span><span></span><span></span></div>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    window.setTimeout(() => {
      typing.remove();
      const match = forcedEntry ? { entry: forcedEntry } : findAnswer(value);
      if (match) {
        addMessage("bot", match.entry.a, match.entry);
      } else {
        addMessage("bot", tr(
          "Maaf karo, ye sawal main abhi samajh nahi paya. Neeche se kisi topic ko choose karo ya " + SUPPORT_EMAIL + " par email kar do.",
          "Sorry, I did not understand that question. Choose a topic below or email " + SUPPORT_EMAIL + "."
        ), null);
        const old = panel.querySelector(".help-chips");
        if (old) old.remove();
        showChips();
      }
    }, 420);
  }

  function greeting() {
    const names = {
      home: "Home", products: "Products", orders: "Orders", customers: "Customers", chat: "Chat Studio", more: "More",
      login: tr("login", "sign in"), signup: tr("signup", "sign up")
    };
    const where = names[currentView()] || "Home";
    return tr(
      "Assalam o alaikum! Main SellMate assistant hoon. Tum abhi " + where + " par ho. Koi feature samajhna ho ya issue aa raha ho to poochho — main step-by-step batata hoon.",
      "Hello! I am the SellMate assistant. You are currently on " + where + ". Ask me about any feature or issue and I will guide you step by step."
    );
  }

  function setOpen(next, opts) {
    const restoreFocus = !!(opts && opts.restoreFocus);
    open = next;
    panel.hidden = !open;
    fab.setAttribute("aria-expanded", String(open));
    fab.textContent = open ? "×" : "💬";
    if (open) {
      if (!greeted) {
        greeted = true;
        addMessage("bot", greeting(), null);
        showChips();
      }
      window.setTimeout(() => { if (open && input) input.focus(); }, 30);
    } else if (restoreFocus && fab) {
      fab.focus();
    }
  }

  function build() {
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "help-fab";
    fab.textContent = "💬";
    fab.setAttribute("aria-label", tr("SellMate help kholein", "Open SellMate help"));
    fab.setAttribute("aria-expanded", "false");

    panel = document.createElement("section");
    panel.className = "help-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", tr("SellMate madadgar", "SellMate help assistant"));
    panel.innerHTML = `
      <header class="help-head">
        <div><strong class="help-title">SellMate Assistant</strong><small class="help-subtitle">Free help · offline</small></div>
        <button type="button" class="help-close" aria-label="Close help">×</button>
      </header>
      <div class="help-log" aria-live="polite"></div>
      <form class="help-form">
        <input type="text" placeholder="${esc(tr("Apna sawal likho…", "Ask your question…"))}" aria-label="${esc(tr("Apna sawal likho", "Ask a question"))}" autocomplete="off" />
        <button type="submit" aria-label="${esc(tr("Sawal bhejein", "Send"))}">➤</button>
      </form>`;

    log = panel.querySelector(".help-log");
    input = panel.querySelector(".help-form input");
    headerTitle = panel.querySelector(".help-title");
    headerSub = panel.querySelector(".help-subtitle");
    closeBtn = panel.querySelector(".help-close");
    sendBtn = panel.querySelector(".help-form button");

    fab.addEventListener("click", () => setOpen(!open));
    closeBtn.addEventListener("click", () => setOpen(false, { restoreFocus: true }));
    panel.querySelector(".help-form").addEventListener("submit", (event) => {
      event.preventDefault();
      send(input.value);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) setOpen(false, { restoreFocus: true });
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    applyLanguage();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  if (LANG) LANG.onChange(applyLanguage);
  applyLanguage();
})();
