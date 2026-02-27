import Navbar from '@/components/marketing/Navbar';
import Hero from '@/components/marketing/Hero';
import StatsBanner from '@/components/marketing/StatsBanner';
import HowItWorks from '@/components/marketing/HowItWorks';
import Features from '@/components/marketing/Features';
import Integrations from '@/components/marketing/Integrations';
import DashboardPreview from '@/components/marketing/DashboardPreview';
import Pricing from '@/components/marketing/Pricing';
import Footer from '@/components/marketing/Footer';

export const metadata = {
  title: 'TestBot MCP — AI-Powered Testing Agent',
  description: 'TestBot MCP is an AI-native testing agent that auto-generates, runs, and analyzes tests from a single natural language command in your IDE.',
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-black text-white" style={{ scrollBehavior: 'smooth' }}>
      <Navbar />
      <main>
        <Hero />
        <StatsBanner />
        <HowItWorks />
        <Features />
        <Integrations />
        <DashboardPreview />
        <Pricing />

        {/* Get Started CTA section */}
        <section className="py-24 relative pixel-grid" id="get-started">
          <div className="glow-orb w-96 h-96 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          <div className="relative max-w-4xl mx-auto px-6">
            <div className="brutal-card p-12 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-white" />

              <h2
                className="text-4xl lg:text-5xl font-black text-white mb-4 glitch"
                data-text="Ready to eliminate manual testing?"
              >
                Ready to eliminate manual testing?
              </h2>
              <p className="text-[#a0a0a0] text-lg mb-10 font-mono">
                Set up TestBot MCP in under 5 minutes. No credit card required.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                {[
                  { step: '01', label: 'Install via npm', code: 'npm install -g testbot-mcp' },
                  { step: '02', label: 'Add to IDE config', code: 'testbot-mcp init' },
                  { step: '03', label: 'Say the magic words', code: '"Test my app using testbot mcp"' },
                ].map(({ step, label, code }) => (
                  <div key={step} className="glass-card px-5 py-3 text-sm flex items-start gap-3 text-left">
                    <span className="font-mono font-bold text-white text-xs border border-white px-1.5 py-0.5 flex-shrink-0">{step}</span>
                    <div>
                      <div className="text-white font-bold text-xs uppercase tracking-wider mb-1">{label}</div>
                      <code className="text-[#a0a0a0] text-xs font-mono">{code}</code>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                <a
                  href="https://github.com/krishsharma1008/TestBot_MCP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient flex items-center gap-2 px-8 py-3.5"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  View on GitHub
                </a>
                <a
                  href="#"
                  className="flex items-center gap-2 text-white font-bold px-8 py-3.5 border-2 border-white hover:bg-white hover:text-black transition-all uppercase tracking-widest text-sm font-mono"
                >
                  Read the Docs
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
