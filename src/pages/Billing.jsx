import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { formatCurrency, getMonthName } from '@/lib/formatters';

function isOverdue(invoice) {
  if (!invoice || invoice.status === 'paid') return false;
  const today = new Date();
  if (invoice.due_date) {
    const due = new Date(invoice.due_date);
    if (today > due) return true;
  }
  if (invoice.issue_date && invoice.status !== 'paid') {
    const issued = new Date(invoice.issue_date);
    const diff = (today - issued) / (1000 * 60 * 60 * 24);
    if (diff > 14) return true;
  }
  return false;
}

export default function Billing() {
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const queryClient = useQueryClient();

  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  // Build per-placement billing rows for selected month/year
  const billingRows = useMemo(() => {
    const month = parseInt(filterMonth);
    const year = parseInt(filterYear);

    return placements.map((placement, idx) => {
      const ts = timesheets.find(
        t => t.placement_id === placement.id && t.month === month && t.year === year
      );

      const clientInvoice = invoices.find(
        i => i.placement_id === placement.id && i.month === month && i.year === year && i.invoice_type === 'client_invoice'
      );
      const consultantInvoice = invoices.find(
        i => i.placement_id === placement.id && i.month === month && i.year === year && i.invoice_type === 'consultant_invoice'
      );

      const days = ts?.days_worked || 0;
      const clientRate = placement.client_rate || 0;
      const consultantRate = placement.consultant_rate || 0;
      const clientAmount = days * clientRate;
      const consultantAmount = days * consultantRate;
      const margin = clientAmount - consultantAmount;

      // Use invoice totals if available, else calculated
      const clientTotal = clientInvoice?.total_amount || clientAmount * 1.21;
      const consultantTotal = consultantInvoice?.total_amount || consultantAmount * 1.21;

      const clientOverdue = clientInvoice ? isOverdue(clientInvoice) : false;
      const consultantOverdue = consultantInvoice ? isOverdue(consultantInvoice) : false;

      return {
        idx: idx + 1,
        placement,
        ts,
        clientInvoice,
        consultantInvoice,
        days,
        clientRate,
        consultantRate,
        clientAmount,
        consultantAmount,
        margin,
        clientTotal,
        consultantTotal,
        clientOverdue,
        consultantOverdue,
      };
    });
  }, [placements, timesheets, invoices, filterMonth, filterYear]);

  const totalClientReceived = billingRows.reduce((s, r) => s + (r.clientInvoice?.status === 'paid' ? r.clientTotal : 0), 0);
  const totalConsultantPaid = billingRows.reduce((s, r) => s + (r.consultantInvoice?.status === 'paid' ? r.consultantTotal : 0), 0);
  const totalMargin = billingRows.reduce((s, r) => s + r.margin, 0);
  const openClientAmount = billingRows.reduce((s, r) => s + (r.clientInvoice?.status !== 'paid' ? r.clientTotal : 0), 0);

  const markPaid = (invoice, type) => {
    if (!invoice) return;
    updateInvoiceMutation.mutate({
      id: invoice.id,
      data: { ...invoice, status: 'paid', paid_date: new Date().toISOString().split('T')[0] },
    });
  };

  return (
    <div>
      <PageHeader title="Facturatie" subtitle="Maandoverzicht per consultant">
        <div className="flex items-center gap-2">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          onClick={() => alert('OkiOki koppeling vereist een Builder+ abonnement voor backend functies. Contacteer de beheerder.')}
        >
          <ExternalLink className="w-4 h-4" />
          OkiOki (Xerius)
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Ontvangen van klanten" value={formatCurrency(totalClientReceived)} icon={TrendingUp} />
        <StatCard title="Openstaand klanten" value={formatCurrency(openClientAmount)} />
        <StatCard title="Betaald aan consultants" value={formatCurrency(totalConsultantPaid)} icon={TrendingDown} />
        <StatCard title="Totale marge" value={formatCurrency(totalMargin)} icon={Minus} trendUp={totalMargin > 0} />
      </div>

      {/* Main billing table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {getMonthName(parseInt(filterMonth))} {filterYear} — Overzicht per consultant
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vennootschap consultant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">BTW nr.</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tewerkgesteld bij</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagen</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tarief klant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground bg-blue-50">Van klant (incl. BTW)</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-blue-50">Status klant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground bg-amber-50">Aan consultant (incl. BTW)</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-amber-50">Status consultant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge (excl. BTW)</th>
                </tr>
              </thead>
              <tbody>
                {billingRows.map(row => (
                  <tr key={row.placement.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    {/* # */}
                    <td className="py-3 px-4 text-muted-foreground font-medium">{row.idx}</td>

                    {/* Vennootschap consultant */}
                    <td className="py-3 px-4">
                      <div className="font-medium">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</div>
                      {row.placement.consultant_company_name && (
                        <div className="text-xs text-muted-foreground">{row.placement.consultant_company_name}</div>
                      )}
                    </td>

                    {/* BTW nr */}
                    <td className="py-3 px-4 text-muted-foreground text-xs">
                      {row.placement.consultant_vat_number || '—'}
                    </td>

                    {/* Tewerkgesteld bij */}
                    <td className="py-3 px-4 font-medium">{row.placement.client_company_name}</td>

                    {/* Dagen */}
                    <td className="py-3 px-4 text-right">
                      {row.days > 0 ? (
                        <span className="font-semibold">{row.days}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">geen TS</span>
                      )}
                    </td>

                    {/* Tarief klant */}
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {formatCurrency(row.clientRate)}/dag
                    </td>

                    {/* Van klant */}
                    <td className={`py-3 px-4 text-right bg-blue-50/50 ${row.clientOverdue ? 'text-red-600 font-bold' : 'font-semibold'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span>{formatCurrency(row.clientTotal)}</span>
                      </div>
                      {row.clientOverdue && (
                        <div className="text-xs text-red-500 font-normal">Achterstallig</div>
                      )}
                      {row.clientInvoice && (
                        <div className="text-xs text-muted-foreground font-normal">{row.clientInvoice.invoice_number}</div>
                      )}
                    </td>

                    {/* Status klant */}
                    <td className="py-3 px-4 bg-blue-50/50">
                      {row.clientInvoice ? (
                        <div className="flex flex-col gap-1">
                          <ClientStatusBadge status={row.clientInvoice.status} overdue={row.clientOverdue} />
                          {row.clientInvoice.status !== 'paid' && (
                            <button
                              className="text-xs text-primary hover:underline text-left"
                              onClick={() => markPaid(row.clientInvoice, 'client')}
                            >
                              Markeer betaald
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Geen factuur</span>
                      )}
                    </td>

                    {/* Aan consultant */}
                    <td className={`py-3 px-4 text-right bg-amber-50/50 ${row.consultantOverdue ? 'text-red-600 font-bold' : 'font-semibold'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {row.consultantOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span>{formatCurrency(row.consultantTotal)}</span>
                      </div>
                      {row.consultantInvoice && (
                        <div className="text-xs text-muted-foreground font-normal">{row.consultantInvoice.invoice_number}</div>
                      )}
                    </td>

                    {/* Status consultant */}
                    <td className="py-3 px-4 bg-amber-50/50">
                      {row.consultantInvoice ? (
                        <div className="flex flex-col gap-1">
                          <ClientStatusBadge status={row.consultantInvoice.status} overdue={row.consultantOverdue} />
                          {row.consultantInvoice.status !== 'paid' && (
                            <button
                              className="text-xs text-primary hover:underline text-left"
                              onClick={() => markPaid(row.consultantInvoice, 'consultant')}
                            >
                              Markeer betaald
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Geen factuur</span>
                      )}
                    </td>

                    {/* Marge */}
                    <td className={`py-3 px-4 text-right font-bold ${row.margin > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatCurrency(row.margin)}
                      {row.days > 0 && (
                        <div className="text-xs font-normal text-muted-foreground">
                          {formatCurrency(row.clientRate - row.consultantRate)}/dag
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Totaalrij */}
                {billingRows.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                    <td colSpan={6} className="py-3 px-4 text-right text-muted-foreground">Totaal</td>
                    <td className="py-3 px-4 text-right bg-blue-50/70">
                      {formatCurrency(billingRows.reduce((s, r) => s + r.clientTotal, 0))}
                    </td>
                    <td className="bg-blue-50/70" />
                    <td className="py-3 px-4 text-right bg-amber-50/70">
                      {formatCurrency(billingRows.reduce((s, r) => s + r.consultantTotal, 0))}
                    </td>
                    <td className="bg-amber-50/70" />
                    <td className="py-3 px-4 text-right text-emerald-600">
                      {formatCurrency(totalMargin)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {billingRows.length === 0 && (
              <div className="py-16 text-center text-muted-foreground">
                Geen placements gevonden.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OkiOki info banner */}
      <Card className="mt-6 border-orange-200 bg-orange-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">OkiOki (Xerius) koppeling</p>
            <p className="text-xs text-orange-700 mt-1">
              Een directe API-koppeling met OkiOki voor automatisch aanmaken en versturen van facturen is mogelijk via een Builder+ abonnement.
              De bovenstaande facturatiedata (bedragen, klanten, BTW-nummers) is klaar om automatisch door te sturen.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientStatusBadge({ status, overdue }) {
  if (overdue && status !== 'paid') {
    return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">Achterstallig</Badge>;
  }
  const map = {
    draft: { label: 'Concept', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    sent: { label: 'Verstuurd', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    paid: { label: 'Betaald', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    overdue: { label: 'Achterstallig', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const s = map[status] || map.draft;
  return <Badge variant="outline" className={`${s.cls} text-xs`}>{s.label}</Badge>;
}