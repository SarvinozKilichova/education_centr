(() => {
  'use strict';

  window.PE = window.PE || {};

  const CONFIG = {
    // Google Apps Script "Web app" URL (see backend/google-apps-script.gs)
    SHEETS_URL: 'https://script.google.com/macros/s/AKfycbyaISAG14T8IQD1cOzxN4Zv2sWz6ke3WqNC1F9mo7M5aPJfahF2SxNFWyNRk9St3mJo5Q/exec',
    TIMEOUT_MS: 15000,
  };

  class LeadError extends Error {
    constructor(code, userMessage) {
      super(code);
      this.name = 'LeadError';
      this.code = code;
      this.userMessage = userMessage;
    }
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function sendLead(payload) {
    // No URL configured yet: fail loudly instead of pretending it worked,
    // so a real misconfiguration on the live site is never mistaken for success.
    if (!CONFIG.SHEETS_URL) {
      console.error('[backend] SHEETS_URL is empty — set it in js/backend.js before going live.', payload);
      await wait(400);
      throw new LeadError('not-configured', "Sayt hali sozlanmagan. Iltimos, keyinroq urinib ko'ring.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    try {
      // Google Apps Script never sends an Access-Control-Allow-Origin header,
      // so a normal fetch always fails CORS here — no deployment setting fixes
      // that. "no-cors" sends the request without needing that header, at the
      // cost of making the response opaque (unreadable): we can't check
      // response.ok or parse JSON, so a fetch that resolves without throwing
      // is the only success signal available.
      await fetch(CONFIG.SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new LeadError('timeout', 'Server javob bermadi (vaqt tugadi).');
      }
      throw new LeadError('network', 'Internet aloqasini tekshiring.');
    } finally {
      clearTimeout(timer);
    }

    // A resolved, non-aborted fetch means the request reached Google — that's
    // as much confirmation as an opaque no-cors response can give.
    return { result: 'success' };
  }

  window.PE.sendLead = sendLead;
})();