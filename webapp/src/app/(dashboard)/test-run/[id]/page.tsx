'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type { TestRun } from '@/lib/types/database';

// ─── Types for the report_json shape ────────────────────────────────────────

interface ReportTest {
  name?: string;
  title?: string;
  status?: string;
  outcome?: string;
  duration?: number;
  duration_ms?: number;
  suite?: string;
  file?: string;
  error?: string;
  error_message?: string;
  errorMessage?: string;
  message?: string;
}

interface ReportJson {
  tests?: ReportTest[];
  results?: ReportTest[];
  summary?: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
  };
  stats?: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    duration?: number;
  };
}

interface AiAnalysisItem {
  test?: string;
  test_name?: string;
  root_cause?: string;
  rootCause?: string;
  suggested_fix?: string;
  suggestedFix?: string;
  fix?: string;
  confidence?: number | string;
}

// ─── Count-up animation hook ─────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start: number | null = null;
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay]);

  return value;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  delay,
}: {
  label: string;
  value: number;
  sub?: string;
  color: string;
  delay: number;
}) {
  const displayed = useCountUp(value, 1000, delay);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000 }}
      className="glass-card rounded-2xl p-5 flex flex-col gap-1"
    >
      <span className="text-[#4A6280] text-xs font-semibold uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{displayed}{sub}</span>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? '').toLowerCase();
  if (s === 'passed' || s === 'pass') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">passed</span>;
  }
  if (s === 'failed' || s === 'fail') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400">failed</span>;
  }
  if (s === 'skipped' || s === 'skip' || s === 'pending') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400">skipped</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400">{s}</span>;
}

