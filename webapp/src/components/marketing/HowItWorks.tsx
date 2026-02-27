'use client';

import { motion } from 'framer-motion';

const STEPS = [
  {
    num: '01',
    title: 'Auto-Detect',
    desc: 'TestBot scans your package.json, playwright.config.js, and environment to detect framework, port, start command, and base URL. Zero config needed.',
    tags: ['React', 'Next.js', 'Express', 'Django', '+more'],
    tagColor: 'bg-white/5 text-[#8BA4C8] border-white/10',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'AI Test Generation',
    desc: 'No tests? No problem. TestBot analyzes your codebase — pages, API endpoints, forms, auth flows — and generates comprehensive Playwright tests using OpenAI.',
    tags: ['OpenAI GPT-4', 'Playwright', 'Jira Stories'],
    tagColor: 'bg-blue-500/10 text-[#60A5FA] border-blue-500/20',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Execute & Capture',
    desc: 'Tests run across browsers with full artifact capture — screenshots on failure, video recordings, and Playwright traces for deep debugging.',
    tags: ['Chrome', 'Firefox', 'Safari', 'Screenshots', 'Videos'],
    tagColor: 'bg-white/5 text-[#8BA4C8] border-white/10',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'AI Analysis & Dashboard',
    desc: 'Failures are analyzed with AI (Sarvam, OpenAI) for root cause explanations. Results open in a beautiful interactive dashboard with KPI cards, charts, and artifact viewers.',
    tags: ['Sarvam AI', 'OpenAI', 'Dashboard'],
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 relative" id="how-it-works">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[#60A5FA] text-xs font-semibold uppercase tracking-wider mb-4">
            How it works
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-[#F0F6FF] leading-tight mb-4">
            One command.<br />
            <span className="gradient-text">Fully autonomous testing.</span>
          </h2>
          <p className="text-[#8BA4C8] text-lg max-w-2xl mx-auto leading-relaxed">
            TestBot MCP orchestrates your entire testing pipeline from a single natural language prompt — no setup scripts, no YAML configs, no manual effort.
          </p>
        </motion.div>

        {/* Pipeline steps */}
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-[35px] top-12 bottom-12 w-px bg-gradient-to-b from-blue-500/50 via-blue-500/20 to-transparent hidden lg:block" style={{ left: 'calc(50% - 0.5px)', display: 'none' }} />

          <div className="flex flex-col gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                className="relative flex gap-6 glass-card rounded-2xl p-6 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 group"
              >
                {/* Step number + icon */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] group-hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all">
                    {step.icon}
                  </div>
                  <span className="text-[#4A6280] text-xs font-bold font-mono">{step.num}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[#F0F6FF] font-bold text-xl mb-2">{step.title}</h3>
                  <p className="text-[#8BA4C8] text-sm leading-relaxed mb-4">{step.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {step.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${step.tagColor}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Step gradient accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
