'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const TIERS = [
  {
    id: 'free',
    name: 'Trial',
    price: 'Free',
    priceNote: 'forever',
    description: 'Start free. No credit card required.',
    tokenLabel: '500 credits / month',
    features: ['1 user · 1 project', 'Basic AI models', 'Basic test types', 'Community support'],
    cta: 'Get Started Free',
    ctaHref: '/home',
    highlighted: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$15',
    priceNote: '/month',
    description: 'Advanced AI for growing teams.',
    tokenLabel: '2,500 credits / month',
    features: ['Advanced AI models', 'All test types · self healing', 'Jira / ADO integration', 'Priority support'],
    cta: 'Get Started',
    ctaHref: '/home',
    highlighted: false,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$30',
    priceNote: '/month',
    description: 'Scalable testing for engineering teams.',
    tokenLabel: '10,000 credits / month',
    features: [
      'Advanced models + priority queue',
      'Custom integrations (10 hrs onboarding)',
      'CI/CD pipeline integration',
      'Priority support (< 4hr SLA)',
    ],
    cta: 'Start Team Trial',
    ctaHref: '/home',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceNote: '',
    description: 'Custom AI, dedicated infrastructure, and SLA.',
    tokenLabel: 'Unlimited credits',
    features: [
      'Custom AI model selection',
      'API access + custom agents',
      'Dedicated CSM + 99.9% SLA',
      'SSO/SAML + compliance',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:Swathi.Dharshna@zapcg.com',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-24 bg-black relative" id="pricing">
      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="y2k-badge mb-4">Pricing</div>
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4 mt-4">
            Simple, transparent pricing.
          </h2>
          <p className="text-[#a0a0a0] text-base font-mono">Start free. Scale as your team grows.</p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`relative bg-[#111] p-6 flex flex-col border-2 transition-all duration-75 ${
                tier.highlighted
                  ? 'border-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.15)]'
                  : 'border-[#333] shadow-[4px_4px_0px_#333]'
              }`}
            >
              <div className="mb-5">
                <h3 className="text-white font-semibold text-base mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  {tier.priceNote && (
                    <span className="text-[#a0a0a0] text-sm">{tier.priceNote}</span>
                  )}
                </div>
                <p className="text-[#606060] text-xs mb-1.5">{tier.description}</p>
                <span className="inline-block text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                  {tier.tokenLabel}
                </span>
              </div>

              <ul className="flex flex-col gap-2.5 flex-1 mb-6">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-[#a0a0a0]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mt-0.5 shrink-0 text-blue-400">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`w-full py-3 text-xs font-black text-center uppercase tracking-widest font-mono transition-all ${
                  tier.highlighted
                    ? 'bg-blue-500 text-white border-2 border-blue-600 hover:bg-blue-400'
                    : 'bg-transparent text-white border-2 border-white hover:bg-white hover:text-black'
                }`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
