import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTHS = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };

function Delta({ value, isCount = false }) {
  const fmt = isCount ? v => v.toFixed(0) : v => formatCurrency(Math.abs(v));
  if (value === 0) return <span className="flex items-center gap-0.5 text-muted-foreground"><Minus className="w-3 h-3" /> —</span>;
  if (value > 0) return <span className="flex items-center gap-0.5 text-emerald-600 font-semibold"><TrendingUp className="w-3 h-3" />+{fmt(value)}</span>;
  return <span className="flex items-center gap-0.5 text-red-600 font-semibold"><TrendingDown className="w-3 h-3" />-{fmt(Math.abs(value))}</span>;
}

function PctBadge({ pct }) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = pct >= 100 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 70 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${color}`}>
      {Math.round(pct)}%
    </span>
  );
}

export default function TargetVsActualTab({ timesheets, placements, year }) {
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

  // Chart data for brutomarge (main KPI)
  const margeChartData = rows.map(r => ({
    name: r.q,
    Target: r.brutomarge.target,
    Werkelijk: r.brutomarge.actual,
  }));

  const permChartData = rows.map(r => ({
    name: r.q,
    Target: r.perm.target,
    Werkelijk: r.perm.actual,
  }));

  const pct = (t, a) => t > 0 ? (a / t) * 100 : null;

  return (
    <div className="space-y-6">

      {/* Brutomarge chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Brutomarge — Target vs Werkelijk per Kwartaal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={margeChartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="Target" fill="hsl(221,83%,53%)" radius={[4,4,0,0]} opacity={0.5} />
              <Bar dataKey="Werkelijk" fill="hsl(142,72%,29%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* PERM chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">PERM Fees — Target vs Werkelijk per Kwartaal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={permChartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="Target" fill="hsl(43,74%,55%)" radius={[4,4,0,0]} opacity={0.5} />
              <Bar dataKey="Werkelijk" fill="hsl(30,90%,45%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Volledig Overzicht — {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">KPI</th>
                  {QUARTERS.map(q => (
                    <th key={q} className="text-center py-3 px-3 font-medium text-muted-foreground" colSpan={3}>{q}</th>
                  ))}
                </tr>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-4 text-xs text-muted-foreground"></th>
                  {QUARTERS.map(q => (
                    <React.Fragment key={q}>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">Target</th>
                      <th className="text-right py-2 px-2 text-xs text-muted-foreground">Werkelijk</th>
                      <th className="text-center py-2 px-2 text-xs text-muted-foreground">%</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Brutomarge */}
                <tr className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium">Brutomarge</td>
                  {rows.map(r => (
                    <React.Fragment key={r.q}>
                      <td className="py-3 px-2 text-right text-muted-foreground text-xs">{r.hasTgt ? formatCurrency(r.brutomarge.target) : '—'}</td>
                      <td className="py-3 px-2 text-right font-semibold text-emerald-700">{formatCurrency(r.brutomarge.actual)}</td>
                      <td className="py-3 px-2 text-center"><PctBadge pct={r.hasTgt && r.brutomarge.target > 0 ? pct(r.brutomarge.target, r.brutomarge.actual) : null} /></td>
                    </React.Fragment>
                  ))}
                </tr>
                {/* PERM */}
                <tr className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium">PERM Fees</td>
                  {rows.map(r => (
                    <React.Fragment key={r.q}>
                      <td className="py-3 px-2 text-right text-muted-foreground text-xs">{r.hasTgt ? formatCurrency(r.perm.target) : '—'}</td>
                      <td className="py-3 px-2 text-right font-semibold text-blue-700">{formatCurrency(r.perm.actual)}</td>
                      <td className="py-3 px-2 text-center"><PctBadge pct={r.hasTgt && r.perm.target > 0 ? pct(r.perm.target, r.perm.actual) : null} /></td>
                    </React.Fragment>
                  ))}
                </tr>
                {/* Consultants */}
                <tr className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium">Actieve Consultants</td>
                  {rows.map(r => (
                    <React.Fragment key={r.q}>
                      <td className="py-3 px-2 text-right text-muted-foreground text-xs">{r.hasTgt && r.consultants.target > 0 ? r.consultants.target : '—'}</td>
                      <td className="py-3 px-2 text-right font-semibold text-violet-700">{r.consultants.actual}</td>
                      <td className="py-3 px-2 text-center"><PctBadge pct={r.hasTgt && r.consultants.target > 0 ? pct(r.consultants.target, r.consultants.actual) : null} /></td>
                    </React.Fragment>
                  ))}
                </tr>
                {/* New Deals */}
                <tr className="hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium">New Deals</td>
                  {rows.map(r => (
                    <React.Fragment key={r.q}>
                      <td className="py-3 px-2 text-right text-muted-foreground text-xs">{r.hasTgt && r.new_deals.target > 0 ? r.new_deals.target : '—'}</td>
                      <td className="py-3 px-2 text-right font-semibold text-orange-700">{r.new_deals.actual}</td>
                      <td className="py-3 px-2 text-center"><PctBadge pct={r.hasTgt && r.new_deals.target > 0 ? pct(r.new_deals.target, r.new_deals.actual) : null} /></td>
                    </React.Fragment>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delta cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map(r => {
          const totalTarget = r.brutomarge.target + r.perm.target;
          const totalActual = r.brutomarge.actual + r.perm.actual;
          const delta = totalActual - totalTarget;
          const p = totalTarget > 0 ? (totalActual / totalTarget) * 100 : null;
          return (
            <div key={r.q} className={`rounded-xl border p-4 ${!r.hasTgt ? 'bg-muted/30' : p >= 100 ? 'bg-emerald-50 border-emerald-200' : p >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">{r.q} — Financieel totaal</div>
              {!r.hasTgt ? (
                <div className="text-xs text-muted-foreground italic">Geen targets</div>
              ) : (
                <>
                  <div className="text-lg font-bold text-foreground">{formatCurrency(totalActual)}</div>
                  <div className="text-xs text-muted-foreground">van {formatCurrency(totalTarget)}</div>
                  <div className="mt-2"><Delta value={delta} /></div>
                  {p !== null && <div className="mt-1"><PctBadge pct={p} /></div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}