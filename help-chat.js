/* SellMate Help Assistant — 100% free, offline, no API key. */
(function () {
  "use strict";

  const UR_KB = window.SELLMATE_HELP_KB || [];
  const EN_KB = window.SELLMATE_HELP_KB_EN || [];
  const UR_CHIPS = window.SELLMATE_HELP_CHIPS || [];
  const EN_CHIPS = window.SELLMATE_HELP_CHIPS_EN || [];
  const LANG = window.SellMateLang || null;
  const BRIDGE = window.SellMateHelp || {};
  const SUPPORT_EMAIL = "samad88900@gmail.com";

  let KB = UR_KB;
  let CHIPS = UR_CHIPS;

  function tr(ur, en) {
    return LANG && LANG.isEnglish() ? en : ur;
  }

  function applyLanguage() {
    const english = !!(LANG && LANG.isEnglish());
    KB = english ? EN_KB : UR_KB;
    CHIPS = english ? EN_CHIPS : UR_CHIPS;
    if (input) input.placeholder = tr("Apna sawal likho…", "Ask your question…");
    if (fab) fab.setAttribute("aria-label", tr("SellMate help kholein", "Open SellMate help"));
    if (panel) panel.setAttribute("aria-label", tr("SellMate madadgar", "SellMate help assistant"));
    if (panel) {
      log.innerHTML = "";
      greeted = false;
      if (open) setOpen(true);
    }
  }

  let fab = null;
  let panel = null;
  let log = null;
  let input = null;
  let open = false;
  let greeted = false;

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

  function currentView() {
    if (typeof BRIDGE.currentView === "function") return BRIDGE.currentView();
    const active = document.querySelector(".view.active");
    return active ? active.id.replace("view-", "") : "home";
  }

  function quickChips() {
    const view = currentView();
    const viewKey = {
      home: ["backup", "profit", "otp", "low-stock"],
      products: ["add-product", "edit-product", "low-stock", "invoice"],
      orders: ["invoice", "payment", "order-status", "new-order"],
      customers: ["customer", "payment", "chat-studio", "csv"],
      chat: ["chat-studio", "customer", "support"],
      more: ["backup", "restore", "csv", "delete-account"]
    }[view] || [];
    const ids = [...new Set([...viewKey, ...CHIPS.map((label, i) => {
      const found = KB.find((e) => e.q === label || norm(label).includes(norm(e.q)));
      return found ? found.id : null;
    }).filter(Boolean)])];
    return ids.slice(0, 5).map((id) => {
      const entry = KB.find((e) => e.id === id);
      return entry ? entry.q : null;
    }).filter(Boolean);
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
      feedback.innerHTML = '<button type="button" data-help-yes aria-label="Helpful">👍</button><button type="button" data-help-no aria-label="Not helpful">👎</button>';
      feedback.querySelector("[data-help-yes]").addEventListener("click", () => {
        feedback.textContent = tr("Thanks for the feedback!", "Thanks for the feedback!");
      });
      feedback.querySelector("[data-help-no]").addEventListener("click", () => {
        feedback.innerHTML = tr(
          "Sorry about that. Try another question or email " + esc(SUPPORT_EMAIL) + ".",
          "Sorry about that. Try another question or email " + esc(SUPPORT_EMAIL) + "."
        );
      });
      bubble.appendChild(feedback);
    }
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function actionLabel(entry) {
    if (entry.action === "backup") return "Open backup";
    if (entry.action === "changePassword") return "Change password";
    if (entry.action === "deleteAccount") return "Delete account";
    if (entry.action === "theme") return "Toggle theme";
    if (entry.action === "support") return "Email support";
    const names = {
      home: "Open Home", products: "Open Products", orders: "Open Orders",
      customers: "Open Customers", chat: "Open Chat Studio", more: "Open More"
    };
    return names[entry.view] || "Open section";
  }

  function runAction(entry) {
    if (entry.action === "backup" && typeof BRIDGE.exportBackup === "function") BRIDGE.exportBackup();
    else if (entry.action === "changePassword" && typeof BRIDGE.changePassword === "function") BRIDGE.changePassword();
    else if (entry.action === "deleteAccount") {
      const btn = document.getElementById("deleteAccountBtn");
      if (btn) btn.click();
    } else if (entry.action === "theme") {
      const btn = document.getElementById("themeBtn");
      if (btn) btn.click();
    } else if (entry.action === "support") {
      window.location.href = "mailto:" + SUPPORT_EMAIL + "?subject=SellMate%20help";
    } else if (entry.view && typeof BRIDGE.openView === "function" && document.getElementById("appShell") && !document.getElementById("appShell").hidden) {
      BRIDGE.openView(entry.view);
    } else {
      addMessage("bot", tr("Ye step auth screen par hai — pehle login ya account bana lo.", "This step is on the sign-in screen — please log in or create an account first."), null);
    }
  }

  function showChips() {
    const old = panel.querySelector(".help-chips");
    if (old) old.remove();
    const box = document.createElement("div");
    box.className = "help-chips";
    quickChips().forEach((label) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = label;
      chip.addEventListener("click", () => send(label));
      box.appendChild(chip);
    });
    log.appendChild(box);
    log.scrollTop = log.scrollHeight;
  }

  function send(text) {
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
      const match = findAnswer(value);
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
      home: "Home", products: "Products", orders: "Orders", customers: "Customers", chat: "Chat Studio", more: "More"
    };
    const where = names[currentView()] || "Home";
    return tr(
      "Assalam o alaikum! Main SellMate assistant hoon. Tum abhi " + where + " par ho. Koi feature samajhna ho ya issue aa raha ho to poochho — main step-by-step batata hoon.",
      "Hello! I am the SellMate assistant. You are currently on " + where + ". Ask me about any feature or issue and I will guide you step by step."
    );
  }

  function setOpen(next) {
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
      window.setTimeout(() => input.focus(), 30);
    }
  }

  function build() {
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "help-fab";
    fab.textContent = "💬";
    fab.setAttribute("aria-label", "Open SellMate help");
    fab.setAttribute("aria-expanded", "false");

    panel = document.createElement("section");
    panel.className = "help-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "SellMate help assistant");
    panel.innerHTML = `
      <header class="help-head">
        <div><strong>SellMate Assistant</strong><small>Free help · offline</small></div>
        <button type="button" class="help-close" aria-label="Close help">×</button>
      </header>
      <div class="help-log" aria-live="polite"></div>
      <form class="help-form">
        <input type="text" placeholder="${tr("Apna sawal likho…", "Ask your question…")}" aria-label="Ask a question" autocomplete="off" />
        <button type="submit" aria-label="Send">➤</button>
      </form>`;

    log = panel.querySelector(".help-log");
    input = panel.querySelector(".help-form input");

    fab.addEventListener("click", () => setOpen(!open));
    panel.querySelector(".help-close").addEventListener("click", () => setOpen(false));
    panel.querySelector(".help-form").addEventListener("submit", (event) => {
      event.preventDefault();
      send(input.value);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) setOpen(false);
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  if (LANG) LANG.onChange(applyLanguage);
  applyLanguage();
})();
