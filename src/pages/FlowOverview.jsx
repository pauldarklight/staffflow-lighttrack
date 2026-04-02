import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CheckCircle2, Clock, AlertTriangle, Circle, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatDate, formatCurrency, getMonthName } from '@/lib/formatters';
import { Link } from 'react-router-dom';

function StepIcon({ status }) {
  if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  if (status === 'missing') return <Circle className="w-4 h-4 text-muted-foreground" />;
  return <Clock className="w-4 h-4 text-blue-500" />;
}

function StepBadge({ label, status, detail }) {
  const colors = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    missing: 'bg-muted text-muted-foreground border-border',
    pending: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${colors[status] || colors.missing}`}>
      <StepIcon status={status} />
      <span className="font-medium">{label}</span>
      {detail && <span className="opacity-70">· {detail}</span>}
    </div>
  );
}

export default function FlowOverview() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [contractStatusFilter, setContractStatusFilter] = useState('all');
  const [contractMonthFilter, setContractMonthFilter] = useState('all');
  const [tsMonthFilter, setTsMonthFilter] = useState('all');
  const [invMonthFilter, setInvMonthFilter] = useState('all');

  const { data: placements = [] } = useQuery({ queryKey: ['placements'], queryFn: () => base44.entities.Placement.list('-created_date') });
  const { data: contracts = [] } = useQuery({ queryKey: ['contracts'], queryFn: () => base44.entities.Contract.list() });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });

  const flows = useMemo(() => placements.map(p => {
    const pContracts = contracts.filter(c => c.placement_id === p.id);
    const clientContract = pContracts.find(c => c.contract_type === 'client');
    const consultantContract = pContracts.find(c => c.contract_type === 'consultant');

    const pTimesheets = timesheets.filter(t => t.placement_id === p.id);
    const pInvoices = invoices.filter(i => i.placement_id === p.id);

    // Determine step statuses
    const contractStatus = !clientContract && !consultantContract ? 'missing'
      : (!clientContract || !consultantContract) ? 'warn'
      : (clientContract.status === 'signed' && consultantContract.status === 'signed') ? 'ok'
      : 'pending';

    const approvedTS = pTimesheets.filter(t => t.status === 'approved');
    const pendingTS = pTimesheets.filter(t => t.status === 'submitted');
    const timesheetStatus = pTimesheets.length === 0 ? 'missing'
      : pendingTS.length > 0 ? 'warn'
      : approvedTS.length > 0 ? 'ok'
      : 'pending';

    const clientInvoices = pInvoices.filter(i => i.invoice_type === 'client_invoice');
    const invoiceStatus = clientInvoices.length === 0 && approvedTS.length > 0 ? 'warn'
      : clientInvoices.some(i => i.status === 'paid') ? 'ok'
      : clientInvoices.length > 0 ? 'pending'
      : 'missing';

    // Overall health
    const isImported = p.notes?.includes('Geïmporteerd vanuit Actuals Excel');
    const health = isImported ? 'ok'
      : contractStatus === 'missing' || (timesheetStatus === 'warn') ? 'warn'
      : contractStatus === 'ok' && invoiceStatus === 'ok' ? 'ok'
      : 'pending';

    return { placement: p, clientContract, consultantContract, pTimesheets, pInvoices, clientInvoices, contractStatus, timesheetStatus, invoiceStatus, health, approvedTS };
  }), [placements, contracts, timesheets, invoices]);

  const filtered = useMemo(() => {
    let rows = flows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(f =>
        `${f.placement.consultant_first_name} ${f.placement.consultant_last_name}`.toLowerCase().includes(q) ||
        (f.placement.client_company_name || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') rows = rows.filter(f => f.health === statusFilter);
    return rows;
  }, [flows, search, statusFilter]);

  const stats = {
    total: flows.length,
    ok: flows.filter(f => f.health === 'ok').length,
    warn: flows.filter(f => f.health === 'warn').length,
    pending: flows.filter(f => f.health === 'pending').length,
  };

  // Contracts section
  const contractRows = useMemo(() => {
    return flows.map(f => ({
      p: f.placement,
      clientContract: f.clientContract,
      consultantContract: f.consultantContract,
      status: f.contractStatus,
    })).filter(row => {
      if (contractStatusFilter !== 'all' && row.status !== contractStatusFilter) return false;
      if (contractMonthFilter !== 'all') {
        const yr = parseInt(periodYear);
        const mo = parseInt(contractMonthFilter);
        const rowDate = new Date(yr, mo - 1, 1);
        const startDate = row.p.start_date ? new Date(row.p.start_date) : null;
        const endDate = row.p.end_date ? new Date(row.p.end_date) : null;
        if (startDate && rowDate < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) return false;
        if (endDate && rowDate > new Date(endDate.getFullYear(), endDate.getMonth(), 1)) return false;
      }
      return true;
    });
  }, [flows, contractStatusFilter, contractMonthFilter, periodYear]);

  // Timesheets section
  const tsRows = useMemo(() => {
    const yr = parseInt(periodYear);
    const months = tsMonthFilter === 'all' ? Array.from({length:12},(_,i)=>i+1) : [parseInt(tsMonthFilter)];
    const rows = [];
    placements.forEach(p => {
      months.forEach(m => {
        const startDate = p.start_date ? new Date(p.start_date) : null;
        const rowDate = new Date(yr, m - 1, 1);
        if (startDate && rowDate < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) return;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        if (endDate && rowDate > new Date(endDate.getFullYear(), endDate.getMonth(), 1)) return;
        const ts = timesheets.find(t => t.placement_id === p.id && t.year === yr && t.month === m);
        rows.push({ p, m, yr, ts });
      });
    });
    return rows;
  }, [placements, timesheets, periodYear, tsMonthFilter]);

  // Invoices section
  const invRows = useMemo(() => {
    const yr = parseInt(periodYear);
    const months = invMonthFilter === 'all' ? Array.from({length:12},(_,i)=>i+1) : [parseInt(invMonthFilter)];
    const rows = [];
    placements.forEach(p => {
      months.forEach(m => {
        const startDate = p.start_date ? new Date(p.start_date) : null;
        const rowDate = new Date(yr, m - 1, 1);
        if (startDate && rowDate < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) return;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        if (endDate && rowDate > new Date(endDate.getFullYear(), endDate.getMonth(), 1)) return;
        const clientInv = invoices.find(i => i.placement_id === p.id && i.year === yr && i.month === m && i.invoice_type === 'client_invoice');
        const consInv = invoices.find(i => i.placement_id === p.id && i.year === yr && i.month === m && i.invoice_type === 'consultant_invoice');
        rows.push({ p, m, yr, clientInv, consInv });
      });
    });
    return rows;
  }, [placements, invoices, periodYear, invMonthFilter]);

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  function CellStatus({ val, type }) {
    if (!val) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Circle className="w-3 h-3" /> —</span>;
    const statusColors = {
      approved: 'text-emerald-600', signed: 'text-emerald-600', paid: 'text-emerald-600',
      submitted: 'text-blue-600', sent: 'text-blue-600',
      requested: 'text-amber-600', draft: 'text-amber-600',
      rejected: 'text-red-600', overdue: 'text-red-600',
    };
    const color = statusColors[val.status] || 'text-foreground';
    const Icon = ['approved','signed','paid'].includes(val.status) ? CheckCircle2 : ['submitted','sent'].includes(val.status) ? Clock : AlertTriangle;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {val.status}
        {type === 'ts' && val.days_worked ? <span className="text-muted-foreground font-normal">· {val.days_worked}d</span> : null}
        {(type === 'cinv' || type === 'xinv') && val.amount ? <span className="text-muted-foreground font-normal">· {formatCurrency(val.amount)}</span> : null}
      </span>
    );
  }

  function ContractCell({ cc, xc }) {
    if (!cc && !xc) return <span className="text-xs text-red-500 font-medium">Ontbreekt</span>;
    const both = cc && xc;
    const allSigned = (!cc || cc.status === 'signed') && (!xc || xc.status === 'signed');
    const color = allSigned ? 'text-emerald-600' : 'text-amber-600';
    const Icon = allSigned ? CheckCircle2 : Clock;
    return <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}><Icon className="w-3 h-3" />{both ? 'K+C' : cc ? 'Klant' : 'Cons.'} · {allSigned ? 'getekend' : 'concept/verstuurd'}</span>;
  }

  return (
    <div>
      <PageHeader title="Flow Overzicht" subtitle="Geautomatiseerde pipeline: Placement → Contracten → Timesheets → Facturen" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Totaal', value: stats.total, color: 'text-foreground' },
          { label: 'Volledig OK', value: stats.ok, color: 'text-emerald-600' },
          { label: 'Actie vereist', value: stats.warn, color: 'text-amber-600' },
          { label: 'In behandeling', value: stats.pending, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList className="mb-4">
          <TabsTrigger value="pipeline">🔗 Pipeline</TabsTrigger>
          <TabsTrigger value="contracten">📄 Contracten</TabsTrigger>
          <TabsTrigger value="timesheets">🗓️ Timesheets</TabsTrigger>
          <TabsTrigger value="facturen">🧳 Facturen</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Pipeline ── */}
        <TabsContent value="pipeline">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Zoek op consultant of klant..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle placements</SelectItem>
                <SelectItem value="ok">✅ Volledig OK</SelectItem>
                <SelectItem value="warn">⚠️ Actie vereist</SelectItem>
                <SelectItem value="pending">🕐 In behandeling</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                <X className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {filtered.map(f => {
              const p = f.placement;
              const isOpen = expanded[p.id];
              const isImported = p.notes?.includes('Geïmporteerd vanuit Actuals Excel');

              // Contract badge
              const contractBadgeColor = f.contractStatus === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : f.contractStatus === 'missing' ? 'bg-red-50 text-red-600 border-red-200'
                : f.contractStatus === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-600 border-blue-200';
              const contractLabel = f.contractStatus === 'ok' ? 'Getekend'
                : f.contractStatus === 'missing' ? 'Ontbreekt'
                : f.contractStatus === 'warn' ? 'Deels'
                : 'Concept/Verstuurd';
              const ContractIcon = f.contractStatus === 'ok' ? CheckCircle2 : f.contractStatus === 'missing' ? AlertTriangle : Clock;

              const tsBadgeColor = f.timesheetStatus === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : f.timesheetStatus === 'missing' ? 'bg-red-50 text-red-600 border-red-200'
                : f.timesheetStatus === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-600 border-blue-200';
              const TsIcon = f.timesheetStatus === 'ok' ? CheckCircle2 : f.timesheetStatus === 'missing' ? AlertTriangle : Clock;

              const invBadgeColor = f.invoiceStatus === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : f.invoiceStatus === 'missing' ? 'bg-red-50 text-red-600 border-red-200'
                : f.invoiceStatus === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-600 border-blue-200';
              const InvIcon = f.invoiceStatus === 'ok' ? CheckCircle2 : f.invoiceStatus === 'missing' ? AlertTriangle : Clock;

              // Period rows for expanded view
              const placementTimesheets = f.pTimesheets.sort((a,b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
              const allMonths = [...new Set([
                ...f.pTimesheets.map(t => `${t.year}-${t.month}`),
                ...f.pInvoices.map(i => `${i.year}-${i.month}`),
              ])].sort().map(key => {
                const [yr, mo] = key.split('-').map(Number);
                return { yr, mo };
              });

              return (
                <Card key={p.id} className={`overflow-hidden transition-all border ${
                  f.health === 'warn' ? 'border-amber-200' : f.health === 'ok' ? 'border-border' : 'border-border'
                }`}>
                  {/* Main row */}
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      f.health === 'ok' ? 'bg-emerald-500' : f.health === 'warn' ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />

                    {/* Samenwerking */}
                    <div className="min-w-[180px] flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                        {p.consultant_first_name} {p.consultant_last_name}
                        {isImported && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Geïmporteerd
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.client_company_name}</div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-1.5 flex-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5 ${contractBadgeColor}`}>
                        <ContractIcon className="w-3 h-3" /> Contracten · {contractLabel}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5 ${tsBadgeColor}`}>
                        <TsIcon className="w-3 h-3" /> Timesheets · {f.pTimesheets.length} totaal · {f.approvedTS.length} goedgekeurd
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5 ${invBadgeColor}`}>
                        <InvIcon className="w-3 h-3" /> Facturen · {f.clientInvoices.length} facturen
                      </span>
                    </div>

                    {/* Date range + expand */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(p.start_date)} → {p.end_date ? formatDate(p.end_date) : '∞'}
                      </span>
                      <button
                        onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}
                        className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: per-period breakdown */}
                  {isOpen && (
                    <div className="border-t border-border bg-muted/10">
                      {allMonths.length === 0 ? (
                        <div className="px-6 py-4 text-xs text-muted-foreground">Geen periodedata beschikbaar.</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30">
                              <th className="text-left py-2 px-6 font-semibold text-muted-foreground">Periode</th>
                              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Timesheet</th>
                              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Factuur Klant</th>
                              <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Factuur Consultant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allMonths.map(({ yr, mo }) => {
                              const ts = f.pTimesheets.find(t => t.year === yr && t.month === mo);
                              const cInv = f.pInvoices.find(i => i.year === yr && i.month === mo && i.invoice_type === 'client_invoice');
                              const xInv = f.pInvoices.find(i => i.year === yr && i.month === mo && i.invoice_type === 'consultant_invoice');
                              const allOk = ts?.status === 'approved' && cInv && xInv;
                              return (
                                <tr key={`${yr}-${mo}`} className={`border-b border-border/40 ${
                                  allOk ? 'bg-emerald-50/30' : !ts ? 'bg-amber-50/20' : ''
                                }`}>
                                  <td className="py-2 px-6 font-semibold text-foreground whitespace-nowrap">{getMonthName(mo)} {yr}</td>
                                  <td className="py-2 px-3"><CellStatus val={ts} type="ts" /></td>
                                  <td className="py-2 px-3"><CellStatus val={cInv} type="cinv" /></td>
                                  <td className="py-2 px-3"><CellStatus val={xInv} type="xinv" /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Geen placements gevonden</div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 2: Contracten ── */}
        <TabsContent value="contracten">
          <div className="flex items-center gap-3 mb-6 p-3 bg-muted/40 rounded-lg border border-border flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Jaar:</span>
            <Select value={periodYear} onValueChange={setPeriodYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs font-medium text-muted-foreground">Maand:</span>
            <Select value={contractMonthFilter} onValueChange={setContractMonthFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle maanden</SelectItem>
                {Array.from({length:12},(_,i) => <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="ok">Getekend</SelectItem>
                <SelectItem value="pending">Concept / Verstuurd</SelectItem>
                <SelectItem value="warn">Deels</SelectItem>
                <SelectItem value="missing">Ontbreekt</SelectItem>
              </SelectContent>
            </Select>
            {(contractStatusFilter !== 'all' || contractMonthFilter !== 'all') && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setContractStatusFilter('all'); setContractMonthFilter('all'); }}><X className="w-3.5 h-3.5 mr-1" /> Reset</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{contractRows.length} rijen</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Consultant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Klant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Contract Klant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Contract Consultant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Geen data</td></tr>}
                    {contractRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="py-2 px-4 font-medium whitespace-nowrap">{row.p.consultant_first_name} {row.p.consultant_last_name}</td>
                        <td className="py-2 px-4 whitespace-nowrap">{row.p.client_company_name}</td>
                        <td className="py-2 px-4">{row.clientContract ? <CellStatus val={row.clientContract} type="contract" /> : <span className="text-xs text-red-500 font-medium">Ontbreekt</span>}</td>
                        <td className="py-2 px-4">{row.consultantContract ? <CellStatus val={row.consultantContract} type="contract" /> : <span className="text-xs text-red-500 font-medium">Ontbreekt</span>}</td>
                        <td className="py-2 px-4"><ContractCell cc={row.clientContract} xc={row.consultantContract} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: Timesheets ── */}
        <TabsContent value="timesheets">
          <div className="flex items-center gap-3 mb-6 p-3 bg-muted/40 rounded-lg border border-border flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Jaar:</span>
            <Select value={periodYear} onValueChange={setPeriodYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs font-medium text-muted-foreground">Maand:</span>
            <Select value={tsMonthFilter} onValueChange={setTsMonthFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle maanden</SelectItem>
                {Array.from({length:12},(_,i) => <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>)}
              </SelectContent>
            </Select>
            {tsMonthFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setTsMonthFilter('all')}><X className="w-3.5 h-3.5 mr-1" /> Reset</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{tsRows.length} rijen</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Periode</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Consultant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Klant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Timesheet</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Dagen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tsRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Geen data</td></tr>}
                    {tsRows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-border/50 hover:bg-muted/20 ${!row.ts ? 'bg-amber-50/30' : row.ts.status === 'approved' ? 'bg-emerald-50/20' : ''}`}>
                        <td className="py-2 px-4 whitespace-nowrap font-semibold">{getMonthName(row.m)} {row.yr}</td>
                        <td className="py-2 px-4 whitespace-nowrap">{row.p.consultant_first_name} {row.p.consultant_last_name}</td>
                        <td className="py-2 px-4 whitespace-nowrap">{row.p.client_company_name}</td>
                        <td className="py-2 px-4"><CellStatus val={row.ts} type="ts" /></td>
                        <td className="py-2 px-4">{row.ts?.days_worked ?? <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: Facturen ── */}
        <TabsContent value="facturen">
          <div className="flex items-center gap-3 mb-6 p-3 bg-muted/40 rounded-lg border border-border flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Jaar:</span>
            <Select value={periodYear} onValueChange={setPeriodYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs font-medium text-muted-foreground">Maand:</span>
            <Select value={invMonthFilter} onValueChange={setInvMonthFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle maanden</SelectItem>
                {Array.from({length:12},(_,i) => <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>)}
              </SelectContent>
            </Select>
            {invMonthFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setInvMonthFilter('all')}><X className="w-3.5 h-3.5 mr-1" /> Reset</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{invRows.length} rijen</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Periode</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Consultant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Klant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Factuur Klant</th>
                      <th className="text-left py-2 px-4 font-semibold whitespace-nowrap">Factuur Consultant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invRows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Geen data</td></tr>}
                    {invRows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-border/50 hover:bg-muted/20 ${!row.clientInv ? 'bg-amber-50/30' : row.clientInv.status === 'paid' ? 'bg-emerald-50/20' : ''}`}>
                        <td className="py-2 px-4 whitespace-nowrap font-semibold">{getMonthName(row.m)} {row.yr}</td>
                        <td className="py-2 px-4 whitespace-nowrap">{row.p.consultant_first_name} {row.p.consultant_last_name}</td>
                        <td className="py-2 px-4 whitespace-nowrap">{row.p.client_company_name}</td>
                        <td className="py-2 px-4"><CellStatus val={row.clientInv} type="cinv" /></td>
                        <td className="py-2 px-4"><CellStatus val={row.consInv} type="xinv" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}