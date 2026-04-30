import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Info, Link2, Link2Off } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import OkiOkiImport from '@/components/reports/OkiOkiImport';

export default function VerificationTab({ timesheets, invoices, placements, year }) {
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [okiOkiData, setOkiOkiData] = useState(null); // imported Oki Oki rows
  const yr = parseInt(year);
  const mo = parseInt(filterMonth);

  const verificationData = useMemo(() => {
    const invoicesForMonth = invoices.filter(i => i.year === yr && i.month === mo && i.invoice_type === 'client_invoice');
    
    return invoicesForMonth.map(invoice => {
      const placement = placements.find(p => p.id === invoice.placement_id);
      const timesheetsForMonth = timesheets.filter(t => t.placement_id === invoice.placement_id && t.month === mo && t.year === yr && t.status === 'approved');
      
      // Berekende bedrag: dagtarief × goedgekeurde dagen
      const approvedDays = timesheetsForMonth.reduce((sum, ts) => sum + (ts.days_worked || 0), 0);
      const dailyRate = placement?.client_rate || 0;
      const expectedAmount = approvedDays * dailyRate;
      
      // Werkelijk factuurbedrag (in app)
      const invoiceAmount = invoice.amount || 0;
      
      // Oki Oki match: zoek op factuurnummer of klantnaam
      let okiOkiMatch = null;
      if (okiOkiData) {
        const invNum = (invoice.invoice_number || '').toLowerCase().trim();
        const clientName = (placement?.client_company_name || '').toLowerCase().trim();
        okiOkiMatch = okiOkiData.find(row => {
          const rowNum = (row.invoiceNumber || '').toLowerCase().trim();
          const rowClient = (row.clientName || '').toLowerCase().trim();
          if (invNum && rowNum && rowNum.includes(invNum)) return true;
          if (invNum && rowNum && invNum.includes(rowNum)) return true;
          if (clientName && rowClient && rowClient.includes(clientName.split(' ')[0])) return true;
          return false;
        }) || null;
      }
      const okiOkiAmount = okiOkiMatch ? okiOkiMatch.amount : null;

      // Verschil: app vs berekend
      const difference = invoiceAmount - expectedAmount;
      const percentageDiff = expectedAmount > 0 ? Math.abs((difference / expectedAmount) * 100) : 0;
      const isMatching = Math.abs(difference) < 0.01;
      const isWarning = !isMatching && percentageDiff < 10;
      const isCritical = percentageDiff >= 10;

      // Oki Oki vs app verschil
      const okiOkiDiff = okiOkiAmount !== null ? okiOkiAmount - invoiceAmount : null;
      const okiOkiMatch3way = okiOkiAmount !== null ? Math.abs(okiOkiDiff) < 0.01 : null;

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number || '—',
        consultant: timesheetsForMonth[0]?.consultant_name || placement?.consultant_first_name + ' ' + placement?.consultant_last_name || '—',
        client: placement?.client_company_name || '—',
        approvedDays,
        dailyRate,
        expectedAmount,
        invoiceAmount,
        difference,
        percentageDiff,
        isMatching,
        isWarning,
        isCritical,
        status: invoice.status,
        okiOkiAmount,
        okiOkiDiff,
        okiOkiMatch3way,
        okiOkiMatchedRow: okiOkiMatch,
      };
    });
  }, [invoices, timesheets, placements, yr, mo, okiOkiData]);

  const matchingCount = verificationData.filter(d => d.isMatching).length;
  const warningCount = verificationData.filter(d => d.isWarning).length;
  const criticalCount = verificationData.filter(d => d.isCritical).length;

  const totalExpected = verificationData.reduce((s, d) => s + d.expectedAmount, 0);
  const totalInvoiced = verificationData.reduce((s, d) => s + d.invoiceAmount, 0);
  const totalDifference = totalInvoiced - totalExpected;

  return (
    <div className="space-y-6">
      {/* Oki Oki import */}
      <OkiOkiImport onImport={setOkiOkiData} importedData={okiOkiData} />

      {/* Month filter */}
      <div className="flex items-center gap-4">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {getMonthName(i + 1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{getMonthName(mo)} {year}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <div className={`text-lg font-bold ${totalDifference === 0 ? 'text-emerald-700' : totalDifference > 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {totalDifference >= 0 ? '+' : ''}{formatCurrency(totalDifference)}
            </div>
            <div className="text-xs text-muted-foreground">Totaal verschil</div>
          </CardContent>
        </Card>
      </div>

      {/* Details table */}
      {verificationData.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Geen klantfacturen voor deze maand
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Controlerapport — Factuurverificatie</CardTitle>
            <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                  <Info className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-sm">
                <div className="space-y-3">
                  <p className="font-semibold text-base">Hoe werkt deze verificatie?</p>

                  <div className="space-y-2 text-sm">
                    <div className="bg-blue-950 p-2 rounded">
                      <p className="font-medium text-blue-100">📋 Verwacht bedrag:</p>
                      <p className="text-blue-100/80 text-xs mt-1">Goedgekeurde dagen (Timesheet) × Dagtarief klant (Placement)</p>
                      <p className="text-blue-300 text-xs mt-1">Voorbeeld: 20 dagen × €500/dag = €10.000</p>
                    </div>

                    <div className="bg-green-950 p-2 rounded">
                      <p className="font-medium text-green-100">💳 Gefactureerd bedrag:</p>
                      <p className="text-green-100/80 text-xs mt-1">Bedrag op de klantfactuur (Invoice)</p>
                      <p className="text-green-300 text-xs mt-1">Dit is wat u werkelijk heeft gefactureerd</p>
                    </div>

                    <div className="bg-slate-700 p-2 rounded">
                      <p className="font-medium text-slate-100">🔍 Verschil:</p>
                      <p className="text-slate-200 text-xs mt-1">Gefactureerd − Verwacht</p>
                      <p className="text-slate-300 text-xs mt-1">Positief (+) = té veel gefactureerd | Negatief (−) = té weinig</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 border-t border-slate-600 pt-2">✓ Ideaal: beide bedragen kloppen overeen (verschil ≈ €0)</p>
                </div>
              </TooltipContent>
            </Tooltip>
            </TooltipProvider>
            </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-bold text-foreground">Factuurnr</th>
                    <th className="text-left py-3 px-4 font-bold text-foreground">Consultant</th>
                    <th className="text-left py-3 px-4 font-normal text-muted-foreground">Klant</th>
                    <th className="text-right py-3 px-4 font-bold text-foreground">Goedgekeurd Dagen</th>
                    <th className="text-right py-3 px-4 font-bold text-foreground">Dagtarief</th>
                    <th className="text-right py-3 px-4 font-bold text-primary">Verwacht</th>
                    <th className="text-right py-3 px-4 font-bold text-blue-600">Gefactureerd</th>
                    <th className="text-right py-3 px-4 font-bold text-foreground">Verschil</th>
                    {okiOkiData && <th className="text-right py-3 px-4 font-bold text-blue-700">Oki Oki</th>}
                    {okiOkiData && <th className="text-right py-3 px-4 font-bold text-blue-700">Δ Oki Oki</th>}
                    <th className="text-center py-3 px-4 font-bold text-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationData.map(row => (
                    <tr
                      key={row.invoiceId}
                      className={`border-b border-border/50 ${
                        row.isMatching ? 'hover:bg-emerald-50/20' : row.isWarning ? 'hover:bg-amber-50/20 bg-amber-50/10' : 'hover:bg-red-50/20 bg-red-50/10'
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-foreground">{row.invoiceNumber}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{row.consultant}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.client}</td>
                      <td className="py-3 px-4 text-right font-semibold">{row.approvedDays.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.dailyRate)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-primary">{formatCurrency(row.expectedAmount)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-blue-600">{formatCurrency(row.invoiceAmount)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${row.isMatching ? 'text-emerald-700' : row.difference > 0 ? 'text-orange-700' : 'text-red-700'}`}>
                        {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                      </td>
                      {okiOkiData && (
                        <td className="py-3 px-4 text-right font-semibold text-blue-700">
                          {row.okiOkiAmount !== null ? formatCurrency(row.okiOkiAmount) : (
                            <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                              <Link2Off className="w-3 h-3" /> niet gevonden
                            </span>
                          )}
                        </td>
                      )}
                      {okiOkiData && (
                        <td className={`py-3 px-4 text-right font-bold ${
                          row.okiOkiDiff === null ? 'text-muted-foreground' :
                          row.okiOkiMatch3way ? 'text-emerald-700' :
                          Math.abs(row.okiOkiDiff) < invoices.length ? 'text-amber-700' : 'text-red-700'
                        }`}>
                          {row.okiOkiDiff !== null ? (
                            row.okiOkiMatch3way ? (
                              <span className="flex items-center justify-end gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            ) : (
                              <>{row.okiOkiDiff >= 0 ? '+' : ''}{formatCurrency(row.okiOkiDiff)}</>
                            )
                          ) : '—'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center">
                        {row.isMatching ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 flex items-center justify-center gap-1 w-fit mx-auto">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </Badge>
                        ) : row.isWarning ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300 flex items-center justify-center gap-1 w-fit mx-auto">
                            <AlertCircle className="w-3 h-3" /> {row.percentageDiff.toFixed(1)}%
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-300 flex items-center justify-center gap-1 w-fit mx-auto">
                            <AlertCircle className="w-3 h-3" /> {row.percentageDiff.toFixed(1)}%
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 font-semibold">
                    <td colSpan={3} className="py-3 px-4 text-right text-xs text-muted-foreground font-bold">Totaal</td>
                    <td className="py-3 px-4 text-right font-bold">{verificationData.reduce((s, r) => s + r.approvedDays, 0).toFixed(1)}</td>
                    <td />
                    <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(totalExpected)}</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-600">{formatCurrency(totalInvoiced)}</td>
                    <td className={`py-3 px-4 text-right font-bold ${totalDifference === 0 ? 'text-emerald-700' : totalDifference > 0 ? 'text-orange-700' : 'text-red-700'}`}>
                      {totalDifference >= 0 ? '+' : ''}{formatCurrency(totalDifference)}
                    </td>
                    {okiOkiData && (
                      <td className="py-3 px-4 text-right font-bold text-blue-700">
                        {formatCurrency(verificationData.reduce((s, r) => s + (r.okiOkiAmount || 0), 0))}
                      </td>
                    )}
                    {okiOkiData && <td />}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}