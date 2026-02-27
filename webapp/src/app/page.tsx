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
    <div className="min-h-screen bg-[#050A18] text-[#F0F6FF]" style={{ scrollBehavior: 'smooth' }}>
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
        <section className="py-24 relative" id="get-started">
          <div className="absolute inset-0 overflow-hidden">
            <div className="glow-orb w-96 h-96 bg-blue-600 opacity-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="relative max-w-4xl mx-auto px-6">
            <div className="glass-card rounded-3xl p-12 text-center relative overflow-hidden">
              {/* Top gradient border */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

              <h2 className="text-4xl lg:text-5xl font-black text-[#F0F6FF] mb-4">
                Ready to eliminate manual testing?
              </h2>
              <p className="text-[#8BA4C8] text-lg mb-10">
                Set up TestBot MCP in under 5 minutes. No credit card required.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
                <div className="flex items-center gap-3 glass-card rounded-xl px-5 py-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">1</span>
                  <div className="text-left">
                    <div className="text-[#F0F6FF] font-semibold text-xs">Install via npm</div>
                    <code className="text-[#60A5FA] text-xs font-mono">npm install -g testbot-mcp</code>
                  </div>
                </div>
                <div className="flex items-center gap-3 glass-card rounded-xl px-5 py-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">2</span>
                  <div className="text-left">
                    <div className="text-[#F0F6FF] font-semibold text-xs">Add to IDE config</div>
                    <code className="text-[#60A5FA] text-xs font-mono">testbot-mcp init</code>
                  </div>
                </div>
                <div className="flex items-center gap-3 glass-card rounded-xl px-5 py-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">3</span>
                  <div className="text-left">
                    <div className="text-[#F0F6FF] font-semibold text-xs">Say the magic words</div>
                    <code className="text-[#60A5FA] text-xs font-mono">&quot;Test my app using testbot mcp&quot;</code>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                <a
                  href="https://github.com/krishsharma1008/TestBot_MCP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient flex items-center gap-2 text-white font-semibold px-8 py-3.5 rounded-xl"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  View on GitHub
                </a>
                <a
                  href="#"
                  className="flex items-center gap-2 text-[#8BA4C8] hover:text-[#F0F6FF] font-semibold px-8 py-3.5 rounded-xl border border-white/10 hover:border-blue-500/40 transition-all"
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
