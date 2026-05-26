'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { RunComparisonData, TestItem } from '@/app/api/workspaces/[id]/run-comparison/route'

type Tab = 'new-files' | 'recovered' | 'regressed' | 'removed-files'

function formatMs(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function RunCard({ run, label }: { run: NonNullable<RunComparisonData['latest']>; label: string }) {
  const pct = run.passRate
  const pctColor = pct === null ? 'text-[#8BA4C8]' : pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
  const statusClass =
    run.status === 'passed' ? 'bg-emerald-500/10 text-emerald-400' :
    run.status === 'failed' ? 'bg-red-500/10 text-red-400' :
    run.status === 'completed_with_findings' ? 'bg-amber-500/10 text-amber-300' :
    'bg-white/5 text-[#8BA4C8]'

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col gap-3 flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[#4A6280] font-semibold">{label}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}>
          {run.status === 'completed_with_findings' ? 'findings' : run.status ?? '—'}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-black ${pctColor}`}>
          {pct !== null ? `${pct}%` : '—'}
        </span>
        <span className="text-[#4A6280] text-xs mb-1">pass rate</span>
      </div>
      <Link href={`/test-run/${run.id}`} className="text-[#F0F6FF] hover:text-[#60A5FA] text-sm font-medium truncate transition-colors">
        {run.creationName ?? 'Untitled run'}
      </Link>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="text-emerald-400 font-bold">{run.passedTests}</div>
          <div className="text-[#4A6280] text-[10px]">passed</div>
        </div>
        <div className="text-center">
          <div className="text-red-400 font-bold">{run.failedTests}</div>
          <div className="text-[#4A6280] text-[10px]">failed</div>
        </div>
        <div className="text-center">
          <div className="text-[#8BA4C8] font-bold">{run.totalTests}</div>
          <div className="text-[#4A6280] text-[10px]">total</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[#4A6280] pt-1 border-t border-white/5">
        <span>{formatDate(run.createdAt)}</span>
        {run.durationMs !== null && <span>{formatMs(run.durationMs)}</span>}
        {run.framework && <span className="font-mono">{run.framework}</span>}
      </div>
    </div>
  )
}

function FileGroup({
  filePath,
  tests,
  accent,
  dotColor,
}: {
  filePath: string
  tests: TestItem[]
  accent: string
  dotColor: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="font-mono text-[12px] text-[#F0F6FF] flex-1 truncate min-w-0">{filePath}</span>
        <span className={`text-[10px] font-bold ${accent} bg-white/5 px-2 py-0.5 rounded-full shrink-0`}>
          {tests.length} test{tests.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[#4A6280] text-[10px] shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-2 flex flex-col gap-0">
          {tests.map((t) => (
            <div key={t.caseKey} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[#4A6280] text-[10px] font-mono w-6 shrink-0">{t.tier ?? '—'}</span>
              <span className="text-[#8BA4C8] text-xs flex-1 truncate min-w-0">{t.testName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilePlainList({ files, accent }: { files: string[]; accent: string }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? files : files.slice(0, 15)
  if (files.length === 0) return <div className="text-[#4A6280] text-xs py-4 text-center">None</div>
  return (
    <div className="flex flex-col gap-1">
      {visible.map((f) => (
        <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 hover:bg-white/5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${accent}`} />
          <span className="font-mono text-[12px] text-[#F0F6FF] truncate">{f}</span>
        </div>
      ))}
      {files.length > 15 && (
        <button onClick={() => setExpanded((v) => !v)} className="text-[10px] text-[#60A5FA] hover:text-[#F0F6FF] pt-1 text-left">
          {expanded ? '▲ Show less' : `▼ Show ${files.length - 15} more`}
        </button>
      )}
    </div>
  )
}

function FileGroupList({
  groups,
  accent,
  dotColor,
  empty,
}: {
  groups: Map<string, TestItem[]>
  accent: string
  dotColor: string
  empty: string
}) {
  const [expanded, setExpanded] = useState(false)
  const entries = Array.from(groups.entries())
  const visible = expanded ? entries : entries.slice(0, 10)
  if (entries.length === 0) return <div className="text-[#4A6280] text-xs py-4 text-center">{empty}</div>
  return (
    <div className="flex flex-col gap-2">
      {visible.map(([file, tests]) => (
        <FileGroup key={file} filePath={file} tests={tests} accent={accent} dotColor={dotColor} />
      ))}
      {entries.length > 10 && (
        <button onClick={() => setExpanded((v) => !v)} className="text-[10px] text-[#60A5FA] hover:text-[#F0F6FF] pt-1 text-left">
          {expanded ? '▲ Show less' : `▼ Show ${entries.length - 10} more files`}
        </button>
      )}
    </div>
  )
}

const TABS: Array<{ id: Tab; label: string; accent: string; description: string }> = [
  { id: 'new-files', label: 'New files', accent: 'text-blue-400', description: 'Test files generated in this run that did not exist in the previous run.' },
  { id: 'recovered', label: 'Now passing', accent: 'text-emerald-400', description: 'Files where at least one test flipped from failing → passing.' },
  { id: 'regressed', label: 'Now failing', accent: 'text-red-400', description: 'Files where at least one test flipped from passing → failing.' },
  { id: 'removed-files', label: 'Removed files', accent: 'text-amber-400', description: 'Test files present in the previous run but absent in the latest.' },
]

