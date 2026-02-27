'use client';

import { motion } from 'framer-motion';

const INTEGRATIONS = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#1a1a2e" />
        <path d="M8 8l16 8-16 8V8z" fill="white" />
      </svg>
    ),
    name: 'Cursor',
    desc: 'AI-first IDE. Say "test my app" and TestBot takes over.',
    status: 'Supported',
    statusColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#0ea5e9" />
        <path d="M6 22c4-8 16-12 20-8-4 2-12 6-14 14C10 24 8 22 6 22z" fill="white" />
      </svg>
    ),
    name: 'Windsurf',
    desc: "Codeium's agentic IDE with full MCP support.",
    status: 'Supported',
    statusColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#D97706" />
        <text x="16" y="22" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="serif">A</text>
      </svg>
    ),
    name: 'Claude',
    desc: "Anthropic's Claude via MCP server protocol.",
    status: 'Supported',
    statusColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#2D8C3C" />
        <circle cx="16" cy="16" r="8" stroke="white" strokeWidth="2" fill="none" />
        <path d="M12 16l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    name: 'Playwright',
    desc: 'Industry-standard browser automation and testing.',
    status: 'Built-in',
    statusColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#10a37f" />
        <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">AI</text>
      </svg>
    ),
    name: 'OpenAI',
    desc: 'GPT-4 powers intelligent test generation and analysis.',
    status: 'Built-in',
    statusColor: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="#0052CC" />
        <path d="M16 6l10 10-10 10L6 16 16 6z" fill="white" opacity="0.3" />
        <path d="M16 10l6 6-6 6-6-6 6-6z" fill="white" />
      </svg>
    ),
    name: 'Jira',
    desc: 'Generate tests from user stories and acceptance criteria.',
    status: 'Optional',
    statusColor: 'text-[#8BA4C8] bg-white/5 border-white/10',
  },
];

export default function Integrations() {
  return (
    <section className="py-24 relative" id="integrations">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-[#60A5FA] text-xs font-semibold uppercase tracking-wider mb-4">
            Integrations
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-[#F0F6FF] leading-tight mb-4">
            Built for your AI-native stack.<br />
            <span className="gradient-text">Simple to connect.</span>
          </h2>
          <p className="text-[#8BA4C8] text-lg max-w-xl mx-auto">
            TestBot MCP plugs directly into the tools your team already uses — no migration, no disruption.
          </p>
        </motion.div>

        {/* Center logo + integration cards */}
        <div className="relative">
          {/* Center logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex justify-center mb-10"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
                <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                  <path d="M12 24l7 7 17-17" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-[#F0F6FF] font-bold text-sm">TestBot MCP</span>
            </div>
          </motion.div>

          {/* Integration cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRATIONS.map((integration, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="glass-card rounded-2xl p-5 flex items-center gap-4 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 group"
              >
                <div className="flex-shrink-0 rounded-xl overflow-hidden shadow-md">
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[#F0F6FF] font-semibold text-base">{integration.name}</h4>
                  <p className="text-[#8BA4C8] text-xs leading-relaxed mt-0.5">{integration.desc}</p>
                </div>
                <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${integration.statusColor}`}>
                  {integration.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
