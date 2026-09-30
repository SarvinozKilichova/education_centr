(() => {
  'use strict';

  window.PE = window.PE || {};

  const CONFIG = {
    // Google Apps Script "Web app" URL (see backend/google-apps-script.gs)
    SHEETS_URL: 'https://script.google.com/macros/s/AKfycby_-QXQi4rjr1vYf3mqvmqe2OJPLzyaYnAlazUb_gYaKp2ha0XpdgGbVGnMsFG12-bM/exec',
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
    let response;

    try {
      response = await fetch(CONFIG.SHEETS_URL, {
        method: 'POST',
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

    if (!response.ok) {
      throw new LeadError('http', `Server xatosi (${response.status}).`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new LeadError('parse', "Serverdan noto'g'ri javob keldi.");
    }

    if (data.result !== 'success') {
      throw new LeadError('rejected', data.message || "Ma'lumot saqlanmadi.");
    }

    return data;
  }

  window.PE.sendLead = sendLead;
})();