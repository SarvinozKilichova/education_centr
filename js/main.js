(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const hasObserver = 'IntersectionObserver' in window;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.PE = window.PE || {};

  /* ---------- Preloader ---------- */
  function initPreloader() {
    const preloader = $('#preloader');

    return new Promise((resolve) => {
      if (!preloader) return resolve();

      const MIN_VISIBLE_MS = 700;
      const MAX_WAIT_MS = 5000;
      const startedAt = performance.now();
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        preloader.classList.add('is-hidden');
        document.body.classList.remove('is-loading');
        setTimeout(() => preloader.remove(), 700);
        resolve();
      };

      const onLoad = () => {
        const elapsed = performance.now() - startedAt;
        setTimeout(finish, Math.max(0, MIN_VISIBLE_MS - elapsed));
      };

      if (document.readyState === 'complete') onLoad();
      else window.addEventListener('load', onLoad, { once: true });

      setTimeout(finish, MAX_WAIT_MS);
    });
  }

  /* ---------- Header ---------- */
  function initHeader() {
    const header = $('#header');
    if (!header) return;

    let ticking = false;
    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  function initMobileNav() {
    const burger = $('#burger');
    const nav = $('#nav');
    if (!burger || !nav) return;

    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
    };

    burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  function initActiveNav() {
    if (!hasObserver) return;

    const links = $$('.nav__link');
    const linkById = new Map(links.map((link) => [link.getAttribute('href').slice(1), link]));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        });
        const active = linkById.get(entry.target.id);
        if (active) {
          active.classList.add('is-active');
          active.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    [...linkById.keys()]
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach((section) => observer.observe(section));
  }

  /* ---------- Hero slider ---------- */
  function initHeroSlider() {
    const media = $('.hero__media');
    const slides = $$('.hero__slide');
    if (!media || slides.length < 2) return { start() {} };

    const prev = $('.hero__slider-arrow--prev', media);
    const next = $('.hero__slider-arrow--next', media);
    const counter = $('#heroSlideCurrent');
    const INTERVAL_MS = 5000;

    let index = 0;
    let timer = null;
    let started = false;
    let paused = false;

    const show = (target) => {
      slides[index].classList.remove('is-active');
      index = (target + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      if (counter) counter.textContent = String(index + 1);
    };

    const stop = () => {
      clearInterval(timer);
      timer = null;
    };

    const play = () => {
      if (reduceMotion || !started || paused || timer) return;
      timer = setInterval(() => show(index + 1), INTERVAL_MS);
    };

    const go = (target) => {
      show(target);
      stop();
      play();
    };

    prev?.addEventListener('click', () => go(index - 1));
    next?.addEventListener('click', () => go(index + 1));

    const pause = () => { paused = true; stop(); };
    const resume = () => { paused = false; play(); };
    media.addEventListener('mouseenter', pause);
    media.addEventListener('mouseleave', resume);
    media.addEventListener('focusin', pause);
    media.addEventListener('focusout', resume);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else play();
    });

    let touchStartX = null;
    media.addEventListener('touchstart', (event) => {
      touchStartX = event.touches[0].clientX;
    }, { passive: true });
    media.addEventListener('touchend', (event) => {
      if (touchStartX === null) return;
      const delta = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
    }, { passive: true });

    return {
      start() {
        started = true;
        play();
      },
    };
  }

  /* ---------- Carousels (teachers, testimonials) ---------- */
  function initCarousels() {
    $$('[data-carousel]').forEach((root) => {
      const track = $('[data-carousel-track]', root);
      const prev = $('[data-carousel-prev]', root);
      const next = $('[data-carousel-next]', root);
      if (!track || !prev || !next) return;

      const stepSize = () => {
        const card = track.firstElementChild;
        if (!card) return track.clientWidth;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        return card.getBoundingClientRect().width + gap;
      };

      const updateButtons = () => {
        const maxScroll = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= maxScroll;
      };

      let frame = 0;
      const scheduleUpdate = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(updateButtons);
      };

      prev.addEventListener('click', () => track.scrollBy({ left: -stepSize(), behavior: 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left: stepSize(), behavior: 'smooth' }));
      track.addEventListener('scroll', scheduleUpdate, { passive: true });
      window.addEventListener('resize', scheduleUpdate);

      // Mouse drag (touch devices already scroll natively)
      let dragging = false;
      let startX = 0;
      let startScroll = 0;

      track.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        if (track.scrollWidth <= track.clientWidth) return;
        dragging = true;
        startX = event.clientX;
        startScroll = track.scrollLeft;
        track.classList.add('is-dragging');
        track.setPointerCapture(event.pointerId);
      });

      track.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        track.scrollLeft = startScroll - (event.clientX - startX);
      });

      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => track.addEventListener(type, endDrag));

      updateButtons();
    });
  }

  /* ---------- Scroll reveal ---------- */
  const REVEAL_TARGETS = [
    '.hero__content > *',
    '.hero__media',
    '.feature-strip__item',
    '.section-head',
    '.course-card',
    '.why-us__intro',
    '.why-us__item',
    '.results__intro',
    '.stats__item',
    '.testimonials',
    '.teacher-track',
    '.process__item',
    '.plan-card',
    '.faq__item',
    '.contact__info',
    '.contact-form',
  ];

  function initReveal() {
    if (reduceMotion || !hasObserver) return;

    const items = [];
    REVEAL_TARGETS.forEach((selector) => {
      $$(selector).forEach((el) => {
        if (el.hasAttribute('data-reveal')) return;
        const siblingIndex = [...el.parentElement.children].indexOf(el);
        el.setAttribute('data-reveal', '');
        el.style.setProperty('--reveal-delay', `${Math.min(siblingIndex, 5) * 80}ms`);
        items.push(el);
      });
    });

    // Once revealed, hand the element back to its own transitions (hover effects etc.)
    const release = (el) => {
      el.removeAttribute('data-reveal');
      el.classList.remove('is-visible');
      el.style.removeProperty('--reveal-delay');
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        obs.unobserve(el);
        el.classList.add('is-visible');

        const onEnd = (event) => {
          if (event.target !== el || event.propertyName !== 'opacity') return;
          el.removeEventListener('transitionend', onEnd);
          release(el);
        };
        el.addEventListener('transitionend', onEnd);
        setTimeout(() => release(el), 1800);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Counters ---------- */
  function initCounters() {
    const counters = $$('[data-count]');
    if (!counters.length || reduceMotion || !hasObserver) return;

    const format = (el, value) => {
      const decimals = Number(el.dataset.decimals) || 0;
      return value.toFixed(decimals) + (el.dataset.suffix || '');
    };

    counters.forEach((el) => { el.textContent = format(el, 0); });

    const animate = (el) => {
      const target = parseFloat(el.dataset.count);
      const duration = 1400;
      const startedAt = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = format(el, target * eased);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        animate(entry.target);
      });
    }, { threshold: 0.6 });

    counters.forEach((el) => observer.observe(el));
  }

  /* ---------- FAQ (one open at a time) ---------- */
  function initFaq() {
    const items = $$('.faq__item');
    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  /* ---------- Sticky mobile CTA ---------- */
  function initStickyCta() {
    const cta = $('#stickyCta');
    if (!cta || !hasObserver) return;

    const watched = [$('#contact'), $('.footer')].filter(Boolean);
    const visible = new Set();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      cta.classList.toggle('is-hidden', visible.size > 0);
    }, { threshold: 0.1 });

    watched.forEach((el) => observer.observe(el));
  }

  /* ---------- Course buttons pre-select the form's course ---------- */
  function initCoursePrefill() {
    const select = $('#course');
    if (!select) return;

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-course]');
      if (!trigger) return;
      select.value = trigger.dataset.course;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ---------- Result modal ---------- */
  function initModal() {
    const dialog = $('#resultModal');
    if (!dialog) return;

    const title = $('#modalTitle');
    const text = $('#modalText');
    const detail = $('#modalDetail');

    const content = {
      success: {
        title: 'Rahmat!',
        text: "Arizangiz qabul qilindi. Tez orada mutaxassislarimiz siz bilan bog'lanadi.",
      },
      error: {
        title: 'Xatolik yuz berdi',
        text: "Qaytadan urinib ko'ring.",
      },
    };

    const open = (state = 'success', extra = '') => {
      dialog.dataset.state = state;
      title.textContent = content[state].title;
      text.textContent = content[state].text;
      detail.textContent = extra;
      detail.hidden = !extra;
      document.body.classList.add('modal-open');
      if (!dialog.open) dialog.showModal();
    };

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-modal-close]')) dialog.close();
    });
    dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));

    window.PE.modal = { open, close: () => dialog.close() };
  }

  /* ---------- Init ---------- */
  function init() {
    initHeader();
    initMobileNav();
    initActiveNav();
    initCarousels();
    initFaq();
    initStickyCta();
    initCoursePrefill();
    initModal();

    const heroSlider = initHeroSlider();

    initPreloader().then(() => {
      initReveal();
      initCounters();
      heroSlider.start();
    });
  }

  init();
})();