import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/formatters';

export default function PersoneelslidTab({ timesheets, year, years }) {
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedConsultant, setSelectedConsultant] = useState('');
  const [viewMode, setViewMode] = useState('maand'); // 'maand' | 'jaar'

  // Alle unieke consultants
  const consultants = useMemo(() => {
    const names = [...new Set(timesheets.map(t => t.consultant_name).filter(Boolean))].sort();
    return names;
  }, [timesheets]);

  // Stel eerste consultant in als nog niet geselecteerd
  const activeConsultant = selectedConsultant || consultants[0] || '';

  // Timesheets voor geselecteerde consultant
  const consultantTs = useMemo(() =>
    timesheets.filter(t => t.consultant_name === activeConsultant),
    [timesheets, activeConsultant]
  );

  // Maanddata voor geselecteerd jaar
  const maandData = useMemo(() => {
    const yr = parseInt(selectedYear);
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mTs = consultantTs.filter(t => t.year === yr && t.month === m);
      return {
        name: getMonthName(m).slice(0, 3),
        maand: m,
        omzet: mTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
        kost: mTs.reduce((s, t) => s + (t.consultant_revenue || 0), 0),
        marge: mTs.reduce((s, t) => s + (t.margin || 0), 0),
        dagen: mTs.reduce((s, t) => s + (t.days_worked || 0), 0),
      };
    });
  }, [consultantTs, selectedYear]);

  // Jaardata (alle jaren)
  const jaarData = useMemo(() => {
    const allYears = [...new Set(consultantTs.map(t => t.year).filter(Boolean))].sort();
    return allYears.map(yr => {
      const yTs = consultantTs.filter(t => t.year === yr);
      return {
        name: String(yr),
        omzet: yTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
        kost: yTs.reduce((s, t) => s + (t.consultant_revenue || 0), 0),
        marge: yTs.reduce((s, t) => s + (t.margin || 0), 0),
        dagen: yTs.reduce((s, t) => s + (t.days_worked || 0), 0),
      };
    });
  }, [consultantTs]);

  const chartData = viewMode === 'maand' ? maandData : jaarData;
  const tableData = viewMode === 'maand' ? maandData : jaarData;

  const totaalOmzet = tableData.reduce((s, r) => s + r.omzet, 0);
  const totaalMarge = tableData.reduce((s, r) => s + r.marge, 0);
  const totaalDagen = tableData.reduce((s, r) => s + r.dagen, 0);
  const margePerc = totaalOmzet > 0 ? (totaalMarge / totaalOmzet) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeConsultant} onValueChange={setSelectedConsultant}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Selecteer personeelslid" /></SelectTrigger>
          <SelectContent>
            {consultants.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-border overflow-hidden">
          {[['maand', 'Per maand'], ['jaar', 'Per jaar']].map(([mode, label]) => (
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

        {viewMode === 'maand' && (
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {!activeConsultant ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Geen personeelsleden gevonden.</CardContent></Card>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Totale Omzet', value: formatCurrency(totaalOmzet), color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
              { label: 'Totale Marge', value: formatCurrency(totaalMarge), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'Marge %', value: `${margePerc.toFixed(1)}%`, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
              { label: 'Totaal Dagen', value: `${totaalDagen}d`, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                <div className="text-xs text-muted-foreground font-medium mb-1">{k.label}</div>
                <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Grafiek */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolutie Omzet & Marge — {activeConsultant}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
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

          {/* Tabel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {viewMode === 'maand' ? `Maandoverzicht ${selectedYear}` : 'Jaaroverzicht'} — {activeConsultant}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{viewMode === 'maand' ? 'Maand' : 'Jaar'}</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagen</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => (
                    <tr key={idx} className={`border-b border-border/50 hover:bg-muted/30 ${row.omzet === 0 ? 'opacity-40' : ''}`}>
                      <td className="py-3 px-4 font-medium">{row.name}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{row.dagen || '—'}</td>
                      <td className="py-3 px-4 text-right">{row.omzet > 0 ? formatCurrency(row.omzet) : '—'}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{row.kost > 0 ? formatCurrency(row.kost) : '—'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{row.marge > 0 ? formatCurrency(row.marge) : '—'}</td>
                      <td className="py-3 px-4 text-right">{row.omzet > 0 ? `${((row.marge / row.omzet) * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="py-3 px-4">Totaal</td>
                    <td className="py-3 px-4 text-right">{totaalDagen}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(totaalOmzet)}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(tableData.reduce((s, r) => s + r.kost, 0))}</td>
                    <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(totaalMarge)}</td>
                    <td className="py-3 px-4 text-right">{margePerc.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}