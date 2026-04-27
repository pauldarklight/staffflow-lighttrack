import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTHS = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };

function MetricCard({ label, target, actual, isCount = false, showValue = true }) {
  const fmt = isCount ? v => v.toFixed(0) : v => formatCurrency(v);
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const achieved = pct >= 100;
  const isWarning = pct >= 70 && pct < 100;
  
  return (
    <div className={`rounded-lg border p-4 ${achieved ? 'bg-emerald-50 border-emerald-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
      <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{label}</div>
      
      {/* Target vs Actual bar */}
      <div className="mb-3 space-y-1">
        <div className="text-sm font-bold">{fmt(actual)}</div>
        <div className="text-xs text-muted-foreground">van {fmt(target)}</div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-1">
          <div 
            className={`h-full transition-all ${achieved ? 'bg-emerald-600' : isWarning ? 'bg-amber-600' : 'bg-red-600'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
      
      {/* Percentage and status */}
      <div className="flex items-center justify-between">
        <div className={`text-lg font-bold ${achieved ? 'text-emerald-700' : isWarning ? 'text-amber-700' : 'text-red-700'}`}>
          {Math.round(pct)}%
        </div>
        {achieved ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> Gehaald
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
            <AlertCircle className="w-4 h-4" /> {Math.round(100 - pct)}% te gaan
          </span>
        )}
      </div>
    </div>
  );
}

export default function TargetVsActualTab({ timesheets, placements, year }) {
  const [filterQuarter, setFilterQuarter] = useState('all');
  
  const { data: targets = [] } = useQuery({
    queryKey: ['targets'],
    queryFn: () => base44.entities.Target.list(),
  });

  const yr = parseInt(year);

  const rows = useMemo(() => {
    return QUARTERS.map(q => {
      const months = QUARTER_MONTHS[q];
      const t = targets.find(x => x.year === yr && x.quarter === q) || {};

      const qTs = timesheets.filter(ts => ts.year === yr && months.includes(ts.month));
      const brutomarge = qTs.reduce((s, ts) => s + (ts.margin || 0), 0);

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

      const hasTgt = !!(t.target_brutomarge || t.target_perm || t.target_consultants || t.target_new_deals);

      return {
        q,
        hasTgt,
        brutomarge: { target: t.target_brutomarge || 0, actual: brutomarge },
        perm: { target: t.target_perm || 0, actual: permFee },
        consultants: { target: t.target_consultants || 0, actual: activeConsultants },
        new_deals: { target: t.target_new_deals || 0, actual: newDeals },
      };
    });
  }, [targets, timesheets, placements, yr]);

  const displayRows = filterQuarter === 'all' ? rows : rows.filter(r => r.q === filterQuarter);

  return (
    <div className="space-y-6">
      {/* Quarter filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex rounded-md border border-border overflow-hidden">
          {['all', 'Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <button
              key={q}
              onClick={() => setFilterQuarter(q)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filterQuarter === q
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {q === 'all' ? 'Alle kwartalen' : q}
            </button>
          ))}
        </div>
      </div>

      {/* Per kwartaal: 3 kaarten (Brutomarge, Actieve Consultants, PERM) */}
      {displayRows.map(r => (
        <Card key={r.q}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{r.q} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {!r.hasTgt ? (
              <p className="text-sm text-muted-foreground italic">Geen targets ingesteld voor {r.q}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard 
                  label="Brutomarge" 
                  target={r.brutomarge.target} 
                  actual={r.brutomarge.actual}
                />
                <MetricCard 
                  label="Actieve Consultants" 
                  target={r.consultants.target} 
                  actual={r.consultants.actual}
                  isCount={true}
                />
                <MetricCard 
                  label="PERM Fees" 
                  target={r.perm.target} 
                  actual={r.perm.actual}
                />
                <MetricCard 
                  label="New Deals" 
                  target={r.new_deals.target} 
                  actual={r.new_deals.actual}
                  isCount={true}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}