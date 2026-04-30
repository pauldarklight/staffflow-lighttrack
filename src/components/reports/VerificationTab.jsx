import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Info, ChevronDown, ChevronRight, Building2, UserCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import OkiOkiImport from '@/components/reports/OkiOkiImport';

// ── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ data }) {
  const ok      = data.filter(d => d.isMatching).length;
  const notOk   = data.filter(d => !d.isMatching).length;
  const totalExpected = data.reduce((s, d) => s + d.expectedAmount, 0);
  const totalInvoiced = data.reduce((s, d) => s + d.invoiceAmount, 0);
  const totalDiff = totalInvoiced - totalExpected;

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-700">{ok} OK</span>
      </div>
      {notOk > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">{notOk} Verschil</span>
        </div>
      )}
      <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${totalDiff === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/50 border-border'}`}>
        <span className="text-xs text-muted-foreground">Totaal verschil:</span>
        <span className={`text-sm font-bold ${totalDiff === 0 ? 'text-emerald-700' : totalDiff > 0 ? 'text-orange-700' : 'text-red-700'}`}>
          {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
        </span>
      </div>
    </div>
  );
}

// ── Expandable row detail panel ──────────────────────────────────────────────

function RowDetail({ row, isClient, manualOkiOki, onManualOkiOkiChange }) {
  // Manual input always takes priority; fall back to auto-matched value
  const manualVal = manualOkiOki && manualOkiOki[row.invoiceId] !== undefined && manualOkiOki[row.invoiceId] !== ''
    ? parseFloat(manualOkiOki[row.invoiceId])
    : null;
  const oki = manualVal !== null ? manualVal : row.okiOkiAmount;
  const okiDiff = oki !== null ? oki - row.invoiceAmount : null;
  const okiMatch = okiDiff !== null ? Math.abs(okiDiff) < 0.01 : false;

  return (
    <tr>
      <td colSpan={6} className="px-6 pb-4 pt-0 bg-muted/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border/40">

          {/* Berekening detail */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Berekening</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Goedgekeurde dagen</span>
              <span className="font-semibold">{row.approvedDays.toFixed(1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{isClient ? 'Tarief klant' : 'Tarief consultant'}</span>
              <span className="font-semibold">{formatCurrency(row.dailyRate)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1 mt-1">
              <span className="text-muted-foreground">Verwacht</span>
              <span className={`font-bold ${isClient ? 'text-primary' : 'text-emerald-700'}`}>{formatCurrency(row.expectedAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{isClient ? 'Gefactureerd' : 'Ontvangen factuur'}</span>
              <span className={`font-bold ${isClient ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(row.invoiceAmount)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1 mt-1">
              <span className="font-semibold">Verschil</span>
              <span className={`font-bold ${row.isMatching ? 'text-emerald-700' : row.difference > 0 ? 'text-orange-700' : 'text-red-700'}`}>
                {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                {!row.isMatching && <span className="text-xs ml-1">({row.percentageDiff.toFixed(1)}%)</span>}
              </span>
            </div>
          </div>

          {/* Oki Oki — altijd invulbaar, ook als auto-gematcht */}
          {isClient && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Oki Oki verificatie</p>
              <div className="flex justify-between text-sm items-center gap-2">
                <span className="text-muted-foreground shrink-0">Oki Oki bedrag</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={row.okiOkiAmount !== null ? String(row.okiOkiAmount) : 'Manueel invullen...'}
                  value={manualOkiOki[row.invoiceId] ?? (row.okiOkiAmount !== null ? row.okiOkiAmount : '')}
                  onChange={e => onManualOkiOkiChange(row.invoiceId, e.target.value)}
                  className="w-36 text-right text-sm border border-purple-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50 text-purple-700 placeholder:text-purple-300"
                />
              </div>
              {row.okiOkiAmount !== null && !manualOkiOki[row.invoiceId] && (
                <p className="text-xs text-purple-500 mt-1">↑ Auto-gematcht via CSV. Pas aan indien nodig.</p>
              )}
              {oki !== null && (
                <div className="flex justify-between text-sm border-t pt-1 mt-1">
                  <span className="font-semibold">Δ Oki Oki vs App</span>
                  {okiMatch
                    ? <span className="flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 className="w-3 h-3" /> OK</span>
                    : <span className={`font-bold ${okiDiff >= 0 ? 'text-orange-700' : 'text-red-700'}`}>{okiDiff >= 0 ? '+' : ''}{formatCurrency(okiDiff)}</span>
                  }
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
            {row.isMatching ? (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Bedragen kloppen overeen</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="font-semibold">
                  Verschil van {formatCurrency(Math.abs(row.difference))} ({row.percentageDiff.toFixed(1)}%)
                  <br />
                  <span className="text-xs font-normal text-muted-foreground">
                    {row.difference > 0
                      ? 'Er werd meer gefactureerd dan verwacht op basis van de timesheet.'
                      : 'Er werd minder gefactureerd dan verwacht op basis van de timesheet.'}
                  </span>
                </span>
              </div>
            )}
          </div>

        </div>
      </td>
    </tr>
  );
}

// ── Generic verification table ───────────────────────────────────────────────

function VerificationTable({ data, isClient, headerBg, rateLabel, expectedLabel, invoicedLabel, expectedColor, invoicedColor, manualOkiOki, onManualOkiOkiChange }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = (id) => setExpandedId(prev => prev === id ? null : id);

  if (data.length === 0) return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground text-sm">
        Geen {isClient ? 'klant' : 'consultant'}facturen gevonden voor deze maand.
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${headerBg}`}>
                <th className="w-8 py-3 px-4" />
                <th className="text-left py-3 px-4 font-bold text-foreground">Factuurnr</th>
                <th className="text-left py-3 px-4 font-bold text-foreground">Consultant</th>
                <th className="text-left py-3 px-4 font-normal text-muted-foreground">Klant</th>
                <th className={`text-right py-3 px-4 font-bold ${expectedColor}`}>{expectedLabel}</th>
                <th className={`text-right py-3 px-4 font-bold ${invoicedColor}`}>{invoicedLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const isOpen = expandedId === row.invoiceId;
                const rowBg = row.isMatching
                  ? 'hover:bg-muted/30'
                  : 'bg-red-50/30 hover:bg-red-50/50';

                return (
                  <React.Fragment key={row.invoiceId}>
                    <tr
                      onClick={() => toggle(row.invoiceId)}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${rowBg}`}
                    >
                      <td className="py-3 px-4 text-muted-foreground">
                        {isOpen
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="py-3 px-4 font-bold">{row.invoiceNumber}</td>
                      <td className="py-3 px-4 font-medium">{row.consultant}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.client}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${expectedColor}`}>
                        {formatCurrency(row.expectedAmount)}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${invoicedColor}`}>
                        <div className="flex items-center justify-end gap-2">
                          {formatCurrency(row.invoiceAmount)}
                          {row.isMatching
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <RowDetail
                        row={row}
                        isClient={isClient}
                        manualOkiOki={manualOkiOki}
                        onManualOkiOkiChange={onManualOkiOkiChange}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t-2 font-semibold text-sm">
                <td colSpan={4} className="py-3 px-4 text-right text-xs text-muted-foreground">Totaal</td>
                <td className={`py-3 px-4 text-right font-bold ${expectedColor}`}>
                  {formatCurrency(data.reduce((s, r) => s + r.expectedAmount, 0))}
                </td>
                <td className={`py-3 px-4 text-right font-bold ${invoicedColor}`}>
                  {formatCurrency(data.reduce((s, r) => s + r.invoiceAmount, 0))}
                </td>
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

  const buildRows = (invoiceType, getRateFromPlacement) =>
    invoices
      .filter(i => i.year === yr && i.month === mo && i.invoice_type === invoiceType)
      .map(invoice => {
        const placement = placements.find(p => p.id === invoice.placement_id);
        const tsForMonth = timesheets.filter(t =>
          t.placement_id === invoice.placement_id && t.month === mo && t.year === yr && t.status === 'approved'
        );
        const approvedDays = tsForMonth.reduce((s, t) => s + (t.days_worked || 0), 0);
        const dailyRate = getRateFromPlacement(placement);
        const expectedAmount = approvedDays * dailyRate;
        const invoiceAmount = invoice.amount || 0;
        const difference = invoiceAmount - expectedAmount;
        const percentageDiff = expectedAmount > 0 ? Math.abs((difference / expectedAmount) * 100) : 0;
        const isMatching = Math.abs(difference) < 0.01;

        // Oki Oki auto-match (client invoices only)
        let okiOkiAmount = null;
        if (okiOkiData && invoiceType === 'client_invoice') {
          const invNum = (invoice.invoice_number || '').toLowerCase().trim();
          const clientName = (placement?.client_company_name || '').toLowerCase().trim();
          const match = okiOkiData.find(row => {
            const rowNum = (row.invoiceNumber || '').toLowerCase().trim();
            const rowClient = (row.clientName || '').toLowerCase().trim();
            if (invNum && rowNum && (rowNum.includes(invNum) || invNum.includes(rowNum))) return true;
            if (clientName && rowClient && rowClient.includes(clientName.split(' ')[0])) return true;
            return false;
          });
          okiOkiAmount = match ? match.amount : null;
        }

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number || '—',
          consultant: tsForMonth[0]?.consultant_name ||
            `${placement?.consultant_first_name || ''} ${placement?.consultant_last_name || ''}`.trim() || '—',
          client: placement?.client_company_name || '—',
          approvedDays, dailyRate, expectedAmount, invoiceAmount,
          difference, percentageDiff, isMatching,
          isWarning: !isMatching && percentageDiff < 10,
          isCritical: percentageDiff >= 10,
          okiOkiAmount,
        };
      });

  const clientData     = useMemo(() => buildRows('client_invoice',     p => p?.client_rate || 0),     [invoices, timesheets, placements, yr, mo, okiOkiData]);
  const consultantData = useMemo(() => buildRows('consultant_invoice', p => p?.consultant_rate || 0), [invoices, timesheets, placements, yr, mo]);

  return (
    <div className="space-y-8">
      {/* Oki Oki import */}
      <OkiOkiImport onImport={data => { setOkiOkiData(data); setManualOkiOki({}); }} importedData={okiOkiData} />

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
          <h2 className="text-sm font-bold uppercase tracking-wide text-blue-700">Klantfacturen</h2>
          <div className="flex-1 h-px bg-blue-200 ml-2" />
        </div>
        <SummaryStrip data={clientData} />
        <VerificationTable
          data={clientData}
          isClient={true}
          headerBg="bg-blue-50/50"
          expectedLabel="Verwacht"
          invoicedLabel="Gefactureerd"
          expectedColor="text-primary"
          invoicedColor="text-blue-600"
          manualOkiOki={manualOkiOki}
          onManualOkiOkiChange={handleManualOkiOkiChange}
        />
      </div>

      {/* ── Sectie 2: Consultantfacturen ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserCircle className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700">Consultantfacturen</h2>
          <div className="flex-1 h-px bg-emerald-200 ml-2" />
        </div>
        <SummaryStrip data={consultantData} />
        <VerificationTable
          data={consultantData}
          isClient={false}
          headerBg="bg-emerald-50/50"
          expectedLabel="Verwacht te betalen"
          invoicedLabel="Ontvangen factuur"
          expectedColor="text-emerald-700"
          invoicedColor="text-orange-600"
        />
      </div>
    </div>
  );
}