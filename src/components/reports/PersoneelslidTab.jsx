import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/formatters';

const QUARTERS = { '1': [1,2,3], '2': [4,5,6], '3': [7,8,9], '4': [10,11,12] };

export default function PersoneelslidTab({ timesheets, year, years }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(year);
  const [viewMode, setViewMode] = useState('jaar'); // 'jaar' | 'halfjaars' | 'kwartaal' | 'maand'
  const [filterQuarter, setFilterQuarter] = useState(String(Math.ceil((now.getMonth() + 1) / 3)));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));

  // Bepaal welke maanden in scope zijn
  const scopeMonths = useMemo(() => {
    const yr = parseInt(selectedYear);
    const curMonth = now.getFullYear() === yr ? now.getMonth() + 1 : 12;
    if (viewMode === 'jaar') return Array.from({ length: 12 }, (_, i) => i + 1);
    if (viewMode === 'halfjaars') return Array.from({ length: curMonth }, (_, i) => i + 1);
    if (viewMode === 'kwartaal') return QUARTERS[filterQuarter] || [];
    if (viewMode === 'maand') return [parseInt(filterMonth)];
    return [];
  }, [viewMode, selectedYear, filterQuarter, filterMonth]);

  // Alle unieke consultants
  const consultants = useMemo(() => {
    return [...new Set(timesheets.map(t => t.consultant_name).filter(Boolean))].sort();
  }, [timesheets]);

  // Per consultant: aggregeer binnen scope
  const consultantRows = useMemo(() => {
    const yr = parseInt(selectedYear);
    return consultants.map(name => {
      const ts = timesheets.filter(t =>
        t.consultant_name === name &&
        t.year === yr &&
        scopeMonths.includes(t.month)
      );
      const omzet = ts.reduce((s, t) => s + (t.client_revenue || 0), 0);
      const kost = ts.reduce((s, t) => s + (t.consultant_revenue || 0), 0);
      const marge = ts.reduce((s, t) => s + (t.margin || 0), 0);
      const dagen = ts.reduce((s, t) => s + (t.days_worked || 0), 0);
      return { name, omzet, kost, marge, dagen, margePerc: omzet > 0 ? (marge / omzet) * 100 : 0 };
    }).filter(r => r.omzet > 0 || r.dagen > 0).sort((a, b) => b.marge - a.marge);
  }, [consultants, timesheets, selectedYear, scopeMonths]);

  // Grafiek: evolutie per maand voor alle consultants samen (of per maand in scope)
  const chartData = useMemo(() => {
    const yr = parseInt(selectedYear);
    return scopeMonths.map(m => {
      const mTs = timesheets.filter(t => t.year === yr && t.month === m);
      return {
        name: getMonthName(m).slice(0, 3),
        omzet: mTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
        marge: mTs.reduce((s, t) => s + (t.margin || 0), 0),
      };
    });
  }, [timesheets, selectedYear, scopeMonths]);

  const totaalOmzet = consultantRows.reduce((s, r) => s + r.omzet, 0);
  const totaalMarge = consultantRows.reduce((s, r) => s + r.marge, 0);
  const totaalDagen = consultantRows.reduce((s, r) => s + r.dagen, 0);
  const totaalMargePerc = totaalOmzet > 0 ? (totaalMarge / totaalOmzet) * 100 : 0;

  const periodLabel = viewMode === 'jaar' ? `Jaar ${selectedYear}`
    : viewMode === 'halfjaars' ? `YTD ${selectedYear}`
    : viewMode === 'kwartaal' ? `Q${filterQuarter} ${selectedYear}`
    : `${getMonthName(parseInt(filterMonth))} ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-border overflow-hidden">
          {[
            ['jaar', 'Jaar'],
            ['halfjaars', 'YTD'],
            ['kwartaal', 'Kwartaal'],
            ['maand', 'Maand'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {viewMode === 'kwartaal' && (
          <Select value={filterQuarter} onValueChange={setFilterQuarter}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['1','2','3','4'].map(q => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {viewMode === 'maand' && (
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totale Omzet', value: formatCurrency(totaalOmzet), color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Totale Marge', value: formatCurrency(totaalMarge), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Gem. Marge %', value: `${totaalMargePerc.toFixed(1)}%`, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
          { label: 'Totaal Dagen', value: `${totaalDagen}d`, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <div className="text-xs text-muted-foreground font-medium mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Grafiek evolutie */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolutie Omzet & Marge — {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Omzet" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2} name="Marge" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabel: één rij per personeelslid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Omzet & Marge per Personeelslid — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Personeelslid</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagen</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
              </tr>
            </thead>
            <tbody>
              {consultantRows.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Geen data voor deze periode</td></tr>
              ) : consultantRows.map(row => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{row.dagen}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(row.omzet)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.kost)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(row.marge)}</td>
                  <td className="py-3 px-4 text-right">{row.margePerc.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
            {consultantRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="py-3 px-4">Totaal</td>
                  <td className="py-3 px-4 text-right">{totaalDagen}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(totaalOmzet)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(consultantRows.reduce((s, r) => s + r.kost, 0))}</td>
                  <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(totaalMarge)}</td>
                  <td className="py-3 px-4 text-right">{totaalMargePerc.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}