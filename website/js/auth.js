/* ═══════════════════════════════════════════════════════════
   TestBot MCP — Auth Modal Logic
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Element refs ───────────────────────────────────────────── */
const backdrop     = document.getElementById('modal-backdrop');
const modalSignin  = document.getElementById('modal-signin');
const modalSignup  = document.getElementById('modal-signup');

const openSigninBtn  = document.getElementById('open-signin');
const openSignupBtn  = document.getElementById('open-signup');
const closeSigninBtn = document.getElementById('close-signin');
const closeSignupBtn = document.getElementById('close-signup');

const switchToSignup = document.getElementById('switch-to-signup');
const switchToSignin = document.getElementById('switch-to-signin');

/* ── Open / close helpers ───────────────────────────────────── */
function openModal(modal) {
  closeAllModals();
  backdrop.classList.add('active');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Focus first input
  const first = modal.querySelector('input');
  if (first) setTimeout(() => first.focus(), 280);
}

function closeAllModals() {
  backdrop.classList.remove('active');
  modalSignin.classList.remove('active');
  modalSignup.classList.remove('active');
  document.body.style.overflow = '';
}

/* ── Trigger buttons ────────────────────────────────────────── */
openSigninBtn.addEventListener('click', () => openModal(modalSignin));
openSignupBtn.addEventListener('click', () => openModal(modalSignup));

// Also hook pricing / hero CTAs
document.querySelectorAll('a[href="#get-started"], .btn-primary[href="#get-started"]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    openModal(modalSignup);
  });
});

closeSigninBtn.addEventListener('click', closeAllModals);
closeSignupBtn.addEventListener('click', closeAllModals);
backdrop.addEventListener('click', closeAllModals);

switchToSignup.addEventListener('click', () => openModal(modalSignup));
switchToSignin.addEventListener('click', () => openModal(modalSignin));

// Esc key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

/* ── Password visibility toggle ─────────────────────────────── */
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    // Swap icon opacity as a simple visual cue
    btn.style.opacity = isText ? '1' : '0.5';
  });
});

/* ── Password strength meter ─────────────────────────────────── */
const pwInput    = document.getElementById('signup-password');
const pwFill     = document.getElementById('pw-strength-fill');
const pwLabel    = document.getElementById('pw-strength-label');

const strengthLevels = [
  { label: '',        color: 'transparent', width: '0%'  },
  { label: 'Weak',    color: '#F87171',     width: '25%' },
  { label: 'Fair',    color: '#FBBF24',     width: '50%' },
  { label: 'Good',    color: '#60A5FA',     width: '75%' },
  { label: 'Strong',  color: '#34D399',     width: '100%'},
];

function measureStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, Math.ceil(score * 0.8));
}

if (pwInput) {
  pwInput.addEventListener('input', () => {
    const level = measureStrength(pwInput.value);
    const s = strengthLevels[level];
    pwFill.style.width      = s.width;
    pwFill.style.background = s.color;
    pwLabel.textContent     = s.label;
    pwLabel.style.color     = s.color;
  });
}

/* ── Validation helpers ──────────────────────────────────────── */
function showError(inputEl, errEl, msg) {
  inputEl.classList.add('input-error');
  inputEl.classList.remove('input-valid');
  errEl.textContent = msg;
}
function clearError(inputEl, errEl) {
  inputEl.classList.remove('input-error');
  errEl.textContent = '';
}
function markValid(inputEl) {
  inputEl.classList.remove('input-error');
  inputEl.classList.add('input-valid');
}

function validateEmail(val) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/* ── Live validation on blur ─────────────────────────────────── */
// Sign-in form
const siEmail   = document.getElementById('signin-email');
const siPw      = document.getElementById('signin-password');
const siEmailE  = document.getElementById('signin-email-err');
const siPwE     = document.getElementById('signin-pw-err');

