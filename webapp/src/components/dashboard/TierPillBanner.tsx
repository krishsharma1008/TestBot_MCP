'use client';

interface TierPillBannerProps {
  failures: any[];
  status?: string;
  lastHeartbeatAt?: string | null;
}

export default function TierPillBanner({ failures, status, lastHeartbeatAt }: TierPillBannerProps) {
  // Debug logging
  console.log('[TierPillBanner] Received data:', {
    failuresCount: failures.length,
    sampleFailures: failures.slice(0, 3).map(f => ({ id: f.id, tier: f.tier, verdict: f.verdict })),
    status,
  });

  // Group findings by tier and count
  const grouped = failures.reduce((acc: Record<string, number>, f: any) => {
    const tier = f.tier || 'tier-3';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  console.log('[TierPillBanner] Grouped by tier:', grouped);

  // Determine overall color based on verdicts
  const hasAppRegression = failures.some((f: any) => f.verdict === 'app_regression');
  const hasAmbiguous = failures.some((f: any) => f.verdict === 'ambiguous');
  const onlyFlakyOrTestRegression = failures.length > 0 && failures.every((f: any) => 
    f.verdict === 'flaky' || f.verdict === 'test_regression'
  );

  let bannerColor = 'bg-gray-100';
  if (hasAppRegression) {
    bannerColor = 'bg-red-50 border-red-200';
  } else if (hasAmbiguous) {
    bannerColor = 'bg-yellow-50 border-yellow-200';
  } else if (onlyFlakyOrTestRegression) {
    bannerColor = 'bg-green-50 border-green-200';
  }

  const tiers = ['tier-0', 'tier-1', 'tier-2', 'tier-3'];

  return (
    <div className={`p-4 border rounded-lg mb-4 ${bannerColor}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Findings by Tier</h3>
        {status && (
          <span className="text-xs text-gray-500">
            Status: <span className="font-medium">{status}</span>
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {tiers.map((tier) => {
          const count = grouped[tier] || 0;
          const isActive = count > 0;
          return (
            <div
              key={tier}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isActive
                  ? 'bg-white border border-gray-300 text-gray-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}: {count}
            </div>
          );
        })}
      </div>
      {lastHeartbeatAt && (
        <div className="mt-2 text-xs text-gray-500">
          Last heartbeat: {new Date(lastHeartbeatAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
