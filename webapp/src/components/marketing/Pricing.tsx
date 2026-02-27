'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const TIERS = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    tagline: 'Perfect for individual developers',
    features: [
      { text: 'Unlimited test runs', included: true },
      { text: 'Auto-detection', included: true },
      { text: 'OpenAI test generation', included: true },
      { text: 'Interactive dashboard', included: true },
      { text: '1 AI provider', included: true },
      { text: 'Jira integration', included: false },
      { text: 'Team analytics', included: false },
    ],
    cta: 'Get Started Free',
    ctaHref: '/home',
    ctaStyle: 'border border-white/20 text-[#F0F6FF] hover:bg-white/5',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    tagline: 'For teams who ship fast',
    features: [
      { text: 'Everything in Starter', included: true },
      { text: 'Jira integration', included: true },
      { text: 'All AI providers', included: true },
      { text: 'Team analytics', included: true },
      { text: 'Priority support', included: true },
      { text: 'CI/CD integration', included: true },
      { text: 'Custom AI prompts', included: true },
    ],
    cta: 'Start Pro Trial',
    ctaHref: '/home',
    ctaStyle: 'btn-gradient text-white',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: 'For large engineering teams',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'SSO / SAML', included: true },
      { text: 'Self-hosted option', included: true },
      { text: 'Custom AI model', included: true },
      { text: 'SLA guarantee', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'Audit logs', included: true },
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:hello@testbotmcp.com',
    ctaStyle: 'border border-white/20 text-[#F0F6FF] hover:bg-white/5',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <section className="py-24 relative" id="pricing">
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
            Pricing
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-[#F0F6FF] leading-tight mb-4">
            Simple, transparent pricing.
          </h2>
          <p className="text-[#8BA4C8] text-lg">Start free. Scale as your team grows.</p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative glass-card rounded-2xl p-8 flex flex-col transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] ${
                tier.popular
                  ? 'border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.15)]'
                  : 'hover:border-blue-500/30'
              }`}
            >
              {/* Popular badge */}
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                  Most Popular
                </div>
              )}

              {/* Gradient top border for popular */}
              {tier.popular && (
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-t-2xl" />
              )}

              <div className="mb-6">
                <div className="text-[#8BA4C8] text-sm font-semibold uppercase tracking-wider mb-3">{tier.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-[#F0F6FF]">{tier.price}</span>
                  {tier.period && <span className="text-[#8BA4C8] text-sm mb-1">{tier.period}</span>}
                </div>
                <p className="text-[#4A6280] text-sm">{tier.tagline}</p>
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {tier.features.map((feat) => (
                  <li key={feat.text} className={`flex items-center gap-2.5 text-sm ${feat.included ? 'text-[#8BA4C8]' : 'text-[#4A6280] line-through'}`}>
                    <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs ${feat.included ? 'bg-emerald-400/20 text-emerald-400' : 'bg-red-400/10 text-red-400/50'}`}>
                      {feat.included ? '✓' : '✗'}
                    </span>
                    {feat.text}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-all duration-200 ${tier.ctaStyle}`}
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
