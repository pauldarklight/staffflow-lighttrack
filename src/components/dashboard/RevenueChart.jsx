import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/formatters';

const AVG_DAYS = 16; // Gemiddeld aantal factureerbare dagen per maand

function getWorkingDays(y, m) {
  let count = 0;
  const date = new Date(y, m - 1, 1);
  while (date.getMonth() === m - 1) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueChart({ timesheets, placements }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [mode, setMode] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const years = [2024, 2025, 2026, 2027];

  const activeFree = placements.filter(p => p.status === 'active' && (!p.placement_type || p.placement_type === 'freelancer'));

  const chartData = useMemo(() => {
    const yr = parseInt(selectedYear);
    const nowDate = new Date();

    if (mode === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const mTs = timesheets.filter(t => t.month === m && t.year === yr);
        const isFuture = new Date(yr, m - 1, 1) > nowDate;
        const forecast = activeFree.reduce((sum, p) => sum + AVG_DAYS * (p.client_rate || 0), 0);
        const forecastMargin = activeFree.reduce((sum, p) => sum + AVG_DAYS * ((p.client_rate || 0) - (p.consultant_rate || 0)), 0);
        const werkelijk = mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        const marge = mTs.reduce((s, t) => s + (t.margin || 0), 0);
        return {
          name: getMonthName(m).slice(0, 3),
          isFuture,
          omzetWerkelijk: isFuture ? 0 : werkelijk,
          margeWerkelijk: isFuture ? 0 : marge,
          omzetPrognose: isFuture ? forecast : 0,
          margePrognose: isFuture ? forecastMargin : 0,
        };
      });
    }

    if (mode === 'ytd') {
      const months = yr === nowDate.getFullYear() ? nowDate.getMonth() + 1 : 12;
      let cumVerwacht = 0, cumWerkelijk = 0, cumMarge = 0;
      return Array.from({ length: months }, (_, i) => {
        const m = i + 1;
        const mTs = timesheets.filter(t => t.month === m && t.year === yr);
        cumVerwacht += activeFree.reduce((sum, p) => sum + AVG_DAYS * (p.client_rate || 0), 0);
        cumWerkelijk += mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        cumMarge += mTs.reduce((s, t) => s + (t.margin || 0), 0);
        return { name: getMonthName(m).slice(0, 3), verwacht: cumVerwacht, werkelijk: cumWerkelijk, marge: cumMarge };
      });
    }

    if (mode === 'yearly') {
      return years.map(y => {
        const yTs = timesheets.filter(t => t.year === y);
        const omzet = yTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        const marge = yTs.reduce((s, t) => s + (t.margin || 0), 0);
        // 12 months × 16 avg days
        const verwacht = activeFree.reduce((sum, p) => sum + 12 * AVG_DAYS * (p.client_rate || 0), 0);
        return { name: String(y), verwacht, werkelijk: omzet, marge };
      });
    }

    if (mode === 'forecast') {
      const result = [];
      for (let i = 0; i < 18; i++) {
        const d = new Date(nowDate.getFullYear(), nowDate.getMonth() + i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const verwacht = activeFree.reduce((sum, p) => {
          const startOk = !p.start_date || new Date(p.start_date) <= new Date(y, m - 1, 28);
          const endOk = !p.end_date || new Date(p.end_date) >= new Date(y, m - 1, 1);
          if (!startOk || !endOk) return sum;
          return sum + AVG_DAYS * (p.client_rate || 0);
        }, 0);
        const mTs = timesheets.filter(t => t.month === m && t.year === y);
        const isFuture = d > nowDate;
        result.push({
          name: `${getMonthName(m).slice(0, 3)} '${String(y).slice(2)}`,
          verwacht: verwacht || null,
          werkelijk: isFuture ? null : (mTs.reduce((s, t) => s + (t.client_revenue || 0), 0) || null),
          marge: isFuture ? null : (mTs.reduce((s, t) => s + (t.margin || 0), 0) || null),
        });
      }
      return result;
    }

    return [];
  }, [mode, selectedYear, timesheets, placements]);

  const title = {
    monthly: `Maandelijks Overzicht ${selectedYear} — Werkelijk vs Prognose`,
    ytd: 'Cumulatief YTD',
    yearly: 'Per Jaar',
    forecast: 'Prognose komende 18 maanden',
  }[mode];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {mode !== 'forecast' && mode !== 'yearly' && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Per maand</SelectItem>
                <SelectItem value="ytd">YTD (cumulatief)</SelectItem>
                <SelectItem value="yearly">Per jaar</SelectItem>
                <SelectItem value="forecast">Prognose (18 maanden)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {mode === 'monthly' && (
              <>
                <Bar dataKey="omzetWerkelijk" name="Omzet (werkelijk)" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="margeWerkelijk" name="Marge (werkelijk)" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="omzetPrognose" name="Omzet (prognose)" fill="hsl(220, 13%, 82%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="margePrognose" name="Marge (prognose)" fill="hsl(220, 13%, 70%)" radius={[4, 4, 0, 0]} />
              </>
            )}

            {mode === 'ytd' && (
              <>
                <Bar dataKey="werkelijk" name="Omzet" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="marge" name="Marge" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="verwacht" name="Verwacht" stroke="hsl(43, 74%, 50%)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </>
            )}

            {mode === 'yearly' && (
              <>
                <Bar dataKey="werkelijk" name="Omzet" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="marge" name="Marge" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="verwacht" name="Verwacht" stroke="hsl(43, 74%, 50%)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </>
            )}

            {mode === 'forecast' && (
              <>
                <Bar dataKey="werkelijk" name="Werkelijk" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="marge" name="Marge" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="verwacht" name="Prognose" stroke="hsl(220, 13%, 65%)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Prognose berekend op basis van <strong>{AVG_DAYS} dagen/maand</strong> gemiddelde × dagtarief actieve freelancers
          {(mode === 'monthly' || mode === 'forecast') && ' · grijze balken / stippellijn = toekomstige maanden'}
        </p>
      </CardContent>
    </Card>
  );
}