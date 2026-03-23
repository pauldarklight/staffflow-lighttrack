import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { formatCurrency, getMonthName } from '@/lib/formatters';

// Returns the number of working days (Mon-Fri) in a given month/year
function getWorkingDays(year, month) {
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

export default function MonthlyOverview({ placements }) {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const years = [2024, 2025, 2026, 2027];

  const workingDaysInMonth = useMemo(() => getWorkingDays(parseInt(year), parseInt(month)), [month, year]);

  const rows = useMemo(() => {
    return placements
      .filter(p => (!p.placement_type || p.placement_type === 'freelancer') && p.status === 'active')
      .map(p => {
        const daysPerWeek = p.days_per_week || 5;
        const fraction = daysPerWeek / 5;
        const expectedDays = parseFloat((workingDaysInMonth * fraction).toFixed(1));
        const clientRevenue = expectedDays * (p.client_rate || 0);
        const consultantCost = expectedDays * (p.consultant_rate || 0);
        const margin = clientRevenue - consultantCost;
        return { p, daysPerWeek, expectedDays, clientRevenue, consultantCost, margin };
      })
      .sort((a, b) => b.clientRevenue - a.clientRevenue);
  }, [placements, month, year, workingDaysInMonth]);

  const permRows = useMemo(() => {
    return placements.filter(p => p.placement_type === 'perm');
  }, [placements]);

  const totalRevenue = rows.reduce((s, r) => s + r.clientRevenue, 0);
  const totalCost = rows.reduce((s, r) => s + r.consultantCost, 0);
  const totalMargin = rows.reduce((s, r) => s + r.margin, 0);

  return (
    <Card className="mb-8">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">Maandoverzicht verwachte omzet</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              {workingDaysInMonth} werkdagen in {getMonthName(parseInt(month))}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Gebaseerd op werkelijke werkdagen × (dagen/week ÷ 5). Exclusief vakantiedagen.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-bold text-foreground">Consultant</th>
                <th className="text-left py-3 px-4 font-normal text-foreground">Klant</th>
                <th className="text-center py-3 px-4 font-bold text-foreground">Dagen/week</th>
                <th className="text-center py-3 px-4 font-normal text-foreground">Verwachte dagen</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Tarief klant</th>
                <th className="text-right py-3 px-4 font-normal text-white bg-primary">Verwachte omzet</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Kost consultant</th>
                <th className="text-right py-3 px-4 font-normal text-foreground">Marge</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">Geen actieve freelancer placements</td></tr>
              )}
              {rows.map(({ p, daysPerWeek, expectedDays, clientRevenue, consultantCost, margin }) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-foreground">{p.consultant_first_name} {p.consultant_last_name}</div>
                    {p.consultant_company_name && <div className="text-xs text-muted-foreground">{p.consultant_company_name}</div>}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{p.client_company_name}</td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="outline" className={`text-xs ${daysPerWeek < 5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-muted text-muted-foreground'}`}>
                      {daysPerWeek}/5
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-foreground">{expectedDays}</td>
                  <td className="py-3 px-4 text-right text-xs font-bold text-foreground">{formatCurrency(p.client_rate || 0)}/dag</td>
                  <td className="py-3 px-4 text-right bg-primary/10 font-bold text-primary">{formatCurrency(clientRevenue)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(consultantCost)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${margin >= 0 ? 'text-primary' : 'text-red-500'}`}>{formatCurrency(margin)}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="bg-muted/40 border-t-2 font-semibold">
                  <td colSpan={5} className="py-3 px-4 text-right text-xs text-muted-foreground font-bold">Totaal</td>
                  <td className="py-3 px-4 text-right bg-primary/10 font-bold text-primary">{formatCurrency(totalRevenue)}</td>
                  <td className="py-3 px-4 text-right font-bold text-foreground">{formatCurrency(totalCost)}</td>
                  <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(totalMargin)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PERM section */}
        {permRows.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center gap-2 mb-3 px-4">
              <span className="text-sm font-semibold text-foreground">PERM — Vaste aanwervingen</span>
              <Badge className="bg-foreground/10 text-foreground border-foreground/20 text-xs">PERM</Badge>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-bold text-foreground">Kandidaat</th>
                  <th className="text-left py-3 px-4 font-normal text-foreground">Klant</th>
                  <th className="text-left py-3 px-4 font-bold text-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-normal text-foreground">Jaarloon</th>
                  <th className="text-right py-3 px-4 font-bold text-foreground">Fee %</th>
                  <th className="text-right py-3 px-4 font-normal text-white bg-primary">Eenmalige fee</th>
                </tr>
              </thead>
              <tbody>
                {permRows.map(p => {
                  const fee = p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100));
                  const statusLabel = { active: 'Actief', ended: 'Beëindigd', on_hold: 'On hold' }[p.status] || p.status;
                  const statusStyle = { active: 'bg-emerald-100 text-emerald-700 border-emerald-200', ended: 'bg-slate-100 text-slate-600 border-slate-200', on_hold: 'bg-amber-100 text-amber-700 border-amber-200' }[p.status] || '';
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground">{p.consultant_first_name} {p.consultant_last_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.client_company_name}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${statusStyle}`}>{statusLabel}</Badge></td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(p.perm_annual_salary || 0)}</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">{p.perm_fee_percentage || 20}%</td>
                      <td className="py-3 px-4 text-right bg-primary/10 font-bold text-primary">{formatCurrency(fee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}