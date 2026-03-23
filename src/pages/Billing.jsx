import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink, CheckCircle2, Clock, FileText, Mail, Loader2, TrendingUp, Euro } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatCurrency, getMonthName, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';

const VAT_RATE = 1.21;

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

function contractRemaining(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  const totalDays = (end - start) / (1000 * 60 * 60 * 24);
  const elapsedDays = Math.max(0, (today - start) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const totalMonths = Math.round(totalDays / 30);
  const elapsedMonths = Math.min(totalMonths, Math.round(elapsedDays / 30));
  const remainingMonths = Math.max(0, totalMonths - elapsedMonths);
  return { totalMonths, elapsedMonths, remainingMonths, remainingDays: Math.round(remainingDays) };
}

function ContractDuration({ placement }) {
  const info = contractRemaining(placement.start_date, placement.end_date);
  if (!info) return (
    <div className="text-xs text-muted-foreground">
      <div>{formatDate(placement.start_date)} → geen einddatum</div>
    </div>
  );
  const pct = info.totalMonths > 0 ? Math.min(100, (info.elapsedMonths / info.totalMonths) * 100) : 0;
  const isNearEnd = info.remainingMonths <= 1;
  return (
    <div className="text-xs space-y-1 min-w-[140px]">
      <div className="text-muted-foreground">{formatDate(placement.start_date)} → {formatDate(placement.end_date)}</div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${isNearEnd ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`font-medium ${isNearEnd ? 'text-red-600' : 'text-foreground'}`}>
        {info.remainingMonths > 0
          ? `${info.remainingMonths} mnd resterend (${info.elapsedMonths}/${info.totalMonths} mnd)`
          : `${info.remainingDays} dagen resterend`}
      </div>
    </div>
  );
}

function StatusCell({ invoice, hasTimesheet, onMarkPaid, onSendReminder, sendingReminder, showTimesheetStatus }) {
  const overdue = invoice ? isOverdue(invoice) : false;
  return (
    <div className="flex flex-col gap-1">
      {!invoice ? (
        <>
          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-xs w-fit">Geen factuur</Badge>
          {showTimesheetStatus && (
            <span className={`text-xs flex items-center gap-1 ${hasTimesheet ? 'text-emerald-600' : 'text-amber-600'}`}>
              {hasTimesheet ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {hasTimesheet ? 'TS ontvangen' : 'Geen TS'}
            </span>
          )}
        </>
      ) : (
        <>
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
          {showTimesheetStatus && (
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
          {invoice.status === 'sent' && (
            <button className="text-xs text-amber-700 hover:underline flex items-center gap-1 text-left" onClick={() => onSendReminder(invoice)} disabled={sendingReminder}>
              {sendingReminder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Herinnering sturen
            </button>
          )}
        </>
      )}
    </div>
  );
}

function InvoiceRef({ invoice }) {
  if (!invoice?.invoice_number) return <span className="text-xs text-muted-foreground">—</span>;
  return <div className="text-xs font-mono text-muted-foreground">{invoice.invoice_number}</div>;
}

function SummaryBar({ label, expected, received, open, margin, showVat, vatRate }) {
  const f = (v) => formatCurrency(showVat ? v * vatRate : v);
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{label}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Te ontvangen</p>
            <p className="text-lg font-bold">{f(expected)}</p>
            <div className="w-full bg-muted rounded-full h-1.5 mt-1">
              <div className="h-1.5 rounded-full bg-primary" style={{ width: expected > 0 ? `${Math.min(100, (received / expected) * 100)}%` : '0%' }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Al ontvangen</p>
            <p className="text-lg font-bold text-emerald-600">{f(received)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Openstaand</p>
            <p className="text-lg font-bold text-amber-600">{f(open)}</p>
          </div>
          {margin !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Marge</p>
              <p className={`text-lg font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{f(margin)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Billing() {
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [showVat, setShowVat] = useState(true);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const queryClient = useQueryClient();

  const { data: placements = [] } = useQuery({ queryKey: ['placements'], queryFn: () => base44.entities.Placement.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list('-created_date') });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const markPaid = (invoice) => {
    updateInvoiceMutation.mutate({ id: invoice.id, data: { ...invoice, status: 'paid', paid_date: new Date().toISOString().split('T')[0] } });
  };

  const sendReminder = async (invoice) => {
    setSendingReminderId(invoice.id);
    const placement = placements.find(p => p.id === invoice.placement_id);
    const email = placement?.client_billing_email;
    if (!email) { toast.error('Geen facturatiemail gekoppeld aan deze klant.'); setSendingReminderId(null); return; }
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `Betalingsherinnering — Factuur ${invoice.invoice_number || ''}`,
      body: `Beste,\n\nWe stellen vast dat factuur ${invoice.invoice_number || ''} (${formatCurrency(invoice.total_amount || invoice.amount)}) nog niet ontvangen is.\n\nGelieve dit bedrag zo spoedig mogelijk te voldoen.\n\nMet vriendelijke groeten`,
    });
    toast.success(`Herinnering verstuurd naar ${email}`);
    setSendingReminderId(null);
  };

  const years = [2024, 2025, 2026, 2027];
  const showAll = filterMonth === 'all';
  const month = parseInt(filterMonth);
  const year = parseInt(filterYear);

  const { freelancerRows, permRows } = useMemo(() => {
    const buildRow = (placement, idx) => {
      const matchTs = (t) => t.placement_id === placement.id && t.year === year && (showAll || t.month === month);
      const matchInv = (i, type) => i.placement_id === placement.id && i.year === year && i.invoice_type === type && (showAll || i.month === month);

      const ts = timesheets.filter(matchTs)[0];
      const clientInvoice = invoices.filter(i => matchInv(i, 'client_invoice'))[0];
      const consultantInvoice = invoices.filter(i => matchInv(i, 'consultant_invoice'))[0];

      const isPerm = placement.placement_type === 'perm';
      const days = ts?.days_worked || 0;
      const clientRate = placement.client_rate || 0;
      const consultantRate = placement.consultant_rate || 0;
      const clientAmountExcl = isPerm ? (placement.perm_fee_amount || 0) : days * clientRate;
      const consultantAmountExcl = isPerm ? 0 : days * consultantRate;
      const marginExcl = clientAmountExcl - consultantAmountExcl;
      const clientTotal = clientInvoice?.total_amount || clientAmountExcl * VAT_RATE;
      const consultantTotal = consultantInvoice?.total_amount || consultantAmountExcl * VAT_RATE;

      return { idx, placement, ts, clientInvoice, consultantInvoice, days, clientRate, consultantRate, clientAmountExcl, consultantAmountExcl, marginExcl, clientTotal, consultantTotal, isPerm };
    };

    const freelancers = placements.filter(p => !p.placement_type || p.placement_type === 'freelancer').map((p, i) => buildRow(p, i + 1));
    const perms = placements.filter(p => p.placement_type === 'perm').map((p, i) => buildRow(p, i + 1));
    return { freelancerRows: freelancers, permRows: perms };
  }, [placements, timesheets, invoices, filterMonth, filterYear]);

  const vatMult = showVat ? 1 : (1 / VAT_RATE);
  const fmtVal = (excl) => formatCurrency(excl * (showVat ? VAT_RATE : 1));

  // Summary calculations (always excl BTW internally)
  const flExpected = freelancerRows.reduce((s, r) => s + r.clientAmountExcl, 0);
  const flReceived = freelancerRows.filter(r => r.clientInvoice?.status === 'paid').reduce((s, r) => s + r.clientAmountExcl, 0);
  const flOpen = flExpected - flReceived;
  const flMargin = freelancerRows.reduce((s, r) => s + r.marginExcl, 0);

  const pmExpected = permRows.reduce((s, r) => s + r.clientAmountExcl, 0);
  const pmReceived = permRows.filter(r => r.clientInvoice?.status === 'paid').reduce((s, r) => s + r.clientAmountExcl, 0);
  const pmOpen = pmExpected - pmReceived;

  const periodLabel = showAll ? `Heel ${year}` : `${getMonthName(month)} ${year}`;

  return (
    <div>
      <PageHeader title="Facturatie" subtitle={`Overzicht — ${periodLabel}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle maanden</SelectItem>
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowVat(v => !v)}
          >
            <Euro className="w-4 h-4" />
            {showVat ? 'Incl. BTW' : 'Excl. BTW'}
          </Button>
        </div>
        <Button variant="outline" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          onClick={() => alert('OkiOki koppeling vereist een Builder+ abonnement voor backend functies.')}>
          <ExternalLink className="w-4 h-4" /> OkiOki (Xerius)
        </Button>
      </PageHeader>

      {/* Summary bars */}
      <SummaryBar
        label={`Freelancers — ${periodLabel}`}
        expected={flExpected} received={flReceived} open={flOpen} margin={flMargin}
        showVat={showVat} vatRate={VAT_RATE}
      />
      <SummaryBar
        label={`PERM — ${periodLabel}`}
        expected={pmExpected} received={pmReceived} open={pmOpen}
        showVat={showVat} vatRate={VAT_RATE}
      />

      {/* ── FREELANCERS ── */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold">Freelancers — {periodLabel}</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">Freelancer</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{showVat ? 'Incl. BTW' : 'Excl. BTW'}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Consultant</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">BTW nr.</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Klant</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Contractduur</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Dagen</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Tarief</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground bg-blue-50">Van klant</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground bg-blue-50">Ref. / Status klant</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground bg-amber-50">Aan consultant</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground bg-amber-50">Ref. / Status cons.</th>
                  <th className="text-right py-3 px-3 font-medium text-muted-foreground">Marge</th>
                </tr>
              </thead>
              <tbody>
                {freelancerRows.map(row => {
                  const clientOverdue = row.clientInvoice ? isOverdue(row.clientInvoice) : false;
                  const consultantOverdue = row.consultantInvoice ? isOverdue(row.consultantInvoice) : false;
                  return (
                    <tr key={row.placement.id} className={`border-b border-border/50 transition-colors ${clientOverdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-muted/20'}`}>
                      <td className="py-3 px-3 text-muted-foreground">{row.idx}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</div>
                        {row.placement.consultant_company_name && <div className="text-xs text-muted-foreground">{row.placement.consultant_company_name}</div>}
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{row.placement.consultant_vat_number || '—'}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium">{row.placement.client_company_name}</div>
                        {row.placement.client_vat_number && <div className="text-xs text-muted-foreground">{row.placement.client_vat_number}</div>}
                      </td>
                      <td className="py-3 px-3"><ContractDuration placement={row.placement} /></td>
                      <td className="py-3 px-3 text-right">
                        {row.days > 0 ? <span className="font-semibold">{row.days}</span> : <span className="text-muted-foreground text-xs">geen TS</span>}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground text-xs">{formatCurrency(row.clientRate)}/dag</td>
                      <td className={`py-3 px-3 text-right bg-blue-50/50 font-semibold ${clientOverdue ? 'text-red-600' : ''}`}>
                        <div className="flex items-center justify-end gap-1">
                          {clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {fmtVal(row.clientAmountExcl)}
                        </div>
                      </td>
                      <td className="py-3 px-3 bg-blue-50/50">
                        <InvoiceRef invoice={row.clientInvoice} />
                        <StatusCell invoice={row.clientInvoice} hasTimesheet={!!row.ts} onMarkPaid={markPaid} onSendReminder={sendReminder} sendingReminder={sendingReminderId === row.clientInvoice?.id} showTimesheetStatus={true} />
                      </td>
                      <td className={`py-3 px-3 text-right bg-amber-50/50 font-semibold ${consultantOverdue ? 'text-red-600' : ''}`}>
                        <div className="flex items-center justify-end gap-1">
                          {consultantOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {fmtVal(row.consultantAmountExcl)}
                        </div>
                      </td>
                      <td className="py-3 px-3 bg-amber-50/50">
                        <InvoiceRef invoice={row.consultantInvoice} />
                        <StatusCell invoice={row.consultantInvoice} hasTimesheet={!!row.ts} onMarkPaid={markPaid} onSendReminder={sendReminder} sendingReminder={sendingReminderId === row.consultantInvoice?.id} showTimesheetStatus={false} />
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${row.marginExcl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmtVal(row.marginExcl)}
                        {row.days > 0 && <div className="text-xs font-normal text-muted-foreground">{formatCurrency(row.clientRate - row.consultantRate)}/dag</div>}
                      </td>
                    </tr>
                  );
                })}
                {freelancerRows.length === 0 && (
                  <tr><td colSpan={12} className="py-8 text-center text-muted-foreground text-sm">Geen freelancer placements</td></tr>
                )}
                {freelancerRows.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2">
                    <td colSpan={7} className="py-3 px-3 text-right text-muted-foreground text-xs">Totaal</td>
                    <td className="py-3 px-3 text-right bg-blue-50/70">{fmtVal(freelancerRows.reduce((s, r) => s + r.clientAmountExcl, 0))}</td>
                    <td className="bg-blue-50/70" />
                    <td className="py-3 px-3 text-right bg-amber-50/70">{fmtVal(freelancerRows.reduce((s, r) => s + r.consultantAmountExcl, 0))}</td>
                    <td className="bg-amber-50/70" />
                    <td className="py-3 px-3 text-right text-emerald-600">{fmtVal(flMargin)}</td>
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
            <span className="text-xs text-muted-foreground ml-auto">{showVat ? 'Incl. BTW' : 'Excl. BTW'}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Eenmalige fee = jaarloon × fee%</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kandidaat</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Klant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">BTW nr. klant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Startdatum</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Jaarloon</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Fee %</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground bg-blue-50">Fee aan klant</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground bg-blue-50">Ref. / Factuurstatus</th>
                </tr>
              </thead>
              <tbody>
                {permRows.map(row => {
                  const clientOverdue = row.clientInvoice ? isOverdue(row.clientInvoice) : false;
                  return (
                    <tr key={row.placement.id} className={`border-b border-border/50 transition-colors ${clientOverdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-muted/20'}`}>
                      <td className="py-3 px-4 text-muted-foreground">{row.idx}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</div>
                      </td>
                      <td className="py-3 px-4 font-medium">{row.placement.client_company_name}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{row.placement.client_vat_number || '—'}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(row.placement.start_date)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(row.placement.perm_annual_salary || 0)}</td>
                      <td className="py-3 px-4 text-right">{row.placement.perm_fee_percentage || 20}%</td>
                      <td className={`py-3 px-4 text-right bg-blue-50/50 font-semibold ${clientOverdue ? 'text-red-600' : ''}`}>
                        <div className="flex items-center justify-end gap-1">
                          {clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {fmtVal(row.clientAmountExcl)}
                        </div>
                      </td>
                      <td className="py-3 px-4 bg-blue-50/50">
                        <InvoiceRef invoice={row.clientInvoice} />
                        <StatusCell invoice={row.clientInvoice} hasTimesheet={false} onMarkPaid={markPaid} onSendReminder={sendReminder} sendingReminder={sendingReminderId === row.clientInvoice?.id} showTimesheetStatus={false} />
                      </td>
                    </tr>
                  );
                })}
                {permRows.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground text-sm">Geen PERM placements</td></tr>
                )}
                {permRows.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2">
                    <td colSpan={7} className="py-3 px-4 text-right text-muted-foreground text-xs">Totaal fees</td>
                    <td className="py-3 px-4 text-right bg-blue-50/70">{fmtVal(pmExpected)}</td>
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
            <p className="text-xs text-orange-700 mt-1">Directe API-koppeling voor automatisch aanmaken en versturen van facturen + referentienummers (+++xxx+++) beschikbaar via Builder+ abonnement.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}