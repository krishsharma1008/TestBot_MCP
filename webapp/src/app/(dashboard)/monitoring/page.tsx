'use client';

import { motion } from 'framer-motion';

export default function MonitoringPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto"
    >
      <h1 className="text-3xl font-bold text-[#F0F6FF] tracking-tight mb-8">
        Monitoring
      </h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="relative overflow-hidden backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-2xl p-8"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />

        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-400/10 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-blue-400">
              <path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[#F0F6FF] mb-3">
            Coming Soon
          </h2>
          <p className="text-[#8BA4C8] max-w-md mx-auto mb-8">
            Monitor your test runs in real-time. Track trends, view historical data,
            and get alerts when tests fail across your projects.
          </p>

          {/* Placeholder chart area */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {['Pass Rate Trend', 'Test Duration', 'Failure Hotspots'].map((label, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-xl p-4 h-32 flex flex-col items-center justify-center"
              >
                <div className="w-full h-12 mb-3 rounded-lg overflow-hidden bg-white/[0.02]">
                  <div className="h-full flex items-end gap-[2px] px-2 pb-1">
                    {Array.from({ length: 12 }, (_, j) => (
                      <div
                        key={j}
                        className="flex-1 bg-gradient-to-t from-blue-500/40 to-cyan-400/20 rounded-t-sm"
                        style={{ height: `${20 + Math.random() * 80}%` }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-[#4A6280]">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
