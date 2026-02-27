'use client';

import { motion } from 'framer-motion';

const FEATURES = [
  {
    large: true,
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14M15.54 8.46a5 5 0 010 7.07M8.46 8.46a5 5 0 000 7.07" />
      </svg>
    ),
    title: 'MCP Native Integration',
    desc: 'Runs as a Model Context Protocol server. Say "test my app" in Cursor or Windsurf and the entire pipeline kicks off — detect, generate, run, analyze, report.',
    extra: (
      <div className="mt-4 rounded-xl bg-black/40 border border-white/5 p-4 font-mono text-sm">
        <div className="text-[#4A6280]">// In your IDE chat</div>
        <div className="text-emerald-400">&quot;Test my app using testbot mcp&quot;</div>
        <div className="text-[#8BA4C8] mt-1">→ Auto-detects config...</div>
        <div className="text-[#8BA4C8]">→ Generating 12 tests...</div>
        <div className="text-emerald-400">→ ✓ 11 passed, 1 analyzed</div>
      </div>
    ),
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Zero-Config Setup',
    desc: 'Auto-detects your framework, port, and start command. Works with React, Next.js, Express, Django, FastAPI, and more out of the box.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v3" />
        <path d="M15 13v-2a3 3 0 00-6 0v2" />
      </svg>
    ),
    title: 'AI Test Generation',
    desc: 'No existing tests? OpenAI analyzes your codebase structure and generates comprehensive Playwright test suites covering pages, forms, APIs, and auth flows.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: 'AI Failure Analysis',
    desc: 'When tests fail, AI providers (Sarvam, OpenAI, Cascade) diagnose root causes and generate actionable fix suggestions — not just stack traces.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: 'Interactive Dashboard',
    desc: 'Beautiful browser-based dashboard with KPI cards, pass/fail charts, sortable test tables, and built-in screenshot/video/trace viewers.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: 'Jira Integration',
    desc: 'Connect your Jira project and TestBot automatically fetches user stories, generating tests directly from acceptance criteria — no manual translation needed.',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l2-4" />
      </svg>
    ),
    title: 'Multi-Browser Testing',
    desc: 'Run tests across Chrome, Firefox, and Safari in parallel. Capture screenshots on failure, record videos, and generate Playwright trace files for debugging.',
  },
  {
    large: true,
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Multiple AI Providers',
    desc: 'Plug in your preferred AI backend for failure analysis. TestBot supports Sarvam AI (multilingual), OpenAI GPT-4, Cascade, and Windsurf — switchable with a single env variable.',
    extra: (
      <div className="mt-4 flex flex-wrap gap-2">
        {['Sarvam AI', 'OpenAI', 'Cascade', 'Windsurf'].map(p => (
          <span key={p} className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#60A5FA] text-xs font-semibold">{p}</span>
        ))}
      </div>
    ),
  },
];

export default function Features() {
  return (
    <section className="py-24 relative" id="features">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[#60A5FA] text-xs font-semibold uppercase tracking-wider mb-4">
            Features
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-[#F0F6FF] leading-tight mb-4">
            Everything you need.<br />
            <span className="gradient-text">Nothing you don&apos;t.</span>
          </h2>
          <p className="text-[#8BA4C8] text-lg max-w-xl mx-auto">
            TestBot MCP is purpose-built for AI-native development teams who want testing to just work.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: (i % 3) * 0.1, duration: 0.5 }}
              className={`relative glass-card rounded-2xl p-6 group hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 cursor-default overflow-hidden ${feat.large ? 'md:col-span-2 lg:col-span-1' : ''}`}
            >
              {/* Hover glow bg */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 70%)' }}
              />

              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-700/20 border border-blue-500/20 flex items-center justify-center text-[#60A5FA] mb-4 group-hover:border-blue-500/40 transition-colors">
                  {feat.icon}
                </div>
                <h3 className="text-[#F0F6FF] font-bold text-lg mb-2">{feat.title}</h3>
                <p className="text-[#8BA4C8] text-sm leading-relaxed">{feat.desc}</p>
                {feat.extra}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
