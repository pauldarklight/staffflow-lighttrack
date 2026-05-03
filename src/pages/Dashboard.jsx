import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import MissingTimesheets from '@/components/dashboard/MissingTimesheets';
import ExpiringContracts from '@/components/dashboard/ExpiringContracts';
import MissedInvoices from '@/components/dashboard/MissedInvoices';
import RevenueChart from '@/components/dashboard/RevenueChart';
import TopClients from '@/components/dashboard/TopClients';

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(262, 83%, 58%)', 'hsl(160, 60%, 45%)', 'hsl(43, 74%, 66%)', 'hsl(0, 84%, 60%)'];

export default function Dashboard() {
  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const activePlacements = placements.filter(p => p.status === 'active');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Find the most recent month that actually has timesheet data
  const latestTs = timesheets.length > 0
    ? timesheets.reduce((best, t) => {
        const tDate = t.year * 100 + t.month;
        const bDate = best.year * 100 + best.month;
        return tDate > bDate ? t : best;
      })
    : null;
  const displayMonth = latestTs ? latestTs.month : currentMonth;
  const displayYear = latestTs ? latestTs.year : currentYear;

  const monthlyTimesheets = timesheets.filter(t => t.month === displayMonth && t.year === displayYear);
  const totalRevenue = monthlyTimesheets.reduce((sum, t) => sum + (t.client_revenue || 0), 0);
  const totalMargin = monthlyTimesheets.reduce((sum, t) => sum + (t.margin || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'draft');

  // Monthly revenue chart data (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const monthTs = timesheets.filter(t => t.month === m && t.year === y);
    monthlyData.push({
      name: getMonthName(m).slice(0, 3),
      omzet: monthTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
      marge: monthTs.reduce((s, t) => s + (t.margin || 0), 0),
    });
  }

  // Top clients by revenue
  const clientRevenue = {};
  timesheets.forEach(t => {
    if (t.client_company) {
      clientRevenue[t.client_company] = (clientRevenue[t.client_company] || 0) + (t.client_revenue || 0);
    }
  });
  const topClients = Object.entries(clientRevenue)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${getMonthName(displayMonth)} ${displayYear} — Overzicht`}
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Actieve Placements" value={activePlacements.length} icon={Users} subtitle={`${placements.length} totaal`} />
        <StatCard title="Omzet deze maand" value={formatCurrency(totalRevenue)} icon={TrendingUp} />
        <StatCard title="Marge deze maand" value={formatCurrency(totalMargin)} icon={ArrowUpRight} />
        <StatCard title="Openstaande facturen" value={pendingInvoices.length} icon={Users} subtitle={formatCurrency(pendingInvoices.reduce((s, i) => s + (i.total_amount || i.amount || 0), 0))} />
      </div>

      {/* Alert row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MissingTimesheets placements={placements} timesheets={timesheets} />
        <MissedInvoices invoices={invoices} />
        <ExpiringContracts placements={placements} />
      </div>

      {/* Revenue chart */}
      <div className="mb-6">
        <RevenueChart timesheets={timesheets} placements={placements} />
      </div>

      {/* Top clients */}
      <TopClients timesheets={timesheets} />
    </div>
  );
}