function StatusBar({ passed, failed, skipped, total }: { passed: number; failed: number; skipped: number; total: number }) {
  if (total === 0) return null;
  const pPct = (passed / total) * 100;
  const fPct = (failed / total) * 100;
  const sPct = (skipped / total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pPct}%` }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="h-full bg-emerald-500"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fPct}%` }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="h-full bg-red-500"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sPct}%` }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="h-full bg-amber-500"
        />
      </div>
      <div className="flex items-center gap-4 text-xs text-[#4A6280]">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{passed} passed</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{failed} failed</span>
        {skipped > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{skipped} skipped</span>}
      </div>
    </div>
  );
}

// ─── Helper to normalise test objects from various report shapes ──────────────

function normaliseTest(t: ReportTest, idx: number): {
  name: string;
  status: string;
  duration: number | null;
  suite: string;
  error: string | null;
} {
  return {
    name: t.name ?? t.title ?? `Test ${idx + 1}`,
    status: t.status ?? t.outcome ?? 'unknown',
    duration: t.duration ?? t.duration_ms ?? null,
    suite: t.suite ?? t.file ?? '—',
    error: t.error ?? t.error_message ?? t.errorMessage ?? t.message ?? null,
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestRunDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchRun() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('test_runs')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          setTestRun(data as TestRun);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchRun();
  }, [id]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col gap-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-8 w-24 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 h-24 animate-pulse bg-white/[0.02]" />
          ))}
        </div>
        <div className="glass-card rounded-2xl h-64 animate-pulse bg-white/[0.02]" />
      </div>
    );
  }

  // ── Not found state ──────────────────────────────────────────────────────
  if (notFound || !testRun) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#4A6280]">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <div className="text-center">
          <div className="text-[#F0F6FF] font-bold text-xl mb-2">Test run not found</div>
          <div className="text-[#4A6280] text-sm">This test run may have been deleted or doesn&apos;t exist.</div>
        </div>
        <Link href="/all-tests" className="btn-gradient text-white font-semibold px-6 py-2.5 rounded-xl text-sm">
          Back to All Tests
        </Link>
      </div>
    );
  }

  // ── Parse report_json ────────────────────────────────────────────────────
  const report: ReportJson | null = testRun.report_json ?? null;
  const rawTests: ReportTest[] = report?.tests ?? report?.results ?? [];
  const normalisedTests = rawTests.map(normaliseTest);

  const totalTests = testRun.total_tests || report?.summary?.total || report?.stats?.total || normalisedTests.length;
  const passedTests = testRun.passed_tests || report?.summary?.passed || report?.stats?.passed || normalisedTests.filter(t => ['passed', 'pass'].includes(t.status.toLowerCase())).length;
  const failedTests = testRun.failed_tests || report?.summary?.failed || report?.stats?.failed || normalisedTests.filter(t => ['failed', 'fail'].includes(t.status.toLowerCase())).length;
  const skippedTests = testRun.skipped_tests || report?.summary?.skipped || report?.stats?.skipped || normalisedTests.filter(t => ['skipped', 'skip', 'pending'].includes(t.status.toLowerCase())).length;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // ── AI analysis ──────────────────────────────────────────────────────────
  const aiAnalysis: AiAnalysisItem[] = Array.isArray(testRun.ai_analysis)
    ? testRun.ai_analysis
    : testRun.ai_analysis?.analyses ?? testRun.ai_analysis?.items ?? [];

  const formattedDate = new Date(testRun.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  }) + ' at ' + new Date(testRun.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto flex flex-col gap-6"
    >
      {/* Back + header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
        <Link
          href="/all-tests"
          className="inline-flex items-center gap-2 text-[#4A6280] hover:text-[#F0F6FF] text-sm transition-colors w-fit"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to All Tests
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-[#F0F6FF] font-bold text-2xl">{testRun.creation_name || 'Test Run'}</h1>
            <p className="text-[#4A6280] text-sm mt-0.5">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-3">
            {testRun.source && (
              <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#60A5FA] text-xs font-semibold uppercase tracking-wider">
                {testRun.source}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              testRun.status === 'passed'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : testRun.status === 'failed'
                ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                : testRun.status === 'running'
                ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            }`}>
              {testRun.status}
            </span>
          </div>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        <KpiCard label="Total Tests" value={totalTests} color="text-[#F0F6FF]" delay={0} />
        <KpiCard label="Passed" value={passedTests} color="text-emerald-400" delay={80} />
        <KpiCard label="Failed" value={failedTests} color="text-red-400" delay={160} />
        <KpiCard label="Skipped" value={skippedTests} color="text-amber-400" delay={240} />
        <KpiCard label="Pass Rate" value={passRate} sub="%" color={passRate >= 80 ? 'text-emerald-400' : 'text-red-400'} delay={320} />
      </div>

      {/* Status distribution bar */}
      {totalTests > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-5"
        >
          <h2 className="text-[#F0F6FF] font-semibold text-sm mb-4">Status Distribution</h2>
          <StatusBar passed={passedTests} failed={failedTests} skipped={skippedTests} total={totalTests} />
        </motion.div>
      )}

      {/* Test results table or no-report message */}
      {report === null ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#4A6280]">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-[#F0F6FF] font-semibold mb-1">Report data not available</div>
            <div className="text-[#4A6280] text-sm">No detailed report was saved for this test run.</div>
          </div>
        </motion.div>
      ) : normalisedTests.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/8">
            <h2 className="text-[#F0F6FF] font-semibold text-base">Test Results</h2>
            <p className="text-[#4A6280] text-xs mt-0.5">{normalisedTests.length} individual tests</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-[#4A6280] text-xs font-semibold uppercase tracking-wider">Test Name</th>
                  <th className="text-left px-4 py-3 text-[#4A6280] text-xs font-semibold uppercase tracking-wider">Suite / File</th>
                  <th className="text-left px-4 py-3 text-[#4A6280] text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[#4A6280] text-xs font-semibold uppercase tracking-wider">Duration</th>
                </tr>
              </thead>
              <tbody>
                {normalisedTests.map((t, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.02 }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-all"
                  >
                    <td className="px-6 py-3">
                      <div className="text-[#F0F6FF] text-sm font-medium">{t.name}</div>
                      {t.error && (
                        <div className="text-red-400/80 text-xs mt-0.5 font-mono truncate max-w-xs" title={t.error}>
                          {t.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#4A6280] text-xs font-mono truncate max-w-[160px] block">{t.suite}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#4A6280] text-xs font-mono">
                        {t.duration !== null ? `${(t.duration / 1000).toFixed(2)}s` : '—'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : null}

      {/* AI Analysis */}
      <AnimatePresence>
        {aiAnalysis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card rounded-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
                  <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" />
                  <path d="M12 8v4l3 3" />
                </svg>
              </div>
              <div>
                <h2 className="text-[#F0F6FF] font-semibold text-base">AI Analysis</h2>
                <p className="text-[#4A6280] text-xs">{aiAnalysis.length} issue{aiAnalysis.length !== 1 ? 's' : ''} analysed</p>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {aiAnalysis.map((item, i) => {
                const testName = item.test ?? item.test_name ?? `Issue ${i + 1}`;
                const rootCause = item.root_cause ?? item.rootCause ?? null;
                const fix = item.suggested_fix ?? item.suggestedFix ?? item.fix ?? null;
                const confidence = item.confidence ?? null;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.08 }}
                    className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[#F0F6FF] font-semibold text-sm">{testName}</div>
                      {confidence !== null && (
                        <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 whitespace-nowrap">
                          {typeof confidence === 'number' ? `${Math.round(confidence * 100)}% confidence` : confidence}
                        </span>
                      )}
                    </div>
                    {rootCause && (
                      <div>
                        <div className="text-[#4A6280] text-xs font-semibold uppercase tracking-wider mb-1">Root Cause</div>
                        <div className="text-[#8BA4C8] text-sm">{rootCause}</div>
                      </div>
                    )}
                    {fix && (
                      <div>
                        <div className="text-[#4A6280] text-xs font-semibold uppercase tracking-wider mb-1">Suggested Fix</div>
                        <div className="text-[#8BA4C8] text-sm">{fix}</div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duration footer */}
      {testRun.duration_ms && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[#4A6280] text-xs pb-4"
        >
          Total run duration: {(testRun.duration_ms / 1000).toFixed(2)}s
        </motion.div>
      )}
    </motion.div>
  );
}
