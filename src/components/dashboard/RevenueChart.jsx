import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/formatters';

export default function RevenueChart({ timesheets, placements }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [mode, setMode] = useState('ytd');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const years = [2024, 2025, 2026, 2027];

  // Working days helper
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

  const chartData = useMemo(() => {
    const yr = parseInt(selectedYear);
    const activeFree = placements.filter(p => p.status === 'active' && (!p.placement_type || p.placement_type === 'freelancer'));

    if (mode === 'ytd') {
      // YTD: all months up to current, cumulative
      const months = yr === currentYear ? currentMonth : 12;
      let cumOmzet = 0, cumMarge = 0;
      return Array.from({ length: months }, (_, i) => {
        const m = i + 1;
        const mTs = timesheets.filter(t => t.month === m && t.year === yr);
        cumOmzet += mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        cumMarge += mTs.reduce((s, t) => s + (t.margin || 0), 0);
        return { name: getMonthName(m).slice(0, 3), omzet: cumOmzet, marge: cumMarge };
      });
    }

    if (mode === 'monthly') {
      const months = yr === currentYear ? currentMonth : 12;
      return Array.from({ length: months }, (_, i) => {
        const m = i + 1;
        const mTs = timesheets.filter(t => t.month === m && t.year === yr);
        return {
          name: getMonthName(m).slice(0, 3),
          omzet: mTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
          marge: mTs.reduce((s, t) => s + (t.margin || 0), 0),
        };
      });
    }

    if (mode === 'yearly') {
      return years.map(y => {
        const yTs = timesheets.filter(t => t.year === y);
        return {
          name: String(y),
          omzet: yTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
          marge: yTs.reduce((s, t) => s + (t.margin || 0), 0),
        };
      });
    }

    if (mode === 'forecast') {
      // Next 12 months forecast based on active placements
      const result = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const workDays = getWorkingDays(y, m);
        const verwacht = activeFree.reduce((sum, p) => {
          const fraction = (p.days_per_week || 5) / 5;
          return sum + workDays * fraction * (p.client_rate || 0);
        }, 0);
        const werkelijk = timesheets.filter(t => t.month === m && t.year === y)
          .reduce((s, t) => s + (t.client_revenue || 0), 0);
        result.push({
          name: `${getMonthName(m).slice(0, 3)} '${String(y).slice(2)}`,
          verwacht,
          werkelijk: werkelijk || null,
        });
      }
      return result;
    }

    return [];
  }, [mode, selectedYear, timesheets, placements]);

  const isForecast = mode === 'forecast';
  const isYearly = mode === 'yearly';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">
            {mode === 'ytd' && 'Cumulatieve Omzet & Marge (YTD)'}
            {mode === 'monthly' && 'Omzet & Marge per Maand'}
            {mode === 'yearly' && 'Omzet & Marge per Jaar'}
            {mode === 'forecast' && 'Omzetprognose (komend jaar)'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!isForecast && !isYearly && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ytd">YTD (Cumulatief)</SelectItem>
                <SelectItem value="monthly">Per Maand</SelectItem>
                <SelectItem value="yearly">Per Jaar</SelectItem>
                <SelectItem value="forecast">Prognose komend jaar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          {isForecast ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="verwacht" stroke="hsl(221, 83%, 53%)" strokeWidth={2} strokeDasharray="5 5" name="Verwacht" />
              <Line type="monotone" dataKey="werkelijk" stroke="hsl(142, 72%, 29%)" strokeWidth={2} name="Werkelijk" connectNulls={false} />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} name="Omzet" />
              <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} name="Marge" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}