if (siEmail) {
  siEmail.addEventListener('blur', () => {
    if (!siEmail.value) showError(siEmail, siEmailE, 'Email is required.');
    else if (!validateEmail(siEmail.value)) showError(siEmail, siEmailE, 'Enter a valid email address.');
    else { clearError(siEmail, siEmailE); markValid(siEmail); }
  });
  siEmail.addEventListener('input', () => clearError(siEmail, siEmailE));
}
if (siPw) {
  siPw.addEventListener('blur', () => {
    if (!siPw.value) showError(siPw, siPwE, 'Password is required.');
    else { clearError(siPw, siPwE); markValid(siPw); }
  });
  siPw.addEventListener('input', () => clearError(siPw, siPwE));
}

// Sign-up form
const suFname  = document.getElementById('signup-fname');
const suLname  = document.getElementById('signup-lname');
const suEmail  = document.getElementById('signup-email');
const suPw     = document.getElementById('signup-password');
const suTerms  = document.getElementById('signup-terms');

const suFnameE = document.getElementById('signup-fname-err');
const suLnameE = document.getElementById('signup-lname-err');
const suEmailE = document.getElementById('signup-email-err');
const suPwE    = document.getElementById('signup-pw-err');
const suTermsE = document.getElementById('signup-terms-err');

if (suFname) {
  suFname.addEventListener('blur', () => {
    if (!suFname.value.trim()) showError(suFname, suFnameE, 'First name is required.');
    else { clearError(suFname, suFnameE); markValid(suFname); }
  });
  suFname.addEventListener('input', () => clearError(suFname, suFnameE));
}
if (suLname) {
  suLname.addEventListener('blur', () => {
    if (!suLname.value.trim()) showError(suLname, suLnameE, 'Last name is required.');
    else { clearError(suLname, suLnameE); markValid(suLname); }
  });
  suLname.addEventListener('input', () => clearError(suLname, suLnameE));
}
if (suEmail) {
  suEmail.addEventListener('blur', () => {
    if (!suEmail.value) showError(suEmail, suEmailE, 'Email is required.');
    else if (!validateEmail(suEmail.value)) showError(suEmail, suEmailE, 'Enter a valid email address.');
    else { clearError(suEmail, suEmailE); markValid(suEmail); }
  });
  suEmail.addEventListener('input', () => clearError(suEmail, suEmailE));
}
if (suPw) {
  suPw.addEventListener('blur', () => {
    if (!suPw.value) showError(suPw, suPwE, 'Password is required.');
    else if (suPw.value.length < 8) showError(suPw, suPwE, 'Must be at least 8 characters.');
    else { clearError(suPw, suPwE); markValid(suPw); }
  });
  suPw.addEventListener('input', () => clearError(suPw, suPwE));
}

/* ── Toast helper ───────────────────────────────────────────── */
function showToast(toastEl, type, msg) {
  toastEl.textContent = msg;
  toastEl.className = `auth-toast toast-${type}`;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 5000);
}

/* ── Loading state ───────────────────────────────────────────── */
function setLoading(btnEl, loading) {
  const text    = btnEl.querySelector('.btn-text');
  const spinner = btnEl.querySelector('.btn-spinner');
  btnEl.disabled = loading;
  text.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

/* ── Simulate auth (replace with real API calls) ─────────────── */
function fakeAuthDelay(ms = 1400) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ── Sign-in form submit ─────────────────────────────────────── */
const signinForm   = document.getElementById('signin-form');
const signinSubmit = document.getElementById('signin-submit');
const signinToast  = document.getElementById('signin-toast');

if (signinForm) {
  signinForm.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;

    if (!siEmail.value || !validateEmail(siEmail.value)) {
      showError(siEmail, siEmailE, 'Enter a valid email address.'); valid = false;
    }
    if (!siPw.value) {
      showError(siPw, siPwE, 'Password is required.'); valid = false;
    }
    if (!valid) return;

    setLoading(signinSubmit, true);
    await fakeAuthDelay();
    setLoading(signinSubmit, false);

    // Demo: treat any valid email/pw as success
    handleSignInSuccess({ email: siEmail.value });
  });
}

