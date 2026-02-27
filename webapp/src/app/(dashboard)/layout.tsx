import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userEmail = user.email ?? 'user@example.com';
  const fullName = profile?.full_name ?? userEmail;
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || userEmail[0].toUpperCase();
  const creditsRemaining = profile?.credits_remaining ?? 100;
  const creditsTotal = profile?.credits_total ?? 100;
  const plan = profile?.plan ?? 'starter';

  return (
    <div className="min-h-screen bg-[#050A18]">
      {/* Sidebar */}
      <Sidebar creditsRemaining={creditsRemaining} creditsTotal={creditsTotal} plan={plan} />

      {/* Main content area */}
      <div className="lg:ml-[260px] flex flex-col min-h-screen">
        {/* TopBar */}
        <TopBar userEmail={userEmail} userInitials={initials} />

        {/* Page content with dot-grid background */}
        <main className="flex-1 dot-grid relative">
          {/* Subtle gradient overlay on dot-grid */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050A18]/50 via-transparent to-[#050A18]/30 pointer-events-none" />
          <div className="relative p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
