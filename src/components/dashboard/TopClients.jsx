import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, getMonthName } from '@/lib/formatters';

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 72%, 29%)', 'hsl(262, 83%, 58%)', 'hsl(43, 74%, 55%)', 'hsl(0, 84%, 60%)'];

export default function TopClients({ timesheets }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [period, setPeriod] = useState('year');
  const [metric, setMetric] = useState('omzet');
  const years = [2024, 2025, 2026, 2027];
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const filtered = useMemo(() => {
    if (period === 'month') return timesheets.filter(t => t.month === currentMonth && t.year === currentYear);
    if (period === 'year') return timesheets.filter(t => t.year === parseInt(selectedYear));
    return timesheets; // all-time
  }, [period, selectedYear, timesheets, currentMonth, currentYear]);

  const clientData = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      if (!t.client_company) return;
      if (!map[t.client_company]) map[t.client_company] = { omzet: 0, marge: 0 };
      map[t.client_company].omzet += t.client_revenue || 0;
      map[t.client_company].marge += t.margin || 0;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b[metric] - a[metric])
      .slice(0, 7);
  }, [filtered, metric]);

  const maxVal = clientData[0] ? clientData[0][1][metric] : 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Top Klanten</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {period === 'year' && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Deze maand</SelectItem>
                <SelectItem value="year">Per jaar</SelectItem>
                <SelectItem value="all">All-time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="omzet">Omzet</SelectItem>
                <SelectItem value="marge">Marge</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {clientData.length > 0 ? (
          <div className="space-y-3">
            {clientData.map(([name, data], idx) => {
              const val = data[metric];
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}>
                        {name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[160px]">{name}</span>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(val)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Geen data beschikbaar voor deze periode</p>
        )}
      </CardContent>
    </Card>
  );
}