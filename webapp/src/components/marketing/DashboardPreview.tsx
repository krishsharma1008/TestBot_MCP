'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

export default function DashboardPreview() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const wrapper = wrapperRef.current;
    const mockup = mockupRef.current;
    if (!wrapper || !mockup) return;
    const rect = wrapper.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    const rx = -dy * 6;
    const ry = dx * 6;
    mockup.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  };

  const handleMouseLeave = () => {
    if (mockupRef.current) {
      mockupRef.current.style.transform = 'perspective(1200px) rotateX(4deg) rotateY(0deg)';
    }
  };

  return (
    <section className="py-24 relative" id="dashboard">
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
            Dashboard
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-[#F0F6FF] leading-tight mb-4">
            Understand your test results<br />
            <span className="gradient-text">at a glance.</span>
          </h2>
          <p className="text-[#8BA4C8] text-lg max-w-xl mx-auto">
            Every test run opens a rich, interactive dashboard. No more digging through terminal logs.
          </p>
        </motion.div>

        {/* Dashboard mockup with 3D tilt */}
        <motion.div
          ref={wrapperRef}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative cursor-default"
          style={{ perspective: '1200px' }}
        >
          <div
            ref={mockupRef}
            className="glass-card rounded-2xl overflow-hidden shadow-[0_0_100px_rgba(59,130,246,0.2)]"
            style={{ transform: 'perspective(1200px) rotateX(4deg) rotateY(0deg)', transition: 'transform 0.1s ease' }}
          >
            {/* Browser title bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 mx-8">
                <div className="bg-white/5 border border-white/10 rounded-md px-3 py-1 text-[#4A6280] text-xs text-center">
                  localhost:3001/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-6 bg-[#050A18]/80">
              {/* Header row */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-[#F0F6FF] font-bold text-lg">TestBot MCP — Test Results</h3>
                  <span className="text-[#4A6280] text-xs">Run 5 mins ago</span>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="glass-card rounded-xl p-4">
                  <div className="text-3xl font-black text-emerald-400 mb-1">47</div>
                  <div className="text-[#8BA4C8] text-xs mb-2">Tests Passed</div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: '94%' }} />
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4">
                  <div className="text-3xl font-black text-red-400 mb-1">3</div>
                  <div className="text-[#8BA4C8] text-xs mb-2">Tests Failed</div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: '6%' }} />
                  </div>
                </div>
                <div className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <div>
                    <div className="text-3xl font-black gradient-text mb-1">94%</div>
                    <div className="text-[#8BA4C8] text-xs">Pass Rate</div>
                  </div>
                  <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3B82F6" strokeWidth="3" strokeDasharray="94, 100" />
                  </svg>
                </div>
                <div className="glass-card rounded-xl p-4">
                  <div className="text-3xl font-black text-[#60A5FA] mb-1">3.2s</div>
                  <div className="text-[#8BA4C8] text-xs">Avg Duration</div>
                </div>
              </div>

              {/* Test table */}
              <div className="glass-card rounded-xl overflow-hidden mb-4">
                {[
                  { pass: true, name: 'Homepage loads correctly', suite: 'UI Tests', time: '1.2s' },
                  { pass: true, name: 'User login flow', suite: 'Auth Tests', time: '2.8s' },
                  { pass: false, name: 'Checkout form validation', suite: 'E2E Tests', time: '4.1s' },
                  { pass: true, name: 'API /users endpoint returns 200', suite: 'API Tests', time: '0.4s' },
                  { pass: true, name: 'Product search filters', suite: 'UI Tests', time: '3.6s' },
                ].map((row, i) => (
                  <div key={i} className={`flex items-center gap-4 px-4 py-2.5 border-b border-white/5 last:border-0 text-sm ${row.pass ? '' : 'bg-red-500/5'}`}>
                    <span className={`font-bold ${row.pass ? 'text-emerald-400' : 'text-red-400'}`}>{row.pass ? '✓' : '✗'}</span>
                    <span className="text-[#F0F6FF] flex-1">{row.name}</span>
                    <span className="text-[#4A6280] text-xs">{row.suite}</span>
                    <span className="text-[#8BA4C8] text-xs font-mono">{row.time}</span>
                  </div>
                ))}
              </div>

              {/* AI Analysis */}
              <div className="glass-card rounded-xl p-4 border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#60A5FA] text-xs font-semibold">AI Analysis</span>
                  <span className="text-[#4A6280] text-xs">Sarvam AI</span>
                </div>
                <p className="text-[#8BA4C8] text-xs leading-relaxed">
                  Checkout form validation failed because <code className="text-[#60A5FA] bg-blue-500/10 px-1 py-0.5 rounded text-xs">data-testid=&quot;submit-btn&quot;</code> is not present in the DOM. Consider using <code className="text-[#60A5FA] bg-blue-500/10 px-1 py-0.5 rounded text-xs">getByRole(&apos;button&apos;, &#123; name: &apos;Place Order&apos; &#125;)</code> instead.
                </p>
              </div>
            </div>
          </div>

          {/* Glow effect below */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-blue-500/20 blur-2xl rounded-full" />
        </motion.div>
      </div>
    </section>
  );
}
