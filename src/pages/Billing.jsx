import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink, TrendingUp, TrendingDown, CheckCircle2, Clock, FileText } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { formatCurrency, getMonthName, formatDate } from '@/lib/formatters';

function isOverdue(invoice) {
  if (!invoice || invoice.status === 'paid') return false;
  const today = new Date();
  if (invoice.due_date && today > new Date(invoice.due_date)) return true;
  if (invoice.issue_date) {
    const diff = (today - new Date(invoice.issue_date)) / (1000 * 60 * 60 * 24);
    if (diff > 14) return true;
  }
  return false;
}

function InvoiceStatusCell({ invoice, hasTimesheet, onMarkPaid, type }) {
  const overdue = invoice ? isOverdue(invoice) : false;

  if (!invoice) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-xs w-fit">Geen factuur</Badge>
        {type === 'client' && hasTimesheet && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> TS ontvangen
          </span>
        )}
        {type === 'client' && !hasTimesheet && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Geen TS
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {overdue ? (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs w-fit">
          <AlertCircle className="w-3 h-3 mr-1" /> Achterstallig
        </Badge>
      ) : invoice.status === 'paid' ? (
        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs w-fit">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Betaald
        </Badge>
      ) : invoice.status === 'sent' ? (
        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs w-fit">
          <FileText className="w-3 h-3 mr-1" /> Verstuurd
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs w-fit">Concept</Badge>
      )}

      {type === 'client' && (
        <span className={`text-xs flex items-center gap-1 ${hasTimesheet ? 'text-emerald-600' : 'text-amber-600'}`}>
          {hasTimesheet ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {hasTimesheet ? 'TS ontvangen' : 'TS ontbreekt'}
        </span>
      )}

      {invoice.status !== 'paid' && (
        <button className="text-xs text-primary hover:underline text-left" onClick={() => onMarkPaid(invoice)}>
          Markeer betaald
        </button>
      )}
      {invoice.invoice_number && (
        <span className="text-xs text-muted-foreground">{invoice.invoice_number}</span>
      )}
    </div>
  );
}

