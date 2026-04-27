import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTHS = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };

function GrowthIndicator({ current, previous, isCount = false, label }) {
  const fmt = isCount ? v => v.toFixed(0) : v => formatCurrency(v);
  const growth = previous > 0 ? ((current - previous) / Math.abs(previous)) * 100 : (current > 0 ? 100 : 0);
  const isPositive = growth >= 0;
  const isSignificant = Math.abs(growth) >= 5;
  
  return (
    <div className={`rounded-lg border p-4 ${isPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{label}</div>
      
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1 space-y-1">
          <div className="text-sm text-muted-foreground">Dit kwartaal</div>
          <div className="text-lg font-bold text-foreground">{fmt(current)}</div>
          <div className="text-xs text-muted-foreground">vorig: {fmt(previous)}</div>
        </div>
        
        <div className={`text-right ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
          <div className="flex items-center justify-end gap-1 mb-1">
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-xl font-bold">{isPositive ? '+' : ''}{growth.toFixed(1)}%</span>
          </div>
          {isSignificant && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {isPositive ? '▲ Groei' : '▼ Daling'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BusinessGrowthTab({ timesheets, placements, year }) {
  const [selectedQuarter, setSelectedQuarter] = React.useState('Q2');
  
  const yr = parseInt(year);

  const getQuarterData = (q) => {
    const months = QUARTER_MONTHS[q];
    const qTs = timesheets.filter(ts => ts.year === yr && months.includes(ts.month));
    
    const brutomarge = qTs.reduce((s, ts) => s + (ts.margin || 0), 0);
    const brutoomzet = qTs.reduce((s, ts) => s + (ts.client_revenue || 0), 0);
    const permFee = placements.filter(p => {
      if (p.placement_type !== 'perm' || !p.start_date) return false;
      const d = new Date(p.start_date);
      return d.getFullYear() === yr && months.includes(d.getMonth() + 1);
    }).reduce((s, p) => s + (p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100))), 0);

    const activeConsultants = new Set(qTs.filter(ts => ts.days_worked > 0).map(ts => ts.consultant_name)).size;

    const newDeals = placements.filter(p => {
      if (!p.start_date) return false;
      const d = new Date(p.start_date);
      return d.getFullYear() === yr && months.includes(d.getMonth() + 1);
    }).length;

    return { brutomarge, brutoomzet, activeConsultants, permFee, newDeals };
  };

  const currentQ = getQuarterData(selectedQuarter);
  const previousQIndex = QUARTERS.indexOf(selectedQuarter) - 1;
  const previousQ = previousQIndex >= 0 ? getQuarterData(QUARTERS[previousQIndex]) : { brutomarge: 0, brutoomzet: 0, activeConsultants: 0, permFee: 0, newDeals: 0 };

  const prevLabel = previousQIndex >= 0 ? QUARTERS[previousQIndex] : 'Geen vorige kwartaal';

  const metricsData = [
    { label: 'Brutomarge', current: currentQ.brutomarge, previous: previousQ.brutomarge, isCount: false },
    { label: 'Brutoomzet', current: currentQ.brutoomzet, previous: previousQ.brutoomzet, isCount: false },
    { label: 'Actieve Consultants', current: currentQ.activeConsultants, previous: previousQ.activeConsultants, isCount: true },
    { label: 'PERM Fees', current: currentQ.permFee, previous: previousQ.permFee, isCount: false },
    { label: 'New Deals', current: currentQ.newDeals, previous: previousQ.newDeals, isCount: true },
  ];

  return (
    <div className="space-y-6">
      {/* Quarter selector */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Selecteer kwartaal</label>
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 pt-6">
          <span className="text-xs text-muted-foreground">
            Vergelijking: <span className="font-semibold text-foreground">{selectedQuarter} {year}</span> vs <span className="font-semibold text-foreground">{prevLabel} {year}</span>
          </span>
        </div>
      </div>

      {/* Growth metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {metricsData.map(m => (
          <GrowthIndicator
            key={m.label}
            label={m.label}
            current={m.current}
            previous={m.previous}
            isCount={m.isCount}
          />
        ))}
      </div>

      {/* Summary card */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardHeader>
          <CardTitle className="text-base">Groeiopsomming</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {metricsData.map(m => {
              const growth = m.previous > 0 ? ((m.current - m.previous) / Math.abs(m.previous)) * 100 : (m.current > 0 ? 100 : 0);
              const fmt = m.isCount ? v => v.toFixed(0) : v => formatCurrency(v);
              return (
                <div key={m.label}>
                  <div className="text-muted-foreground text-xs mb-1">{m.label}</div>
                  <div className={`font-bold flex items-center gap-1 ${growth >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {growth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">{fmt(m.previous)} → {fmt(m.current)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}