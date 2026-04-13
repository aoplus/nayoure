/* ═══════════════════════════════════════════════════════════════
   NAYOURE — MAIN JAVASCRIPT
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── NAV: scroll class + mobile toggle ──────────────────────────
const header    = document.getElementById('header');
const navToggle = document.getElementById('navToggle');
const navMenu   = document.getElementById('navMenu');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

navToggle.addEventListener('click', () => {
  const open = navMenu.classList.toggle('open');
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
});

// Close mobile menu when a link is clicked
navMenu.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', false);
  });
});

// ── REVEAL ANIMATION (IntersectionObserver) ─────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('[data-reveal]').forEach(el => {
  revealObserver.observe(el);
});

// ── COUNTER ANIMATION ───────────────────────────────────────────
function animateCounter(el, target, duration = 1600) {
  const start = performance.now();
  const from  = 0;

  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el     = entry.target;
      const target = parseInt(el.dataset.count, 10);
      animateCounter(el, target);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => {
  counterObserver.observe(el);
});

// ── FOOTER YEAR ─────────────────────────────────────────────────
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── CONTACT FORM ────────────────────────────────────────────────
const form       = document.getElementById('contactForm');
const submitBtn  = document.getElementById('submitBtn');
const btnText    = submitBtn?.querySelector('.btn__text');
const btnLoading = submitBtn?.querySelector('.btn__loading');
const formSuccess = document.getElementById('formSuccess');
const formError   = document.getElementById('formError');
const formErrorMsg = document.getElementById('formErrorMsg');

function showError(fieldId, errorId, msg) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (field)  field.classList.add('invalid');
  if (error)  error.textContent = msg;
}

function clearErrors() {
  form.querySelectorAll('input, textarea').forEach(f => f.classList.remove('invalid'));
  form.querySelectorAll('.form__error').forEach(e => e.textContent = '');
  formSuccess.hidden = true;
  formError.hidden   = true;
}

function validateForm(data) {
  let valid = true;

  if (!data.name.trim()) {
    showError('name', 'nameError', 'Please enter your name.');
    valid = false;
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email.trim()) {
    showError('email', 'emailError', 'Please enter your email address.');
    valid = false;
  } else if (!emailRe.test(data.email)) {
    showError('email', 'emailError', 'Please enter a valid email address.');
    valid = false;
  }

  if (!data.message.trim()) {
    showError('message', 'messageError', 'Please enter a message.');
    valid = false;
  } else if (data.message.trim().length < 10) {
    showError('message', 'messageError', 'Message must be at least 10 characters.');
    valid = false;
  }

  return valid;
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden     = loading;
  btnLoading.hidden  = !loading;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const data = {
    name:    document.getElementById('name').value,
    email:   document.getElementById('email').value,
    phone:   document.getElementById('phone').value,
    company: document.getElementById('company').value,
    inquiry: document.getElementById('inquiry').value,
    message: document.getElementById('message').value,
  };

  if (!validateForm(data)) return;

  setLoading(true);

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      form.reset();
      formSuccess.hidden = false;
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      formErrorMsg.textContent = result.error || 'Something went wrong. Please try again.';
      formError.hidden = false;
    }
  } catch {
    formErrorMsg.textContent = 'Network error. Please check your connection and try again.';
    formError.hidden = false;
  } finally {
    setLoading(false);
  }
});

// ── SMOOTH SCROLL for anchor links ──────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 72;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