export default function Billing() {
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const queryClient = useQueryClient();

  const { data: placements = [] } = useQuery({ queryKey: ['placements'], queryFn: () => base44.entities.Placement.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date') });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const years = [2024, 2025, 2026, 2027];

  const markPaid = (invoice) => {
    updateInvoiceMutation.mutate({
      id: invoice.id,
      data: { ...invoice, status: 'paid', paid_date: new Date().toISOString().split('T')[0] },
    });
  };

  const { freelancerRows, permRows } = useMemo(() => {
    const month = parseInt(filterMonth);
    const year = parseInt(filterYear);

    const buildRow = (placement, idx) => {
      const ts = timesheets.find(t => t.placement_id === placement.id && t.month === month && t.year === year);
      const clientInvoice = invoices.find(i => i.placement_id === placement.id && i.month === month && i.year === year && i.invoice_type === 'client_invoice');
      const consultantInvoice = invoices.find(i => i.placement_id === placement.id && i.month === month && i.year === year && i.invoice_type === 'consultant_invoice');

      const isPerm = placement.placement_type === 'perm';
      const days = ts?.days_worked || 0;
      const clientRate = placement.client_rate || 0;
      const consultantRate = placement.consultant_rate || 0;
      const clientAmount = isPerm ? (placement.perm_fee_amount || 0) : days * clientRate;
      const consultantAmount = isPerm ? 0 : days * consultantRate;
      const margin = clientAmount - consultantAmount;
      const clientTotal = clientInvoice?.total_amount || clientAmount * 1.21;
      const consultantTotal = consultantInvoice?.total_amount || consultantAmount * 1.21;

      return { idx, placement, ts, clientInvoice, consultantInvoice, days, clientRate, consultantRate, clientAmount, consultantAmount, margin, clientTotal, consultantTotal, isPerm };
    };

    const freelancers = placements.filter(p => !p.placement_type || p.placement_type === 'freelancer').map((p, i) => buildRow(p, i + 1));
    const perms = placements.filter(p => p.placement_type === 'perm').map((p, i) => buildRow(p, i + 1));

    return { freelancerRows: freelancers, permRows: perms };
  }, [placements, timesheets, invoices, filterMonth, filterYear]);

  const totalClientReceived = [...freelancerRows, ...permRows].reduce((s, r) => s + (r.clientInvoice?.status === 'paid' ? r.clientTotal : 0), 0);
  const totalOpen = [...freelancerRows, ...permRows].reduce((s, r) => s + (r.clientInvoice?.status !== 'paid' ? r.clientTotal : 0), 0);
  const totalMargin = freelancerRows.reduce((s, r) => s + r.margin, 0);

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
          onClick={() => alert('OkiOki koppeling vereist een Builder+ abonnement voor backend functies.')}
        >
          <ExternalLink className="w-4 h-4" /> OkiOki (Xerius)
        </Button>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Ontvangen van klanten" value={formatCurrency(totalClientReceived)} icon={TrendingUp} />
        <StatCard title="Openstaand" value={formatCurrency(totalOpen)} />
        <StatCard title="Freelancer marge" value={formatCurrency(totalMargin)} icon={TrendingDown} trendUp={totalMargin > 0} />
      </div>

      {/* ── FREELANCERS ── */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold">Freelancers — {getMonthName(parseInt(filterMonth))} {filterYear}</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">Freelancer</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">BTW nr.</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tewerkgesteld bij</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagen</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tarief</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground bg-blue-50">Van klant (incl. BTW)</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-blue-50">Status klant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground bg-amber-50">Aan consultant (incl. BTW)</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-amber-50">Status consultant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                </tr>
              </thead>
              <tbody>
                {freelancerRows.map(row => {
                  const clientOverdue = row.clientInvoice ? isOverdue(row.clientInvoice) : false;
                  const consultantOverdue = row.consultantInvoice ? isOverdue(row.consultantInvoice) : false;
                  return (
                    <tr key={row.placement.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground">{row.idx}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</div>
                        {row.placement.consultant_company_name && <div className="text-xs text-muted-foreground">{row.placement.consultant_company_name}</div>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{row.placement.consultant_vat_number || '—'}</td>
                      <td className="py-3 px-4 font-medium">{row.placement.client_company_name}</td>
                      <td className="py-3 px-4 text-right">
                        {row.days > 0 ? <span className="font-semibold">{row.days}</span> : <span className="text-muted-foreground text-xs">geen TS</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.clientRate)}/dag</td>
                      <td className={`py-3 px-4 text-right bg-blue-50/50 ${clientOverdue ? 'text-red-600 font-bold' : 'font-semibold'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {formatCurrency(row.clientTotal)}
                        </div>
                      </td>
                      <td className="py-3 px-4 bg-blue-50/50">
                        <InvoiceStatusCell invoice={row.clientInvoice} hasTimesheet={!!row.ts} onMarkPaid={markPaid} type="client" />
                      </td>
                      <td className={`py-3 px-4 text-right bg-amber-50/50 ${consultantOverdue ? 'text-red-600 font-bold' : 'font-semibold'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {consultantOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {formatCurrency(row.consultantTotal)}
                        </div>
                      </td>
                      <td className="py-3 px-4 bg-amber-50/50">
                        <InvoiceStatusCell invoice={row.consultantInvoice} hasTimesheet={!!row.ts} onMarkPaid={markPaid} type="consultant" />
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${row.margin > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatCurrency(row.margin)}
                        {row.days > 0 && <div className="text-xs font-normal text-muted-foreground">{formatCurrency(row.clientRate - row.consultantRate)}/dag</div>}
                      </td>
                    </tr>
                  );
                })}
                {freelancerRows.length === 0 && (
                  <tr><td colSpan={11} className="py-8 text-center text-muted-foreground text-sm">Geen freelancer placements</td></tr>
                )}
                {freelancerRows.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2">
                    <td colSpan={6} className="py-3 px-4 text-right text-muted-foreground">Totaal</td>
                    <td className="py-3 px-4 text-right bg-blue-50/70">{formatCurrency(freelancerRows.reduce((s, r) => s + r.clientTotal, 0))}</td>
                    <td className="bg-blue-50/70" />
                    <td className="py-3 px-4 text-right bg-amber-50/70">{formatCurrency(freelancerRows.reduce((s, r) => s + r.consultantTotal, 0))}</td>
                    <td className="bg-amber-50/70" />
                    <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(totalMargin)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── PERM ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold">PERM — Vaste aanwervingen</CardTitle>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200">PERM</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Eenmalige fee ≈ 20% van jaarloon kandidaat</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kandidaat</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tewerkgesteld bij</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Jaarloon</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Fee %</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground bg-blue-50">Eenmalige fee (excl. BTW)</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-blue-50">Factuurstatus</th>
                </tr>
              </thead>
              <tbody>
                {permRows.map(row => {
                  const clientOverdue = row.clientInvoice ? isOverdue(row.clientInvoice) : false;
                  const feeExcl = row.placement.perm_fee_amount || 0;
                  return (
                    <tr key={row.placement.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground">{row.idx}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(row.placement.start_date)}</div>
                      </td>
                      <td className="py-3 px-4 font-medium">{row.placement.client_company_name}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(row.placement.perm_annual_salary || 0)}</td>
                      <td className="py-3 px-4 text-right">{row.placement.perm_fee_percentage || 20}%</td>
                      <td className={`py-3 px-4 text-right bg-blue-50/50 font-semibold ${clientOverdue ? 'text-red-600' : ''}`}>
                        <div className="flex items-center justify-end gap-1">
                          {clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {formatCurrency(feeExcl)}
                        </div>
                        <div className="text-xs text-muted-foreground font-normal">incl. BTW: {formatCurrency(feeExcl * 1.21)}</div>
                      </td>
                      <td className="py-3 px-4 bg-blue-50/50">
                        <InvoiceStatusCell invoice={row.clientInvoice} hasTimesheet={false} onMarkPaid={markPaid} type="perm" />
                      </td>
                    </tr>
                  );
                })}
                {permRows.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">Geen PERM placements</td></tr>
                )}
                {permRows.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2">
                    <td colSpan={5} className="py-3 px-4 text-right text-muted-foreground">Totaal fees</td>
                    <td className="py-3 px-4 text-right bg-blue-50/70">{formatCurrency(permRows.reduce((s, r) => s + (r.placement.perm_fee_amount || 0), 0))}</td>
                    <td className="bg-blue-50/70" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-orange-200 bg-orange-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">OkiOki (Xerius) koppeling</p>
            <p className="text-xs text-orange-700 mt-1">Directe API-koppeling voor automatisch aanmaken en versturen van facturen is beschikbaar via Builder+ abonnement.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}