/* ── Sign-up form submit ─────────────────────────────────────── */
const signupForm   = document.getElementById('signup-form');
const signupSubmit = document.getElementById('signup-submit');
const signupToast  = document.getElementById('signup-toast');

if (signupForm) {
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;

    if (!suFname.value.trim()) { showError(suFname, suFnameE, 'First name is required.'); valid = false; }
    if (!suLname.value.trim()) { showError(suLname, suLnameE, 'Last name is required.'); valid = false; }
    if (!suEmail.value || !validateEmail(suEmail.value)) {
      showError(suEmail, suEmailE, 'Enter a valid email address.'); valid = false;
    }
    if (!suPw.value || suPw.value.length < 8) {
      showError(suPw, suPwE, 'Must be at least 8 characters.'); valid = false;
    }
    if (!suTerms.checked) {
      suTermsE.textContent = 'You must accept the terms.'; valid = false;
    } else {
      suTermsE.textContent = '';
    }
    if (!valid) return;

    setLoading(signupSubmit, true);
    await fakeAuthDelay(1600);
    setLoading(signupSubmit, false);

    handleSignUpSuccess({ name: suFname.value, email: suEmail.value });
  });
}

/* ── OAuth buttons (stub) ────────────────────────────────────── */
['signin-github','signin-google','signup-github','signup-google'].forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const provider = id.includes('github') ? 'GitHub' : 'Google';
    const action   = id.startsWith('signin') ? 'sign-in' : 'sign-up';
    // In production: redirect to OAuth flow
    alert(`${provider} ${action} would redirect to OAuth. Connect your backend to enable this.`);
  });
});

/* ── Post-auth state ─────────────────────────────────────────── */
function handleSignInSuccess(user) {
  closeAllModals();
  setLoggedInNav(user);
}

function handleSignUpSuccess(user) {
  showToast(signupToast, 'success', `Welcome, ${user.name}! Your account is ready.`);
  setTimeout(() => {
    closeAllModals();
    setLoggedInNav(user);
  }, 1800);
}

function setLoggedInNav(user) {
  const initials = (user.name || user.email || 'U')[0].toUpperCase();
  const navCta = document.querySelector('.nav-cta');
  if (!navCta) return;

  // Replace sign-in/up buttons with avatar dropdown
  navCta.innerHTML = `
    <div class="nav-avatar" tabindex="0">
      <div class="nav-avatar-img">${initials}</div>
      <span class="nav-avatar-name">${user.name || user.email.split('@')[0]}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
      <div class="nav-dropdown">
        <a href="#">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Profile
        </a>
        <a href="#">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          Dashboard
        </a>
        <a href="#">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
          Settings
        </a>
        <div class="nav-dropdown-divider"></div>
        <button class="signout-btn" id="signout-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Sign Out
        </button>
      </div>
    </div>`;

  document.getElementById('signout-btn').addEventListener('click', handleSignOut);
}

function handleSignOut() {
  const navCta = document.querySelector('.nav-cta');
  if (!navCta) return;
  navCta.innerHTML = `
    <button class="btn-ghost" id="open-signin">Sign In</button>
    <button class="btn-primary" id="open-signup">Sign Up Free</button>`;
  document.getElementById('open-signin').addEventListener('click', () => openModal(modalSignin));
  document.getElementById('open-signup').addEventListener('click', () => openModal(modalSignup));
}

/* ── Forgot password link (stub) ─────────────────────────────── */
const forgotLink = document.getElementById('forgot-link');
if (forgotLink) {
  forgotLink.addEventListener('click', e => {
    e.preventDefault();
    showToast(signinToast, 'success', 'Password reset link sent! Check your inbox.');
  });
}
