(() => {
  'use strict';

  const form = document.getElementById('contactForm');
  if (!form) return;

  window.PE = window.PE || {};

  const submitButton = document.getElementById('contactSubmit');
  const honeypot = form.elements.website;

  const PHONE_COUNTRY_CODE = '998';
  const PHONE_PREFIX = `+${PHONE_COUNTRY_CODE} `;
  const PHONE_LOCAL_LENGTH = 9;
  const NAME_MIN_LETTERS = 2;
  const NAME_PATTERN = /^[\p{L}][\p{L}\s'’ʻʼ.-]*$/u;

  /* ---------- Phone helpers ---------- */
  const getLocalDigits = (value) => {
    let digits = value.replace(/\D/g, '');
    // The field always holds "+998"; users may still type or paste the code again.
    while (digits.startsWith(PHONE_COUNTRY_CODE)) digits = digits.slice(PHONE_COUNTRY_CODE.length);
    return digits.slice(0, PHONE_LOCAL_LENGTH);
  };

  const formatPhone = (digits) => {
    const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
    return PHONE_PREFIX + groups.filter(Boolean).join(' ');
  };

  /* ---------- Rules: return an error message, or '' when valid ---------- */
  const rules = {
    fullName(value) {
      const name = value.trim();
      if (!name) return 'Ismingizni kiriting';
      const letters = name.replace(/[^\p{L}]/gu, '');
      if (letters.length < NAME_MIN_LETTERS) return "Ism kamida 2 ta harfdan iborat bo'lishi kerak";
      if (!NAME_PATTERN.test(name)) return "Ismda faqat harflar bo'lishi kerak";
      return '';
    },

    phone(value) {
      const digits = getLocalDigits(value);
      if (!digits) return 'Telefon raqamingizni kiriting';
      if (digits.length < PHONE_LOCAL_LENGTH) return `Raqam to'liq emas: ${PHONE_LOCAL_LENGTH} ta raqam kerak (${digits.length}/${PHONE_LOCAL_LENGTH})`;
      return '';
    },

    course(value) {
      return value ? '' : 'Qaysi kurs qiziqtirishini tanlang';
    },

    level(value) {
      return value ? '' : 'Darajangizni tanlang';
    },
  };

  const fields = Object.keys(rules)
    .map((name) => form.elements[name])
    .filter(Boolean);

  /* ---------- Error UI ---------- */
  const setError = (input, message) => {
    const wrapper = input.closest('.form-field');
    const output = form.querySelector(`[data-error-for="${input.name}"]`);
    const invalid = Boolean(message);

    wrapper?.classList.toggle('has-error', invalid);
    input.setAttribute('aria-invalid', String(invalid));
    if (output) {
      output.id = output.id || `${input.name}-error`;
      output.textContent = message;
      input.setAttribute('aria-describedby', output.id);
    }
  };

  const validateField = (input) => {
    const message = rules[input.name](input.value);
    setError(input, message);
    return !message;
  };

  const validateAll = () => {
    let firstInvalid = null;
    fields.forEach((input) => {
      if (!validateField(input) && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  };

  /* ---------- Live validation ---------- */
  fields.forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener(eventName, () => {
      if (input.closest('.form-field')?.classList.contains('has-error')) validateField(input);
    });
  });

  /* ---------- Phone mask ---------- */
  const phoneInput = form.elements.phone;

  const placeCaretAtEnd = (input) => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  };

  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value) phoneInput.value = PHONE_PREFIX;
    requestAnimationFrame(() => placeCaretAtEnd(phoneInput));
  });

  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatPhone(getLocalDigits(phoneInput.value));
    placeCaretAtEnd(phoneInput);
  });

  phoneInput.addEventListener('blur', () => {
    if (!getLocalDigits(phoneInput.value)) phoneInput.value = '';
  });

  /* ---------- Submit ---------- */
  const setLoading = (loading) => {
    submitButton.classList.toggle('is-loading', loading);
    submitButton.disabled = loading;
    submitButton.setAttribute('aria-busy', String(loading));
  };

  const optionText = (select) => select.options[select.selectedIndex]?.textContent.trim() ?? '';

  const buildPayload = () => ({
    name: form.elements.fullName.value.trim(),
    phone: `+${PHONE_COUNTRY_CODE}${getLocalDigits(phoneInput.value)}`,
    course: optionText(form.elements.course),
    level: optionText(form.elements.level),
    page: window.location.href,
    submittedAt: new Date().toISOString(),
  });

  const resetForm = () => {
    form.reset();
    fields.forEach((input) => setError(input, ''));
  };

  let submitting = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    const firstInvalid = validateAll();
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // Bots fill hidden fields; pretend everything worked and send nothing.
    if (honeypot?.value) {
      resetForm();
      window.PE.modal?.open('success');
      return;
    }

    submitting = true;
    setLoading(true);

    try {
      await window.PE.sendLead(buildPayload());
      resetForm();
      window.PE.modal?.open('success');
    } catch (error) {
      window.PE.modal?.open('error', error.userMessage || '');
    } finally {
      submitting = false;
      setLoading(false);
    }
  });
})();