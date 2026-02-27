'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

interface Stat {
  value: number | null;
  suffix: string;
  display?: string;
  desc: string;
  sub: string;
}

const STATS: Stat[] = [
  { value: 93, suffix: '%', desc: 'Average test pass rate', sub: 'Up from 42% without TestBot' },
  { value: 10, suffix: 'x', desc: 'Faster test generation', sub: 'Vs. writing tests manually' },
  { value: null, suffix: '', display: 'Zero', desc: 'Configuration needed', sub: 'Auto-detects everything' },
  { value: 500, suffix: '+', desc: 'Developers using TestBot', sub: 'And growing every day' },
];

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(frame);
      else setCount(target);
    };
    requestAnimationFrame(frame);
  }, [inView, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count}{suffix}
    </span>
  );
}

export default function StatsBanner() {
  return (
    <section className="relative py-16 border-y border-white/8">
      {/* Subtle gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-blue-800/5 to-blue-900/10" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
          {STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="flex flex-col items-center text-center px-6 py-4 lg:py-0"
            >
              <div className="text-4xl lg:text-5xl font-black gradient-text mb-2">
                {stat.display ? (
                  <span>{stat.display}</span>
                ) : stat.value !== null ? (
                  <CountUp target={stat.value} suffix={stat.suffix} />
                ) : null}
              </div>
              <div className="text-[#F0F6FF] font-semibold text-sm mb-1">{stat.desc}</div>
              <div className="text-[#4A6280] text-xs">{stat.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
