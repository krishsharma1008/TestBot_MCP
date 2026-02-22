/* ═══════════════════════════════════════════════════════════
   TestBot MCP — Main JavaScript
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Navbar scroll effect ───────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
}, { passive: true });

/* ── Mobile hamburger ───────────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.querySelector('.nav-links');
const navCta    = document.querySelector('.nav-cta');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navCta.classList.toggle('open');
  hamburger.classList.toggle('open');
});

// Close menu on link click
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navCta.classList.remove('open');
    hamburger.classList.remove('open');
  });
});

/* ── Particle canvas ────────────────────────────────────────── */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let particles = [];
  let animFrame;
  let W, H;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((W * H) / 22000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        r:  Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        o:  Math.random() * 0.5 + 0.1,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connection lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(59,130,246,${0.12 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw dots
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96,165,250,${p.o})`;
      ctx.fill();

      // Move
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });

    animFrame = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  }, { passive: true });

  resize();
  createParticles();
  draw();
})();

/* ── Terminal typing animation ──────────────────────────────── */
(function initTerminal() {
  const typedEl  = document.getElementById('typed-text');
  const outputEl = document.getElementById('terminal-output');
  if (!typedEl || !outputEl) return;

  const message = 'Test my app using testbot mcp';

  const outputLines = [
    { icon: '🔍', text: 'Auto-detecting project configuration...', cls: 't-info',    delay: 0   },
    { icon: '✓',  text: 'Detected: Next.js on port 3000',          cls: 't-success', delay: 600 },
    { icon: '🤖', text: 'Generating tests with OpenAI GPT-4...',   cls: 't-info',    delay: 1200 },
    { icon: '✓',  text: '14 test files generated',                 cls: 't-success', delay: 2000 },
    { icon: '▶',  text: 'Running Playwright across 3 browsers...', cls: 't-info',    delay: 2600 },
    { icon: '✓',  text: '47 tests passed',                         cls: 't-success', delay: 4000 },
    { icon: '✗',  text: '3 tests failed — analyzing with AI',      cls: 't-warn',    delay: 4200 },
    { icon: '📊', text: 'Opening dashboard in browser...',         cls: 't-info',    delay: 5000 },
    { icon: '✓',  text: 'Done! Report ready at localhost:3001',    cls: 't-success', delay: 5600 },
  ];

  let charIdx = 0;
  let phase = 'typing'; // 'typing' | 'output' | 'reset'

  function typeChar() {
    if (charIdx < message.length) {
      typedEl.textContent += message[charIdx++];
      setTimeout(typeChar, 45 + Math.random() * 30);
    } else {
      phase = 'output';
      scheduleOutput(0);
    }
  }

  function scheduleOutput(idx) {
    if (idx >= outputLines.length) {
      // Restart after a pause
      setTimeout(resetTerminal, 3000);
      return;
    }
    const line = outputLines[idx];
    setTimeout(() => {
      appendLine(line);
      scheduleOutput(idx + 1);
    }, line.delay + (idx === 0 ? 300 : 0));
  }

  function appendLine({ icon, text, cls }) {
    const el = document.createElement('div');
    el.className = `t-line ${cls}`;
    el.style.animationDelay = '0ms';
    el.innerHTML = `<span class="t-icon">${icon}</span><span>${text}</span>`;
    outputEl.appendChild(el);
    // Auto-scroll
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function resetTerminal() {
    typedEl.textContent = '';
    outputEl.innerHTML  = '';
    charIdx = 0;
    setTimeout(typeChar, 800);
  }

  // Start after a short delay
  setTimeout(typeChar, 1200);
})();

/* ── Intersection Observer for reveal animations ────────────── */
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

/* ── Counter animation for stats banner ─────────────────────── */
(function initCounters() {
  const statItems = document.querySelectorAll('.stat-item[data-target]');
  if (!statItems.length) return;

  function animateCount(el, target) {
    const countEl = el.querySelector('.count');
    if (!countEl) return;
    let start = 0;
    const duration = 1800;
    const step = timestamp => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      countEl.textContent = Math.floor(eased * target);
      if (progress < 1) requestAnimationFrame(step);
      else countEl.textContent = target;
    };
    requestAnimationFrame(step);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        if (!isNaN(target)) animateCount(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  statItems.forEach(el => observer.observe(el));
})();

/* ── Smooth active nav link highlighting ────────────────────── */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.style.color = '';
          if (link.getAttribute('href') === `#${entry.target.id}`) {
            link.style.color = 'var(--blue-400)';
          }
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
})();

/* ── Pipeline steps stagger animation ───────────────────────── */
(function initPipelineSteps() {
  const steps = document.querySelectorAll('.pipeline-step');

  const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '0';
        entry.target.style.transform = 'translateX(-20px)';
        entry.target.style.transition = `opacity 0.6s ${idx * 0.1}s ease, transform 0.6s ${idx * 0.1}s ease`;
        requestAnimationFrame(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateX(0)';
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  steps.forEach(step => observer.observe(step));
})();

/* ── Feature card mouse-follow glow effect ──────────────────── */
(function initCardGlow() {
  document.querySelectorAll('.feature-card, .tool-card, .testimonial-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
      const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
      const bg = card.querySelector('.feature-card-bg');
      if (bg) {
        bg.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(59,130,246,0.1) 0%, transparent 60%)`;
        bg.style.opacity = '1';
      }
    });
    card.addEventListener('mouseleave', () => {
      const bg = card.querySelector('.feature-card-bg');
      if (bg) bg.style.opacity = '0';
    });
  });
})();

/* ── Hero terminal floating badges micro-interaction ────────── */
(function initBadgeFloat() {
  const badges = document.querySelectorAll('.stat-badge');
  badges.forEach((badge, i) => {
    let t = i * 1.5;
    function tick() {
      t += 0.015;
      const y = Math.sin(t) * 6;
      badge.style.transform = `translateY(${y}px)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
})();

/* ── Smooth scroll for anchor links ─────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── Dashboard mockup perspective tilt on mouse ─────────────── */
(function initDashTilt() {
  const mockup = document.querySelector('.mockup-browser');
  const wrapper = document.querySelector('.dashboard-mockup');
  if (!mockup || !wrapper) return;

  wrapper.addEventListener('mousemove', e => {
    const rect = wrapper.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    const rx = -dy * 6;
    const ry =  dx * 6;
    mockup.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });

  wrapper.addEventListener('mouseleave', () => {
    mockup.style.transform = 'rotateX(4deg) rotateY(0deg)';
  });
})();

/* ── Pricing card toggle highlight on hover ─────────────────── */
(function initPricingHover() {
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      if (!card.classList.contains('pricing-card-featured')) {
        card.style.borderColor = 'rgba(59,130,246,0.4)';
      }
    });
    card.addEventListener('mouseleave', () => {
      if (!card.classList.contains('pricing-card-featured')) {
        card.style.borderColor = '';
      }
    });
  });
})();

/* ── Intersection-based KPI fill animation ──────────────────── */
(function initKPIAnimation() {
  const fills = document.querySelectorAll('.kpi-fill');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.style.width; // trigger reflow
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  fills.forEach(el => observer.observe(el));
})();

console.log('%cTestBot MCP', 'color:#3B82F6;font-size:20px;font-weight:900;');
console.log('%cAI-native testing for modern developers.', 'color:#8BA4C8;font-size:13px;');