export default function RunComparisonClient({
  comparison,
  workspaceId,
}: {
  comparison: RunComparisonData
  workspaceId: string
}) {
  const [activeTab, setActiveTab] = useState<Tab>('new-files')

  const { latest, previous, diff } = comparison

  // Group fixed/regression tests by file path
  const recoveredByFile = useMemo(() => {
    const m = new Map<string, TestItem[]>()
    for (const t of diff?.fixedTests ?? []) {
      const key = t.filePath ?? '(unknown file)'
      m.set(key, [...(m.get(key) ?? []), t])
    }
    return m
  }, [diff?.fixedTests])

  const regressedByFile = useMemo(() => {
    const m = new Map<string, TestItem[]>()
    for (const t of diff?.regressions ?? []) {
      const key = t.filePath ?? '(unknown file)'
      m.set(key, [...(m.get(key) ?? []), t])
    }
    return m
  }, [diff?.regressions])

  const tabCounts: Record<Tab, number> = {
    'new-files': diff?.newFiles.length ?? 0,
    'recovered': recoveredByFile.size,
    'regressed': regressedByFile.size,
    'removed-files': diff?.removedFiles.length ?? 0,
  }

  if (!latest) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <div className="text-[#F0F6FF] font-bold text-sm mb-2">No runs yet</div>
        <div className="text-[#8BA4C8] text-xs">
          Run Healix at least once on this workspace to see comparison data here.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Run header cards */}
      <div className="flex flex-col sm:flex-row gap-4">
        <RunCard run={latest} label="Latest run" />
        {previous ? (
          <RunCard run={previous} label="Previous run" />
        ) : (
          <div className="glass-card rounded-2xl p-4 flex-1 flex items-center justify-center text-[#4A6280] text-sm">
            No previous run to compare against.
          </div>
        )}
      </div>

      {diff && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Pass rate — explicit was→now */}
            <div className="glass-card rounded-2xl p-3 flex flex-col gap-1 lg:col-span-1">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-xl font-black ${
                  latest.passRate !== null && previous?.passRate !== null && previous?.passRate !== undefined
                    ? latest.passRate >= previous.passRate ? 'text-emerald-400' : 'text-red-400'
                    : 'text-[#F0F6FF]'
                }`}>
                  {latest.passRate ?? '—'}%
                </span>
                {previous && previous.passRate !== null && (
                  <span className="text-[#4A6280] text-[11px]">
                    {diff.passRateDelta !== null && diff.passRateDelta !== 0 && (
                      <span className={diff.passRateDelta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {diff.passRateDelta > 0 ? '▲' : '▼'}{Math.abs(diff.passRateDelta)}%
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#4A6280] font-semibold">Pass rate</div>
              {previous && previous.passRate !== null && (
                <div className="text-[10px] text-[#4A6280]">was {previous.passRate}%</div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-xl font-black text-emerald-400">{diff.fixedTests.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[#4A6280] font-semibold">Now passing</div>
              <div className="text-[10px] text-[#4A6280]">fail → pass</div>
            </div>

            <div className="glass-card rounded-2xl p-3 flex flex-col gap-1">
              <div className={`text-xl font-black ${diff.regressions.length > 0 ? 'text-red-400' : 'text-[#4A6280]'}`}>
                {diff.regressions.length}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#4A6280] font-semibold">Now failing</div>
              <div className="text-[10px] text-[#4A6280]">pass → fail </div>
            </div>

            <div className="glass-card rounded-2xl p-3 flex flex-col gap-1">
              <div className="text-xl font-black text-blue-400">{diff.newFiles.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-[#4A6280] font-semibold">New files</div>
              <div className="text-[10px] text-[#4A6280]">generated this run</div>
            </div>

            <div className="glass-card rounded-2xl p-3 flex flex-col gap-1">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-xl font-black text-[#F0F6FF]">{latest.totalTests}</span>
                {diff.totalTestsDelta !== 0 && (
                  <span className={`text-[11px] font-bold ${diff.totalTestsDelta > 0 ? 'text-blue-400' : 'text-amber-400'}`}>
                    {diff.totalTestsDelta > 0 ? '+' : ''}{diff.totalTestsDelta}
                  </span>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#4A6280] font-semibold">Total tests</div>
              {previous && <div className="text-[10px] text-[#4A6280]">was {previous.totalTests}</div>}
            </div>
          </div>

          {/* File-level comparison tabs */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex overflow-x-auto border-b border-white/10 bg-black/20">
              {TABS.map((tab) => {
                const count = tabCounts[tab.id]
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                      isActive
                        ? 'border-[#60A5FA] text-[#F0F6FF]'
                        : 'border-transparent text-[#4A6280] hover:text-[#8BA4C8]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 ${count > 0 ? tab.accent : 'text-[#4A6280]'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="p-4">
              {TABS.map((tab) => {
                if (tab.id !== activeTab) return null
                return (
                  <div key={tab.id}>
                    <p className="text-[#4A6280] text-[11px] mb-4">{tab.description}</p>
                    {tab.id === 'new-files' && (
                      <FilePlainList files={diff.newFiles} accent="bg-blue-400" />
                    )}
                    {tab.id === 'removed-files' && (
                      <FilePlainList files={diff.removedFiles} accent="bg-amber-400" />
                    )}
                    {tab.id === 'recovered' && (
                      <FileGroupList
                        groups={recoveredByFile}
                        accent="text-emerald-400"
                        dotColor="bg-emerald-400"
                        empty="No files recovered — no tests flipped from failing to passing."
                      />
                    )}
                    {tab.id === 'regressed' && (
                      <FileGroupList
                        groups={regressedByFile}
                        accent="text-red-400"
                        dotColor="bg-red-400"
                        empty="No regressions — no tests flipped from passing to failing."
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3 text-xs">
        <Link href={`/all-tests?workspace_id=${workspaceId}`} className="text-[#60A5FA] hover:text-[#F0F6FF] underline">
          View all test runs →
        </Link>
      </div>
    </div>
  )
}
