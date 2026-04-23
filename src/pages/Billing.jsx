import React, { useState, useMemo } from 'react';
import ImportedBadge from '@/components/shared/ImportedBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle, ExternalLink, CheckCircle2, Clock, FileText,
  Mail, Loader2, TrendingUp, Euro, Search, ArrowUpDown, X, Upload, Paperclip
} from 'lucide-react';
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
  const totalMonths = Math.round(totalDays / 30);
  const elapsedMonths = Math.min(totalMonths, Math.round(elapsedDays / 30));
  const remainingMonths = Math.max(0, totalMonths - elapsedMonths);
  const remainingDays = Math.max(0, Math.round(totalDays - elapsedDays));
  return { totalMonths, elapsedMonths, remainingMonths, remainingDays };
}

function ContractDuration({ placement }) {
  const info = contractRemaining(placement.start_date, placement.end_date);
  if (!info) return (
    <div className="text-xs text-muted-foreground">
      {formatDate(placement.start_date)} → geen einddatum
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
      <div className={`font-medium ${isNearEnd ? 'text-red-600' : ''}`}>
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
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs w-fit">Geen factuur</Badge>
          {showTimesheetStatus && (
            <span className={`text-xs flex items-center gap-1 ${hasTimesheet ? 'text-primary' : 'text-amber-600'}`}>
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
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs w-fit">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Betaald
            </Badge>
          ) : invoice.status === 'sent' ? (
            <Badge variant="outline" className="bg-foreground/10 text-foreground border-foreground/20 text-xs w-fit">
              <FileText className="w-3 h-3 mr-1" /> Verstuurd
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs w-fit">Concept</Badge>
          )}
          {showTimesheetStatus && (
            <span className={`text-xs flex items-center gap-1 ${hasTimesheet ? 'text-primary' : 'text-amber-600'}`}>
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
            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 text-left" onClick={() => onSendReminder(invoice)} disabled={sendingReminder}>
              {sendingReminder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Herinnering sturen
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ReferenceReminder({ instructions }) {
  const [dismissed, setDismissed] = useState(false);
  if (!instructions || dismissed) return null;
  return (
    <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 mb-1">
      <span className="text-sm leading-none flex-shrink-0">⚠️</span>
      <span className="flex-1"><strong>Referentie-instructie:</strong> {instructions}</span>
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 flex-shrink-0 font-bold">✕</button>
    </div>
  );
}

function InvoiceRef({ invoice }) {
  if (!invoice?.invoice_number) return <span className="text-xs text-muted-foreground">—</span>;
  return <div className="text-xs font-mono text-muted-foreground">{invoice.invoice_number}</div>;
}

function SummaryBar({ label, expected, received, open, margin, showVat }) {
  const mult = showVat ? VAT_RATE : 1;
  const f = (v) => formatCurrency(v * mult);
  const pct = expected > 0 ? Math.min(100, (received / expected) * 100) : 0;
  return (
    <Card className="mb-4 border-border">
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
              <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Al ontvangen</p>
            <p className="text-lg font-bold text-primary">{f(received)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Openstaand</p>
            <p className="text-lg font-bold">{f(open)}</p>
          </div>
          {margin !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Marge</p>
              <p className={`text-lg font-bold ${margin >= 0 ? 'text-primary' : 'text-red-500'}`}>{f(margin)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterBar({ search, setSearch, statusFilter, setStatusFilter, sortBy, setSortBy, onReset, showSort = true }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/40 rounded-lg border border-border">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Zoek op klant of consultant..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Betaalstatus" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statussen</SelectItem>
          <SelectItem value="paid">Betaald</SelectItem>
          <SelectItem value="sent">Verstuurd</SelectItem>
          <SelectItem value="overdue">Achterstallig</SelectItem>
          <SelectItem value="no_invoice">Geen factuur</SelectItem>
        </SelectContent>
      </Select>
      {showSort && (
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48 h-8 text-xs gap-1"><ArrowUpDown className="w-3.5 h-3.5" /><SelectValue placeholder="Sorteren op" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Standaard</SelectItem>
            <SelectItem value="revenue_desc">Hoogste omzet eerst</SelectItem>
            <SelectItem value="revenue_asc">Laagste omzet eerst</SelectItem>
            <SelectItem value="margin_desc">Hoogste marge eerst</SelectItem>
            <SelectItem value="margin_asc">Laagste marge eerst</SelectItem>
            <SelectItem value="date_asc">Startdatum (vroegste)</SelectItem>
            <SelectItem value="date_desc">Startdatum (nieuwste)</SelectItem>
          </SelectContent>
        </Select>
      )}
      {(search || statusFilter !== 'all' || sortBy !== 'default') && (
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onReset}>
          <X className="w-3.5 h-3.5 mr-1" /> Reset
        </Button>
      )}
    </div>
  );
}

export default function Billing() {
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [showVat, setShowVat] = useState(true);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState(null);

  // Freelancer filters
  const [flSearch, setFlSearch] = useState('');
  const [flStatus, setFlStatus] = useState('all');
  const [flSort, setFlSort] = useState('default');

  // PERM filters
  const [pmSearch, setPmSearch] = useState('');
  const [pmStatus, setPmStatus] = useState('all');
  const [pmSort, setPmSort] = useState('default');

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

  const buildRow = (placement, idx) => {
    const matchTs = (t) => t.placement_id === placement.id && t.year === year && (showAll || t.month === month);
    const matchInv = (i, type) => i.placement_id === placement.id && i.year === year && i.invoice_type === type && (showAll || i.month === month);
    const ts = timesheets.filter(matchTs)[0];
    const clientInvoice = invoices.filter(i => matchInv(i, 'client_invoice'))[0];
    const consultantInvoice = invoices.filter(i => matchInv(i, 'consultant_invoice'))[0];
    const isPerm = placement.placement_type === 'perm';
    const clientRate = placement.client_rate || 0;
    const consultantRate = placement.consultant_rate || 0;

    let days, isEstimated;
    if (ts) {
      days = ts.days_worked || 0;
      isEstimated = false;
    } else {
      // Estimate based on days_per_week: ~21 working days/month for 5/5
      const dpw = placement.days_per_week || 5;
      days = Math.round((dpw / 5) * 21 * 10) / 10;
      isEstimated = true;
    }

    const clientAmountExcl = isPerm ? (placement.perm_fee_amount || 0) : days * clientRate;
    const consultantAmountExcl = isPerm ? 0 : days * consultantRate;
    const marginExcl = clientAmountExcl - consultantAmountExcl;
    return { idx, placement, ts, clientInvoice, consultantInvoice, days, isEstimated, clientRate, consultantRate, clientAmountExcl, consultantAmountExcl, marginExcl, isPerm };
  };

  const applyFilters = (rows, search, statusFilter, sortBy) => {
    let filtered = rows;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.placement.client_company_name?.toLowerCase().includes(q) ||
        `${r.placement.consultant_first_name} ${r.placement.consultant_last_name}`.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => {
        const inv = r.clientInvoice;
        if (statusFilter === 'no_invoice') return !inv;
        if (statusFilter === 'overdue') return inv && isOverdue(inv);
        if (statusFilter === 'paid') return inv?.status === 'paid';
        if (statusFilter === 'sent') return inv?.status === 'sent' && !isOverdue(inv);
        return true;
      });
    }
    if (sortBy !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        if (sortBy === 'revenue_desc') return b.clientAmountExcl - a.clientAmountExcl;
        if (sortBy === 'revenue_asc') return a.clientAmountExcl - b.clientAmountExcl;
        if (sortBy === 'margin_desc') return b.marginExcl - a.marginExcl;
        if (sortBy === 'margin_asc') return a.marginExcl - b.marginExcl;
        if (sortBy === 'date_asc') return new Date(a.placement.start_date || 0) - new Date(b.placement.start_date || 0);
        if (sortBy === 'date_desc') return new Date(b.placement.start_date || 0) - new Date(a.placement.start_date || 0);
        return 0;
      });
    }
    return filtered;
  };

  const { freelancerRows, permRows } = useMemo(() => {
    const freelancers = placements.filter(p => !p.placement_type || p.placement_type === 'freelancer').map((p, i) => buildRow(p, i + 1));
    const perms = placements.filter(p => p.placement_type === 'perm').map((p, i) => buildRow(p, i + 1));
    return { freelancerRows: freelancers, permRows: perms };
  }, [placements, timesheets, invoices, filterMonth, filterYear]);

  const filteredFl = useMemo(() => applyFilters(freelancerRows, flSearch, flStatus, flSort), [freelancerRows, flSearch, flStatus, flSort]);
  const filteredPm = useMemo(() => applyFilters(permRows, pmSearch, pmStatus, pmSort), [permRows, pmSearch, pmStatus, pmSort]);

  const fmtVal = (excl) => formatCurrency(excl * (showVat ? VAT_RATE : 1));

  // Summary always over all rows (unfiltered) for accurate totals
  const flExpected = freelancerRows.reduce((s, r) => s + r.clientAmountExcl, 0);
  const flReceived = freelancerRows.filter(r => r.clientInvoice?.status === 'paid').reduce((s, r) => s + r.clientAmountExcl, 0);
  const flMargin = freelancerRows.reduce((s, r) => s + r.marginExcl, 0);

  const pmExpected = permRows.reduce((s, r) => s + r.clientAmountExcl, 0);
  const pmReceived = permRows.filter(r => r.clientInvoice?.status === 'paid').reduce((s, r) => s + r.clientAmountExcl, 0);

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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowVat(v => !v)}>
            <Euro className="w-4 h-4" />
            {showVat ? 'Incl. BTW' : 'Excl. BTW'}
          </Button>
        </div>
        <Button variant="outline" className="gap-2 border-border text-foreground/70 hover:bg-muted"
          onClick={() => alert('OkiOki koppeling vereist een Builder+ abonnement voor backend functies.')}>
          <ExternalLink className="w-4 h-4" /> OkiOki (Xerius)
        </Button>
      </PageHeader>

      {/* Summary bars */}
      <SummaryBar label={`Freelancers — ${periodLabel}`} expected={flExpected} received={flReceived} open={flExpected - flReceived} margin={flMargin} showVat={showVat} />
      <SummaryBar label={`PERM — ${periodLabel}`} expected={pmExpected} received={pmReceived} open={pmExpected - pmReceived} showVat={showVat} />

      {/* ── FREELANCERS ── */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3 mb-2">
            <CardTitle className="text-base font-semibold">Freelancers — {periodLabel}</CardTitle>
            <Badge className="bg-primary/10 text-primary border-primary/20">Freelancer</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{showVat ? 'Incl. BTW' : 'Excl. BTW'}</span>
          </div>
          <FilterBar
            search={flSearch} setSearch={setFlSearch}
            statusFilter={flStatus} setStatusFilter={setFlStatus}
            sortBy={flSort} setSortBy={setFlSort}
            onReset={() => { setFlSearch(''); setFlStatus('all'); setFlSort('default'); }}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-bold text-foreground">#</th>
                  <th className="text-left py-3 px-3 font-normal text-foreground">Consultant</th>
                  <th className="text-left py-3 px-3 font-bold text-foreground">BTW nr.</th>
                  <th className="text-left py-3 px-3 font-normal text-foreground">Klant</th>
                  <th className="text-left py-3 px-3 font-bold text-foreground">Contractduur</th>
                  <th className="text-right py-3 px-3 font-normal text-foreground">Dagen</th>
                  <th className="text-right py-3 px-3 font-bold text-foreground">Tarief</th>
                  <th className="text-right py-3 px-3 font-normal text-white bg-primary">Bill</th>
                    <th className="text-left py-3 px-3 font-bold text-white bg-primary">Factuur klant</th>
                  <th className="text-right py-3 px-3 font-normal text-white bg-foreground">Pay</th>
                    <th className="text-left py-3 px-3 font-bold text-white bg-foreground">Factuur consultant</th>
                  <th className="text-right py-3 px-3 font-normal text-foreground">Marge</th>
                </tr>
              </thead>
              <tbody>
                {filteredFl.map(row => {
                  const clientOverdue = row.clientInvoice ? isOverdue(row.clientInvoice) : false;
                  const consultantOverdue = row.consultantInvoice ? isOverdue(row.consultantInvoice) : false;
                  return (
                    <tr key={row.placement.id} className={`border-b border-border/50 transition-colors ${clientOverdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-muted/20'}`}>
                      <td className="py-3 px-3 font-bold text-foreground">{row.idx}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-normal text-foreground">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</span>
                          {row.placement.notes?.includes('Geïmporteerd vanuit Actuals Excel') && <ImportedBadge />}
                        </div>
                        {row.placement.consultant_company_name && <div className="text-xs text-muted-foreground">{row.placement.consultant_company_name}</div>}
                      </td>
                      <td className="py-3 px-3 text-xs font-bold text-foreground">{row.placement.consultant_vat_number || '—'}</td>
                      <td className="py-3 px-3">
                        <div className="font-normal text-foreground">{row.placement.client_company_name}</div>
                        {row.placement.client_vat_number && <div className="text-xs text-muted-foreground">{row.placement.client_vat_number}</div>}
                      </td>
                      <td className="py-3 px-3 font-bold"><ContractDuration placement={row.placement} /></td>
                      <td className="py-3 px-3 text-right">
                        {row.ts
                          ? <span className="font-normal text-foreground">{row.days}</span>
                          : <span className="text-amber-600 text-xs" title="Schatting op basis van days_per_week">{row.days}~</span>
                        }
                      </td>
                      <td className="py-3 px-3 text-right text-xs font-bold text-foreground">
                        <div>{formatCurrency(row.clientRate)}/dag</div>
                        <div className="text-muted-foreground font-normal">cons: {formatCurrency(row.consultantRate)}/dag</div>
                      </td>
                      <td className={`py-3 px-3 text-right bg-primary/10 font-bold ${clientOverdue ? 'text-red-600' : 'text-primary'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {fmtVal(row.clientAmountExcl)}
                        </div>
                      </td>
                      <td className="py-3 px-3 bg-primary/10">
                       <ReferenceReminder instructions={row.placement?.reference_instructions} />
                       <InvoiceRef invoice={row.clientInvoice} />
                       <StatusCell invoice={row.clientInvoice} hasTimesheet={!!row.ts} onMarkPaid={markPaid} onSendReminder={sendReminder} sendingReminder={sendingReminderId === row.clientInvoice?.id} showTimesheetStatus={false} />
                       {row.clientInvoice?.file_url && (
                         <a href={row.clientInvoice.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                           <Paperclip className="w-3 h-3" /> Factuur bekijken
                         </a>
                       )}
                      </td>
                      <td className={`py-3 px-3 text-right bg-foreground/8 font-bold border-l border-foreground/10 ${consultantOverdue ? 'text-red-600' : 'text-foreground'}`} style={{backgroundColor: 'rgba(0,0,0,0.06)'}}>
                        <div className="flex items-center justify-end gap-1">
                          {consultantOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {fmtVal(row.consultantAmountExcl)}
                        </div>
                      </td>
                      <td className="py-3 px-3 border-r border-foreground/10" style={{backgroundColor: 'rgba(0,0,0,0.06)'}}>
                        <div className="flex flex-col gap-1">
                          {/* Betaalstatus consultant */}
                          {row.consultantInvoice ? (
                            <button
                              onClick={() => {
                                const newStatus = row.consultantInvoice.status === 'paid' ? 'sent' : 'paid';
                                updateInvoiceMutation.mutate({
                                  id: row.consultantInvoice.id,
                                  data: { ...row.consultantInvoice, status: newStatus, paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null }
                                });
                              }}
                              className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border transition-colors w-fit ${
                                row.consultantInvoice.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{row.consultantInvoice.status === 'paid' ? '✓' : '○'}</span>
                              <span>{row.consultantInvoice.status === 'paid' ? 'Betaald' : 'Onbetaald'}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {/* Bestand */}
                          {row.consultantInvoice?.file_url && (
                            <a href={row.consultantInvoice.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Paperclip className="w-3 h-3" /> Bekijken
                            </a>
                          )}
                          <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            {uploadingInvoiceId === (row.consultantInvoice?.id || `cons-${row.placement.id}`) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Upload className="w-3 h-3" />
                            )}
                            {row.consultantInvoice?.file_url ? 'Vervangen' : 'Uploaden'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.png,.docx"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const tempId = row.consultantInvoice?.id || `cons-${row.placement.id}`;
                                setUploadingInvoiceId(tempId);
                                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                if (row.consultantInvoice?.id) {
                                  await base44.entities.Invoice.update(row.consultantInvoice.id, { file_url });
                                } else {
                                  toast.error('Geen factuurrecord gevonden. Maak eerst een factuurrecord aan.');
                                  setUploadingInvoiceId(null);
                                  return;
                                }
                                queryClient.invalidateQueries({ queryKey: ['invoices'] });
                                toast.success('Factuur opgeslagen');
                                setUploadingInvoiceId(null);
                              }}
                            />
                          </label>
                        </div>
                      </td>
                      <td className={`py-3 px-3 text-right font-normal ${row.marginExcl >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {fmtVal(row.marginExcl)}
                        {row.days > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(row.clientRate - row.consultantRate)}/dag</div>}
                      </td>
                    </tr>
                  );
                })}
                {filteredFl.length === 0 && (
                  <tr><td colSpan={12} className="py-8 text-center text-muted-foreground text-sm">Geen resultaten gevonden</td></tr>
                )}
                {filteredFl.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2">
                    <td colSpan={7} className="py-3 px-3 text-right text-xs text-muted-foreground font-bold">Totaal (gefilterd)</td>
                    <td className="py-3 px-3 text-right bg-primary/10 font-bold text-primary">{fmtVal(filteredFl.reduce((s, r) => s + r.clientAmountExcl, 0))}</td>
                    <td className="bg-primary/10" />
                    <td className="py-3 px-3 text-right font-bold" style={{backgroundColor:'rgba(0,0,0,0.06)'}}>{fmtVal(filteredFl.reduce((s, r) => s + r.consultantAmountExcl, 0))}</td>
                    <td className="py-3 px-3 text-right text-primary">{fmtVal(filteredFl.reduce((s, r) => s + r.marginExcl, 0))}</td>
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
          <div className="flex items-center gap-3 mb-2">
            <CardTitle className="text-base font-semibold">PERM — Vaste aanwervingen</CardTitle>
            <Badge className="bg-foreground/10 text-foreground border-foreground/20">PERM</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{showVat ? 'Incl. BTW' : 'Excl. BTW'}</span>
          </div>
          <FilterBar
            search={pmSearch} setSearch={setPmSearch}
            statusFilter={pmStatus} setStatusFilter={setPmStatus}
            sortBy={pmSort} setSortBy={setPmSort}
            onReset={() => { setPmSearch(''); setPmStatus('all'); setPmSort('default'); }}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-bold text-foreground">#</th>
                  <th className="text-left py-3 px-4 font-normal text-foreground">Kandidaat</th>
                  <th className="text-left py-3 px-4 font-bold text-foreground">Klant</th>
                  <th className="text-left py-3 px-4 font-normal text-foreground">BTW nr. klant</th>
                  <th className="text-left py-3 px-4 font-bold text-foreground">Startdatum</th>
                  <th className="text-right py-3 px-4 font-normal text-foreground">Jaarloon</th>
                  <th className="text-right py-3 px-4 font-bold text-foreground">Fee %</th>
                  <th className="text-right py-3 px-4 font-normal text-white bg-primary">Fee aan klant</th>
                  <th className="text-left py-3 px-4 font-bold text-white bg-primary">Ref. klant</th>
                </tr>
              </thead>
              <tbody>
                {filteredPm.map(row => {
                  const clientOverdue = row.clientInvoice ? isOverdue(row.clientInvoice) : false;
                  return (
                    <tr key={row.placement.id} className={`border-b border-border/50 transition-colors ${clientOverdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-muted/20'}`}>
                      <td className="py-3 px-4 font-bold text-foreground">{row.idx}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-normal text-foreground">{row.placement.consultant_first_name} {row.placement.consultant_last_name}</span>
                          {row.placement.notes?.includes('Geïmporteerd vanuit Actuals Excel') && <ImportedBadge />}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">{row.placement.client_company_name}</td>
                      <td className="py-3 px-4 text-xs font-normal text-muted-foreground">{row.placement.client_vat_number || '—'}</td>
                      <td className="py-3 px-4 text-xs font-bold text-foreground">{formatDate(row.placement.start_date)}</td>
                      <td className="py-3 px-4 text-right font-normal text-muted-foreground">{formatCurrency(row.placement.perm_annual_salary || 0)}</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">{row.placement.perm_fee_percentage || 20}%</td>
                      <td className={`py-3 px-4 text-right bg-primary/10 font-bold ${clientOverdue ? 'text-red-600' : 'text-primary'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {clientOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          {fmtVal(row.clientAmountExcl)}
                        </div>
                      </td>
                      <td className="py-3 px-4 bg-primary/10">
                        <InvoiceRef invoice={row.clientInvoice} />
                        <StatusCell invoice={row.clientInvoice} hasTimesheet={false} onMarkPaid={markPaid} onSendReminder={sendReminder} sendingReminder={sendingReminderId === row.clientInvoice?.id} showTimesheetStatus={false} />
                      </td>
                    </tr>
                  );
                })}
                {filteredPm.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground text-sm">Geen resultaten gevonden</td></tr>
                )}
                {filteredPm.length > 0 && (
                  <tr className="bg-muted/40 font-semibold border-t-2">
                    <td colSpan={7} className="py-3 px-4 text-right text-xs font-bold text-muted-foreground">Totaal fees (gefilterd)</td>
                    <td className="py-3 px-4 text-right bg-primary/10 font-bold text-primary">{fmtVal(filteredPm.reduce((s, r) => s + r.clientAmountExcl, 0))}</td>
                    <td className="bg-primary/10" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">OkiOki (Xerius) koppeling</p>
            <p className="text-xs text-muted-foreground mt-1">Directe API-koppeling voor automatisch aanmaken en versturen van facturen + referentienummers (+++xxx+++) beschikbaar via Builder+ abonnement.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}