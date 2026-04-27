import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Search, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function ControlMechanismTab({ invoices, timesheets, placements, year }) {
  const [search, setSearch] = useState('');
  const yr = parseInt(year);

  const controlData = useMemo(() => {
    return invoices
      .filter(inv => inv.year === yr && inv.invoice_type === 'client_invoice')
      .map(inv => {
        const placement = placements.find(p => p.id === inv.placement_id);
        if (!placement) return null;

        // Get all approved timesheets for this placement in this month
        const monthTs = timesheets.filter(t =>
          t.placement_id === inv.placement_id &&
          t.year === yr &&
          t.month === inv.month &&
          t.status === 'approved'
        );

        const expectedDays = monthTs.reduce((s, t) => s + (t.days_worked || 0), 0);
        const expectedAmount = expectedDays * (placement.client_rate || 0);
        const factuurdAmount = inv.amount || 0;
        const verschil = factuurdAmount - expectedAmount;
        const verschilPerc = expectedAmount > 0 ? (verschil / expectedAmount) * 100 : 0;

        // Status: match, verschil of geen TS
        let status = 'match';
        let statusLabel = 'OK';
        let statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';

        if (monthTs.length === 0) {
          status = 'no_ts';
          statusLabel = 'Geen TS';
          statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
        } else if (Math.abs(verschilPerc) > 2) {
          status = 'mismatch';
          statusLabel = 'Afwijking';
          statusColor = 'bg-red-100 text-red-700 border-red-200';
        }

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number || '—',
          invoiceAmount: factuurdAmount,
          placement,
          consultant: `${placement.consultant_first_name} ${placement.consultant_last_name}`,
          client: placement.client_company_name,
          clientRate: placement.client_rate || 0,
          month: inv.month,
          expectedDays,
          expectedAmount,
          verschil,
          verschilPerc,
          status,
          statusLabel,
          statusColor,
          timesheetIds: monthTs.map(t => t.id),
        };
      })
      .filter(Boolean)
      .filter(row => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          row.consultant.toLowerCase().includes(q) ||
          row.client.toLowerCase().includes(q) ||
          row.invoiceNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Mismatches first
        if (a.status !== b.status) {
          return a.status === 'mismatch' ? -1 : 1;
        }
        return Math.abs(b.verschil) - Math.abs(a.verschil);
      });
  }, [invoices, timesheets, placements, yr, search]);

  const stats = useMemo(() => {
    const total = controlData.length;
    const matches = controlData.filter(r => r.status === 'match').length;
    const mismatches = controlData.filter(r => r.status === 'mismatch').length;
    const noTs = controlData.filter(r => r.status === 'no_ts').length;
    const totalVerschil = controlData.reduce((s, r) => s + Math.abs(r.verschil), 0);

    return { total, matches, mismatches, noTs, totalVerschil };
  }, [controlData]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Totaal facturen</div>
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
        </div>
        <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">OK</div>
          <div className="text-2xl font-bold text-emerald-600">{stats.matches}</div>
        </div>
        <div className="rounded-xl border bg-red-50 border-red-200 p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Afwijkingen</div>
          <div className="text-2xl font-bold text-red-600">{stats.mismatches}</div>
        </div>
        <div className="rounded-xl border bg-slate-100 border-slate-200 p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Geen TS</div>
          <div className="text-2xl font-bold text-slate-600">{stats.noTs}</div>
        </div>
        <div className="rounded-xl border bg-orange-50 border-orange-200 p-4">
          <div className="text-xs text-muted-foreground font-medium mb-1">Totaal afwijking</div>
          <div className="text-lg font-bold text-orange-600">{formatCurrency(stats.totalVerschil)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Zoek op consultant, klant of factuurnummer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Factuurnr</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Klant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagtarief</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Gew. Dagen</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Verwacht</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Factuur</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Verschil</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {controlData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      Geen facturen gevonden
                    </td>
                  </tr>
                ) : (
                  controlData.map(row => (
                    <tr
                      key={row.id}
                      className={`border-b border-border/50 ${
                        row.status === 'mismatch'
                          ? 'bg-red-50/30 hover:bg-red-50/50'
                          : row.status === 'no_ts'
                          ? 'bg-slate-50/30 hover:bg-slate-50/50'
                          : 'hover:bg-muted/20'
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-foreground">{row.invoiceNumber}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.consultant}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.client}</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatCurrency(row.clientRate)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{row.expectedDays}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.expectedAmount)}</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">{formatCurrency(row.invoiceAmount)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${row.verschil !== 0 ? (row.verschil > 0 ? 'text-blue-600' : 'text-red-600') : 'text-emerald-600'}`}>
                        <div>{(row.verschil >= 0 ? '+' : '') + formatCurrency(row.verschil)}</div>
                        <div className="text-xs text-muted-foreground font-normal">{row.verschilPerc >= 0 ? '+' : ''}{row.verschilPerc.toFixed(1)}%</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={`font-medium whitespace-nowrap ${row.statusColor}`}>
                          {row.status === 'mismatch' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {row.status === 'match' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {row.statusLabel}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-muted/30 border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Legenda</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span><strong>OK</strong> — Factuur stemt overeen met gewerkte dagen (≤2% afwijking)</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span><strong>Afwijking</strong> — Factuur wijkt meer dan 2% af van verwachte bedrag</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4" />
            <span><strong>Geen TS</strong> — Geen goedgekeurde timesheets voor deze factuur gevonden</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}