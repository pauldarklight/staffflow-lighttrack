import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart } from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/formatters';

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

    if (mode === 'monthly') {
      const months = yr === currentYear ? currentMonth : 12;
      return Array.from({ length: months }, (_, i) => {
        const m = i + 1;
        const mTs = timesheets.filter(t => t.month === m && t.year === yr);
        const workDays = getWorkingDays(yr, m);
        const verwacht = activeFree.reduce((sum, p) => {
          const fraction = (p.days_per_week || 5) / 5;
          return sum + workDays * fraction * (p.client_rate || 0);
        }, 0);
        const werkelijk = mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        const marge = mTs.reduce((s, t) => s + (t.margin || 0), 0);
        return { name: getMonthName(m).slice(0, 3), verwacht, werkelijk: werkelijk || null, marge: marge || null };
      });
    }

    if (mode === 'ytd') {
      const months = yr === currentYear ? currentMonth : 12;
      let cumVerwacht = 0, cumWerkelijk = 0, cumMarge = 0;
      return Array.from({ length: months }, (_, i) => {
        const m = i + 1;
        const mTs = timesheets.filter(t => t.month === m && t.year === yr);
        const workDays = getWorkingDays(yr, m);
        cumVerwacht += activeFree.reduce((sum, p) => {
          const fraction = (p.days_per_week || 5) / 5;
          return sum + workDays * fraction * (p.client_rate || 0);
        }, 0);
        cumWerkelijk += mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        cumMarge += mTs.reduce((s, t) => s + (t.margin || 0), 0);
        return { name: getMonthName(m).slice(0, 3), verwacht: cumVerwacht, werkelijk: cumWerkelijk || null, marge: cumMarge || null };
      });
    }

    if (mode === 'yearly') {
      return years.map(y => {
        const yTs = timesheets.filter(t => t.year === y);
        const omzet = yTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        const marge = yTs.reduce((s, t) => s + (t.margin || 0), 0);
        // Yearly forecast: sum all active placements for the full year
        let verwacht = 0;
        for (let m = 1; m <= 12; m++) {
          const workDays = getWorkingDays(y, m);
          verwacht += activeFree.reduce((sum, p) => {
            const fraction = (p.days_per_week || 5) / 5;
            return sum + workDays * fraction * (p.client_rate || 0);
          }, 0);
        }
        return { name: String(y), verwacht, werkelijk: omzet || null, marge: marge || null };
      });
    }

    if (mode === 'forecast') {
      const result = [];
      for (let i = 0; i < 18; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const workDays = getWorkingDays(y, m);
        const verwacht = activeFree.reduce((sum, p) => {
          // Only include if placement is still active in this month
          const startOk = !p.start_date || new Date(p.start_date) <= new Date(y, m - 1, 28);
          const endOk = !p.end_date || new Date(p.end_date) >= new Date(y, m - 1, 1);
          if (!startOk || !endOk) return sum;
          const fraction = (p.days_per_week || 5) / 5;
          return sum + workDays * fraction * (p.client_rate || 0);
        }, 0);
        const mTs = timesheets.filter(t => t.month === m && t.year === y);
        const werkelijk = mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        const isFuture = d > now;
        result.push({
          name: `${getMonthName(m).slice(0, 3)} '${String(y).slice(2)}`,
          verwacht: verwacht || null,
          werkelijk: isFuture ? null : (werkelijk || null),
          marge: isFuture ? null : (mTs.reduce((s, t) => s + (t.margin || 0), 0) || null),
        });
      }
      return result;
    }

    return [];
  }, [mode, selectedYear, timesheets, placements]);

  const title = {
    monthly: 'Verwacht vs Werkelijk per Maand',
    ytd: 'Cumulatief YTD',
    yearly: 'Per Jaar (historisch + prognose)',
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
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => v != null ? formatCurrency(v) : '—'} />
            <Legend />
            <Bar dataKey="werkelijk" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} name="Werkelijk" />
            <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} name="Marge" />
            <Line type="monotone" dataKey="verwacht" stroke="hsl(43, 74%, 50%)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Verwacht" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}