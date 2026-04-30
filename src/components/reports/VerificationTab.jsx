import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, Link2Off, Building2, UserCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import OkiOkiImport from '@/components/reports/OkiOkiImport';

// ── Shared helpers ──────────────────────────────────────────────────────────

function StatusBadgeCell({ isMatching, isWarning, isCritical, percentageDiff }) {
  if (isMatching) return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 flex items-center justify-center gap-1 w-fit mx-auto">
      <CheckCircle2 className="w-3 h-3" /> OK
    </Badge>
  );
  if (isWarning) return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-300 flex items-center justify-center gap-1 w-fit mx-auto">
      <AlertCircle className="w-3 h-3" /> {percentageDiff.toFixed(1)}%
    </Badge>
  );
  return (
    <Badge className="bg-red-100 text-red-700 border-red-300 flex items-center justify-center gap-1 w-fit mx-auto">
      <AlertCircle className="w-3 h-3" /> {percentageDiff.toFixed(1)}%
    </Badge>
  );
}

function SummaryCards({ data, label }) {
  const matchingCount = data.filter(d => d.isMatching).length;
  const warningCount  = data.filter(d => d.isWarning).length;
  const criticalCount = data.filter(d => d.isCritical).length;
  const totalExpected = data.reduce((s, d) => s + d.expectedAmount, 0);
  const totalInvoiced = data.reduce((s, d) => s + d.invoiceAmount, 0);
  const totalDiff     = totalInvoiced - totalExpected;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-emerald-700">{matchingCount}</div>
          <div className="text-xs text-muted-foreground">OK — Bedragen kloppen</div>
        </CardContent>
      </Card>
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-amber-700">{warningCount}</div>
          <div className="text-xs text-muted-foreground">⚠ Klein verschil (&lt;10%)</div>
        </CardContent>
      </Card>
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-red-700">{criticalCount}</div>
          <div className="text-xs text-muted-foreground">✗ Groot verschil (≥10%)</div>
        </CardContent>
      </Card>
      <Card className="bg-muted/50 border-border">
        <CardContent className="p-4">
          <div className={`text-lg font-bold ${totalDiff === 0 ? 'text-emerald-700' : totalDiff > 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
          </div>
          <div className="text-xs text-muted-foreground">Totaal verschil</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Client verification table ───────────────────────────────────────────────

function ClientVerificationTable({ data, okiOkiData, manualOkiOki, onManualOkiOkiChange }) {
  const totalExpected = data.reduce((s, d) => s + d.expectedAmount, 0);
  const totalInvoiced = data.reduce((s, d) => s + d.invoiceAmount, 0);
  const totalDiff     = totalInvoiced - totalExpected;

  if (data.length === 0) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        Geen klantfacturen voor deze maand
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-base">Klantfactuurcontrole</CardTitle>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Info className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-sm">
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Klantfactuurcontrole</p>
                <div className="bg-blue-950 p-2 rounded">
                  <p className="font-medium text-blue-100">📋 Verwacht:</p>
                  <p className="text-blue-100/80 text-xs mt-1">Goedgekeurde dagen × Dagtarief klant</p>
                </div>
                <div className="bg-green-950 p-2 rounded">
                  <p className="font-medium text-green-100">💳 Gefactureerd:</p>
                  <p className="text-green-100/80 text-xs mt-1">Bedrag op de klantfactuur (Invoice)</p>
                </div>
                <div className="bg-slate-700 p-2 rounded">
                  <p className="font-medium text-slate-100">🔍 Verschil:</p>
                  <p className="text-slate-200 text-xs mt-1">Gefactureerd − Verwacht</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-blue-50/50">
                <th className="text-left py-3 px-4 font-bold text-foreground">Factuurnr</th>
                <th className="text-left py-3 px-4 font-bold text-foreground">Consultant</th>
                <th className="text-left py-3 px-4 font-normal text-muted-foreground">Klant</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Goedg. Dagen</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Tarief Klant</th>
                <th className="text-right py-3 px-4 font-bold text-primary">Verwacht</th>
                <th className="text-right py-3 px-4 font-bold text-blue-600">Gefactureerd</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Verschil</th>
                <th className="text-right py-3 px-4 font-bold text-purple-700">Oki Oki</th>
                <th className="text-right py-3 px-4 font-bold text-purple-700">Δ Oki Oki</th>
                <th className="text-center py-3 px-4 font-bold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.invoiceId}
                  className={`border-b border-border/50 ${row.isMatching ? 'hover:bg-emerald-50/20' : row.isWarning ? 'hover:bg-amber-50/20 bg-amber-50/10' : 'hover:bg-red-50/20 bg-red-50/10'}`}
                >
                  <td className="py-3 px-4 font-bold text-foreground">{row.invoiceNumber}</td>
                  <td className="py-3 px-4 font-medium">{row.consultant}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.client}</td>
                  <td className="py-3 px-4 text-right font-semibold">{row.approvedDays.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.dailyRate)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">{formatCurrency(row.expectedAmount)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-600">{formatCurrency(row.invoiceAmount)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${row.isMatching ? 'text-emerald-700' : row.difference > 0 ? 'text-orange-700' : 'text-red-700'}`}>
                    {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.okiOkiAmount !== null ? (
                      <span className="font-semibold text-purple-700">{formatCurrency(row.okiOkiAmount)}</span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={manualOkiOki[row.invoiceId] ?? ''}
                        onChange={e => onManualOkiOkiChange(row.invoiceId, e.target.value)}
                        className="w-28 text-right text-sm border border-purple-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50 text-purple-700 placeholder:text-purple-200"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-bold">
                    {(() => {
                      const oki = row.okiOkiAmount ?? (manualOkiOki[row.invoiceId] !== undefined && manualOkiOki[row.invoiceId] !== '' ? parseFloat(manualOkiOki[row.invoiceId]) : null);
                      if (oki === null) return <span className="text-muted-foreground">—</span>;
                      const diff = oki - row.invoiceAmount;
                      const match = Math.abs(diff) < 0.01;
                      return match
                        ? <span className="flex items-center justify-end gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> OK</span>
                        : <span className={diff >= 0 ? 'text-orange-700' : 'text-red-700'}>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</span>;
                    })()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadgeCell {...row} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t-2 font-semibold">
                <td colSpan={3} className="py-3 px-4 text-right text-xs text-muted-foreground font-bold">Totaal</td>
                <td className="py-3 px-4 text-right font-bold">{data.reduce((s, r) => s + r.approvedDays, 0).toFixed(1)}</td>
                <td />
                <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(totalExpected)}</td>
                <td className="py-3 px-4 text-right font-bold text-blue-600">{formatCurrency(totalInvoiced)}</td>
                <td className={`py-3 px-4 text-right font-bold ${totalDiff === 0 ? 'text-emerald-700' : totalDiff > 0 ? 'text-orange-700' : 'text-red-700'}`}>
                  {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                </td>
                <td className="py-3 px-4 text-right font-bold text-purple-700">
                  {formatCurrency(data.reduce((s, r) => {
                    const oki = r.okiOkiAmount ?? (manualOkiOki[r.invoiceId] !== undefined && manualOkiOki[r.invoiceId] !== '' ? parseFloat(manualOkiOki[r.invoiceId]) : 0);
                    return s + (oki || 0);
                  }, 0))}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Consultant verification table ───────────────────────────────────────────

function ConsultantVerificationTable({ data }) {
  const totalExpected = data.reduce((s, d) => s + d.expectedAmount, 0);
  const totalInvoiced = data.reduce((s, d) => s + d.invoiceAmount, 0);
  const totalDiff     = totalInvoiced - totalExpected;

  if (data.length === 0) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        Geen consultantfacturen voor deze maand
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-emerald-600" />
          <CardTitle className="text-base">Consultantfactuurcontrole</CardTitle>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Info className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-sm">
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Consultantfactuurcontrole</p>
                <div className="bg-emerald-950 p-2 rounded">
                  <p className="font-medium text-emerald-100">📋 Verwacht te betalen:</p>
                  <p className="text-emerald-100/80 text-xs mt-1">Goedgekeurde dagen × Dagtarief consultant</p>
                </div>
                <div className="bg-green-950 p-2 rounded">
                  <p className="font-medium text-green-100">🧾 Ontvangen factuur:</p>
                  <p className="text-green-100/80 text-xs mt-1">Bedrag op de ontvangen consultantfactuur</p>
                </div>
                <div className="bg-slate-700 p-2 rounded">
                  <p className="font-medium text-slate-100">🔍 Verschil:</p>
                  <p className="text-slate-200 text-xs mt-1">Ontvangen − Verwacht te betalen</p>
                  <p className="text-slate-300 text-xs mt-1">Positief (+) = consultant factureert meer dan verwacht</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-emerald-50/50">
                <th className="text-left py-3 px-4 font-bold text-foreground">Factuurnr</th>
                <th className="text-left py-3 px-4 font-bold text-foreground">Consultant</th>
                <th className="text-left py-3 px-4 font-normal text-muted-foreground">Klant</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Goedg. Dagen</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Tarief Consultant</th>
                <th className="text-right py-3 px-4 font-bold text-emerald-700">Verwacht te betalen</th>
                <th className="text-right py-3 px-4 font-bold text-orange-600">Ontvangen factuur</th>
                <th className="text-right py-3 px-4 font-bold text-foreground">Verschil</th>
                <th className="text-center py-3 px-4 font-bold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.invoiceId}
                  className={`border-b border-border/50 ${row.isMatching ? 'hover:bg-emerald-50/20' : row.isWarning ? 'hover:bg-amber-50/20 bg-amber-50/10' : 'hover:bg-red-50/20 bg-red-50/10'}`}
                >
                  <td className="py-3 px-4 font-bold text-foreground">{row.invoiceNumber}</td>
                  <td className="py-3 px-4 font-medium">{row.consultant}</td>
                  <td className="py-3 px-4 text-muted-foreground">{row.client}</td>
                  <td className="py-3 px-4 text-right font-semibold">{row.approvedDays.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.dailyRate)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatCurrency(row.expectedAmount)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-orange-600">{formatCurrency(row.invoiceAmount)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${row.isMatching ? 'text-emerald-700' : row.difference > 0 ? 'text-red-700' : 'text-orange-700'}`}>
                    {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadgeCell {...row} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t-2 font-semibold">
                <td colSpan={3} className="py-3 px-4 text-right text-xs text-muted-foreground font-bold">Totaal</td>
                <td className="py-3 px-4 text-right font-bold">{data.reduce((s, r) => s + r.approvedDays, 0).toFixed(1)}</td>
                <td />
                <td className="py-3 px-4 text-right font-bold text-emerald-700">{formatCurrency(totalExpected)}</td>
                <td className="py-3 px-4 text-right font-bold text-orange-600">{formatCurrency(totalInvoiced)}</td>
                <td className={`py-3 px-4 text-right font-bold ${totalDiff === 0 ? 'text-emerald-700' : totalDiff > 0 ? 'text-red-700' : 'text-orange-700'}`}>
                  {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function VerificationTab({ timesheets, invoices, placements, year }) {
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [okiOkiData, setOkiOkiData] = useState(null);
  const [manualOkiOki, setManualOkiOki] = useState({});

  const handleManualOkiOkiChange = (invoiceId, value) => {
    setManualOkiOki(prev => ({ ...prev, [invoiceId]: value }));
  };
  const yr = parseInt(year);
  const mo = parseInt(filterMonth);

  // ── Client invoices ────────────────────────────────────────────────────────
  const clientData = useMemo(() => {
    const clientInvoices = invoices.filter(i => i.year === yr && i.month === mo && i.invoice_type === 'client_invoice');
    return clientInvoices.map(invoice => {
      const placement = placements.find(p => p.id === invoice.placement_id);
      const tsForMonth = timesheets.filter(t => t.placement_id === invoice.placement_id && t.month === mo && t.year === yr && t.status === 'approved');
      const approvedDays = tsForMonth.reduce((s, t) => s + (t.days_worked || 0), 0);
      const dailyRate = placement?.client_rate || 0;
      const expectedAmount = approvedDays * dailyRate;
      const invoiceAmount = invoice.amount || 0;
      const difference = invoiceAmount - expectedAmount;
      const percentageDiff = expectedAmount > 0 ? Math.abs((difference / expectedAmount) * 100) : 0;
      const isMatching = Math.abs(difference) < 0.01;
      const isWarning = !isMatching && percentageDiff < 10;
      const isCritical = percentageDiff >= 10;

      // Oki Oki match
      let okiOkiMatch = null;
      if (okiOkiData) {
        const invNum = (invoice.invoice_number || '').toLowerCase().trim();
        const clientName = (placement?.client_company_name || '').toLowerCase().trim();
        okiOkiMatch = okiOkiData.find(row => {
          const rowNum = (row.invoiceNumber || '').toLowerCase().trim();
          const rowClient = (row.clientName || '').toLowerCase().trim();
          if (invNum && rowNum && (rowNum.includes(invNum) || invNum.includes(rowNum))) return true;
          if (clientName && rowClient && rowClient.includes(clientName.split(' ')[0])) return true;
          return false;
        }) || null;
      }
      const okiOkiAmount = okiOkiMatch ? okiOkiMatch.amount : null;
      const okiOkiDiff = okiOkiAmount !== null ? okiOkiAmount - invoiceAmount : null;
      const okiOkiMatch3way = okiOkiDiff !== null ? Math.abs(okiOkiDiff) < 0.01 : null;

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number || '—',
        consultant: tsForMonth[0]?.consultant_name || `${placement?.consultant_first_name || ''} ${placement?.consultant_last_name || ''}`.trim() || '—',
        client: placement?.client_company_name || '—',
        approvedDays, dailyRate, expectedAmount, invoiceAmount,
        difference, percentageDiff, isMatching, isWarning, isCritical,
        okiOkiAmount, okiOkiDiff, okiOkiMatch3way,
      };
    });
  }, [invoices, timesheets, placements, yr, mo, okiOkiData]);

  // ── Consultant invoices ────────────────────────────────────────────────────
  const consultantData = useMemo(() => {
    const consultantInvoices = invoices.filter(i => i.year === yr && i.month === mo && i.invoice_type === 'consultant_invoice');
    return consultantInvoices.map(invoice => {
      const placement = placements.find(p => p.id === invoice.placement_id);
      const tsForMonth = timesheets.filter(t => t.placement_id === invoice.placement_id && t.month === mo && t.year === yr && t.status === 'approved');
      const approvedDays = tsForMonth.reduce((s, t) => s + (t.days_worked || 0), 0);
      const dailyRate = placement?.consultant_rate || 0;
      const expectedAmount = approvedDays * dailyRate; // wat we verwachten te betalen
      const invoiceAmount = invoice.amount || 0;       // wat de consultant factureert
      const difference = invoiceAmount - expectedAmount;
      const percentageDiff = expectedAmount > 0 ? Math.abs((difference / expectedAmount) * 100) : 0;
      const isMatching = Math.abs(difference) < 0.01;
      const isWarning = !isMatching && percentageDiff < 10;
      const isCritical = percentageDiff >= 10;

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number || '—',
        consultant: tsForMonth[0]?.consultant_name || `${placement?.consultant_first_name || ''} ${placement?.consultant_last_name || ''}`.trim() || '—',
        client: placement?.client_company_name || '—',
        approvedDays, dailyRate, expectedAmount, invoiceAmount,
        difference, percentageDiff, isMatching, isWarning, isCritical,
      };
    });
  }, [invoices, timesheets, placements, yr, mo]);

  return (
    <div className="space-y-6">
      {/* Oki Oki import */}
      <OkiOkiImport onImport={setOkiOkiData} importedData={okiOkiData} />

      {/* Month filter */}
      <div className="flex items-center gap-4">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{getMonthName(mo)} {year}</span>
      </div>

      {/* ── Sectie 1: Klantfacturen ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide text-blue-700">Klantfacturen</h2>
          <div className="flex-1 h-px bg-blue-200 ml-2" />
        </div>
        <SummaryCards data={clientData} />
        <ClientVerificationTable data={clientData} okiOkiData={okiOkiData} manualOkiOki={manualOkiOki} onManualOkiOkiChange={handleManualOkiOkiChange} />
      </div>

      {/* ── Sectie 2: Consultantfacturen ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserCircle className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide text-emerald-700">Consultantfacturen</h2>
          <div className="flex-1 h-px bg-emerald-200 ml-2" />
        </div>
        <SummaryCards data={consultantData} />
        <ConsultantVerificationTable data={consultantData} />
      </div>
    </div>
  );
}