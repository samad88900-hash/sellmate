/* SellMate language preference — localStorage first, cloud sync handled in script.js. */
(function () {
  "use strict";

  const KEY = "sellmate-language";
  let lang = "ur";
  let explicit = false;
  const listeners = new Set();

  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ur") {
      lang = saved;
      explicit = true;
    }
  } catch (_) {}

  function applyRoot() {
    document.documentElement.lang = lang === "en" ? "en" : "ur";
  }

  const api = {
    get() { return lang; },
    isEnglish() { return lang === "en"; },
    hasPreference() { return explicit; },
    set(next, markExplicit) {
      const value = next === "en" ? "en" : "ur";
      const changed = value !== lang;
      lang = value;
      if (markExplicit !== false) explicit = true;
      try { localStorage.setItem(KEY, lang); } catch (_) {}
      applyRoot();
      if (changed) listeners.forEach((fn) => { try { fn(lang); } catch (_) {} });
      return lang;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };

  applyRoot();
  window.SellMateLang = api;
})();
