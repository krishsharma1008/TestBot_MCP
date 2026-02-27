'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const TERMINAL_MESSAGE = 'Test my app using testbot mcp';

const OUTPUT_LINES = [
  { icon: '🔍', text: 'Auto-detecting project configuration...', cls: 'text-[#60A5FA]', delay: 0 },
  { icon: '✓', text: 'Detected: Next.js on port 3000', cls: 'text-emerald-400', delay: 600 },
  { icon: '🤖', text: 'Generating tests with OpenAI GPT-4...', cls: 'text-[#60A5FA]', delay: 1200 },
  { icon: '✓', text: '14 test files generated', cls: 'text-emerald-400', delay: 2000 },
  { icon: '▶', text: 'Running Playwright across 3 browsers...', cls: 'text-[#60A5FA]', delay: 2600 },
  { icon: '✓', text: '47 tests passed', cls: 'text-emerald-400', delay: 4000 },
  { icon: '✗', text: '3 tests failed — analyzing with AI', cls: 'text-amber-400', delay: 4200 },
  { icon: '📊', text: 'Opening dashboard in browser...', cls: 'text-[#60A5FA]', delay: 5000 },
  { icon: '✓', text: 'Done! Report ready at localhost:3001', cls: 'text-emerald-400', delay: 5600 },
];

export default function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [typedText, setTypedText] = useState('');
  const [outputLines, setOutputLines] = useState<typeof OUTPUT_LINES>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    interface Particle { x: number; y: number; r: number; vx: number; vy: number; o: number }
    let particles: Particle[] = [];
    let W = 0, H = 0;

    function resize() {
      W = canvas!.width = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
    }

    function createParticles() {
      particles = [];
      const count = Math.floor((W * H) / 22000);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.5 + 0.3,
          vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
          o: Math.random() * 0.5 + 0.1,
        });
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(59,130,246,${0.12 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }
      particles.forEach(p => {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(96,165,250,${p.o})`;
        ctx!.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });
      animId = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => { resize(); createParticles(); });
    ro.observe(canvas);
    resize(); createParticles(); draw();

    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  // Terminal typing animation
  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function runSequence() {
      setTypedText('');
      setOutputLines([]);
      let charIdx = 0;

      function typeChar() {
        if (cancelled) return;
        if (charIdx < TERMINAL_MESSAGE.length) {
          setTypedText(TERMINAL_MESSAGE.slice(0, charIdx + 1));
          charIdx++;
          const t = setTimeout(typeChar, 45 + Math.random() * 30);
          timeouts.push(t);
        } else {
          OUTPUT_LINES.forEach((line, idx) => {
            const baseDelay = 300;
            const t = setTimeout(() => {
              if (cancelled) return;
              setOutputLines(prev => [...prev, line]);
              if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }, baseDelay + line.delay);
            timeouts.push(t);
          });
          const resetDelay = 300 + OUTPUT_LINES[OUTPUT_LINES.length - 1].delay + 3000;
          const t = setTimeout(() => { if (!cancelled) runSequence(); }, resetDelay);
          timeouts.push(t);
        }
      }

      const t = setTimeout(typeChar, 1200);
      timeouts.push(t);
    }

    runSequence();
    return () => { cancelled = true; timeouts.forEach(clearTimeout); };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16" id="hero">
      {/* Background */}
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Orbs */}
        <div className="glow-orb animate-orb-1 w-96 h-96 bg-blue-600 top-20 -left-32" />
        <div className="glow-orb animate-orb-2 w-80 h-80 bg-blue-800 bottom-32 right-0" />
        <div className="glow-orb w-64 h-64 bg-cyan-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" style={{ filter: 'blur(100px)', animation: 'orb-drift-1 14s ease-in-out infinite' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-16 items-center py-20">
        {/* Left: Copy */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-[#60A5FA] text-sm font-medium w-fit"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Now in Beta — Free for developers
          </motion.div>

          {/* Heading */}
          <div className="flex flex-col gap-1">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="text-5xl lg:text-6xl font-black text-[#F0F6FF] leading-tight tracking-tight"
            >
              10x your dev speed
            </motion.h1>
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="text-5xl lg:text-6xl font-black gradient-text leading-tight tracking-tight"
            >
              with AI-native testing
            </motion.span>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-[#8BA4C8] text-lg leading-relaxed max-w-xl"
          >
            TestBot MCP is the missing verification layer of the agentic workflow. One command in your IDE — auto-detect, generate, run, and analyze tests with full AI intelligence.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-3"
          >
            <Link
              href="/home"
              className="btn-gradient flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl text-base"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Testing Free
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-[#8BA4C8] hover:text-[#F0F6FF] font-semibold px-6 py-3 rounded-xl text-base border border-white/10 hover:border-blue-500/40 transition-all hover:bg-white/5"
            >
              See how it works
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-3"
          >
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#050A18] bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-xs text-white font-bold">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-[#8BA4C8] text-sm">
              Loved by <strong className="text-[#F0F6FF]">500+</strong> developers worldwide
            </p>
          </motion.div>
        </motion.div>

        {/* Right: Terminal */}
        <motion.div
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative"
        >
          {/* Terminal window */}
          <div className="glass-card rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.15)]">
            {/* Title bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-[#4A6280] text-xs font-medium mx-auto">Cursor IDE — TestBot MCP</span>
            </div>

            {/* Body */}
            <div className="p-4 font-mono text-sm bg-[#050A18]/80" style={{ minHeight: '280px' }}>
              {/* User input line */}
              <div className="flex items-start gap-2 mb-3">
                <span className="text-[#60A5FA] font-semibold shrink-0">you</span>
                <span className="text-[#F0F6FF]">
                  {typedText}
                  <span className="inline-block w-0.5 h-4 bg-[#60A5FA] ml-0.5 animate-pulse align-middle" />
                </span>
              </div>

              {/* Output lines */}
              <div ref={terminalRef} className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {outputLines.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex items-start gap-2 ${line.cls}`}
                  >
                    <span className="shrink-0 w-4 text-center">{line.icon}</span>
                    <span>{line.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating stat badges */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="absolute -top-4 -right-4 glass-card rounded-xl px-3 py-2 flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          >
            <span className="text-emerald-400 font-bold text-lg">✓</span>
            <div>
              <div className="text-[#F0F6FF] font-bold text-sm leading-none">47</div>
              <div className="text-[#8BA4C8] text-xs">Tests Passed</div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
            className="absolute top-1/3 -left-6 glass-card rounded-xl px-3 py-2 flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          >
            <span className="text-yellow-400 text-lg">⚡</span>
            <div>
              <div className="text-[#F0F6FF] font-bold text-sm leading-none">3.2s</div>
              <div className="text-[#8BA4C8] text-xs">Avg Run Time</div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-4 -left-4 glass-card rounded-xl px-3 py-2 flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          >
            <span className="text-lg">🤖</span>
            <div>
              <div className="text-[#F0F6FF] font-bold text-sm leading-none">AI</div>
              <div className="text-[#8BA4C8] text-xs">Failure Analysis</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
