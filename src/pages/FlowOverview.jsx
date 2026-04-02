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
  const [periodMonth, setPeriodMonth] = useState('all');

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

  // Period table data: for each placement × month combination in selected period
  const periodRows = useMemo(() => {
    const yr = parseInt(periodYear);
    const months = periodMonth === 'all' ? Array.from({length:12},(_,i)=>i+1) : [parseInt(periodMonth)];
    const rows = [];
    placements.forEach(p => {
      months.forEach(m => {
        const ts = timesheets.find(t => t.placement_id === p.id && t.year === yr && t.month === m);
        const clientInv = invoices.find(i => i.placement_id === p.id && i.year === yr && i.month === m && i.invoice_type === 'client_invoice');
        const consInv = invoices.find(i => i.placement_id === p.id && i.year === yr && i.month === m && i.invoice_type === 'consultant_invoice');
        const pContracts = contracts.filter(c => c.placement_id === p.id);
        const clientContract = pContracts.find(c => c.contract_type === 'client');
        const consultantContract = pContracts.find(c => c.contract_type === 'consultant');
        // only show rows where placement was active that month
        const startDate = p.start_date ? new Date(p.start_date) : null;
        const rowDate = new Date(yr, m - 1, 1);
        if (startDate && rowDate < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) return;
        const endDate = p.end_date ? new Date(p.end_date) : null;
        if (endDate && rowDate > new Date(endDate.getFullYear(), endDate.getMonth(), 1)) return;
        rows.push({ p, m, yr, ts, clientInv, consInv, clientContract, consultantContract });
      });
    });
    return rows;
  }, [placements, timesheets, invoices, contracts, periodYear, periodMonth]);

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
          <TabsTrigger value="pipeline">🔗 Pipeline per placement</TabsTrigger>
          <TabsTrigger value="periode">📅 Periode tabel</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: bestaande kaartjesweergave ── */}
        <TabsContent value="pipeline">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/40 rounded-lg border border-border">
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

          {/* Flow rows */}
          <div className="space-y-3">
            {filtered.map(f => {
              const p = f.placement;
              const isOpen = expanded[p.id];
              return (
                <Card key={p.id} className={`overflow-hidden transition-all ${f.health === 'warn' ? 'border-amber-200' : ''}`}>
                  <button className="w-full text-left" onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}>
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <div className="flex items-center gap-2 min-w-[180px] flex-1">
                        <StepIcon status={f.health} />
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {p.consultant_first_name} {p.consultant_last_name}
                            {p.notes?.includes('Geïmporteerd vanuit Actuals Excel') && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">
                                <CheckCircle2 className="w-3 h-3" /> Geïmporteerd
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.client_company_name}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-1">
                        <StepBadge label="Contracten" status={f.contractStatus}
                          detail={f.contractStatus === 'ok' ? 'Getekend' : f.contractStatus === 'pending' ? 'Concept/Verstuurd' : f.contractStatus === 'missing' ? 'Ontbreekt' : 'Deels'}
                        />
                        <StepBadge label="Timesheets" status={f.timesheetStatus}
                          detail={`${f.pTimesheets.length} totaal · ${f.approvedTS.length} goedgekeurd`}
                        />
                        <StepBadge label="Facturen" status={f.invoiceStatus}
                          detail={`${f.clientInvoices.length} facturen`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(p.start_date)} → {p.end_date ? formatDate(p.end_date) : '∞'}</div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Contracten</div>
                        <div className="space-y-2">
                          {[{ label: 'Klant', contract: f.clientContract }, { label: 'Consultant', contract: f.consultantContract }].map(({ label, contract }) => (
                            <div key={label} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{label}:</span>
                              {contract ? (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{contract.status}</Badge>
                                  {contract.agoria_index_client || contract.agoria_index_consultant ? (
                                    <span className="font-mono text-muted-foreground">idx: {contract.agoria_index_client || contract.agoria_index_consultant}</span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-red-500 font-medium">Ontbreekt</span>
                              )}
                            </div>
                          ))}
                          <Link to="/Contracts"><Button variant="outline" size="sm" className="w-full h-7 text-xs mt-1">Beheer Contracten →</Button></Link>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recente Timesheets</div>
                        {f.pTimesheets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Geen timesheets</p>
                        ) : (
                          <div className="space-y-1">
                            {f.pTimesheets.slice(0, 4).map(t => (
                              <div key={t.id} className="flex items-center justify-between text-xs">
                                <span>{getMonthName(t.month)} {t.year}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">{t.days_worked}d</span>
                                  <Badge variant="outline" className="text-xs py-0">{t.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Link to="/Timesheets"><Button variant="outline" size="sm" className="w-full h-7 text-xs mt-2">Beheer Timesheets →</Button></Link>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Facturen</div>
                        {f.pInvoices.length === 0 ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Geen facturen</p>
                            {f.approvedTS.length > 0 && (
                              <p className="text-xs text-amber-600 font-medium">⚠️ {f.approvedTS.length} goedgekeurde timesheet(s) zonder factuur</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {f.pInvoices.slice(0, 4).map(inv => (
                              <div key={inv.id} className="flex items-center justify-between text-xs">
                                <span>{inv.invoice_type === 'client_invoice' ? 'Klant' : 'Cons.'} {getMonthName(inv.month)} {inv.year}</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">{formatCurrency(inv.amount)}</span>
                                  <Badge variant="outline" className="text-xs py-0">{inv.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Link to="/Billing"><Button variant="outline" size="sm" className="w-full h-7 text-xs mt-2">Beheer Facturen →</Button></Link>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── TAB 2: Periode tabel ── */}
        <TabsContent value="periode">
          {/* Periode filters */}
          <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/40 rounded-lg border border-border">
            <span className="text-xs font-medium text-muted-foreground">Periode:</span>
            <Select value={periodYear} onValueChange={setPeriodYear}>
              <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={periodMonth} onValueChange={setPeriodMonth}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle maanden</SelectItem>
                {Array.from({length:12},(_,i) => (
                  <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {periodMonth !== 'all' && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setPeriodMonth('all')}>
                <X className="w-3.5 h-3.5 mr-1" /> Reset maand
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{periodRows.length} rijen</span>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Periode</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Consultant</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Klant</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Contract</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Timesheet</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Factuur Klant</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Factuur Consultant</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.length === 0 && (
                      <tr><td colSpan={8} className="py-10 text-center text-muted-foreground text-sm">Geen data voor deze periode</td></tr>
                    )}
                    {periodRows.map((row, idx) => {
                      const allOk = row.ts?.status === 'approved' && row.clientInv && row.consInv;
                      const hasIssue = !row.ts || (row.ts.status === 'approved' && !row.clientInv);
                      const rowBg = allOk ? 'bg-emerald-50/30' : hasIssue ? 'bg-amber-50/30' : '';
                      return (
                        <tr key={idx} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${rowBg}`}>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-foreground">{getMonthName(row.m)}</div>
                            <div className="text-xs text-muted-foreground">{row.yr}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium whitespace-nowrap">{row.p.consultant_first_name} {row.p.consultant_last_name}</div>
                            {row.p.consultant_company_name && <div className="text-xs text-muted-foreground">{row.p.consultant_company_name}</div>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="whitespace-nowrap">{row.p.client_company_name}</div>
                          </td>
                          <td className="py-3 px-4">
                            <ContractCell cc={row.clientContract} xc={row.consultantContract} />
                          </td>
                          <td className="py-3 px-4">
                            <CellStatus val={row.ts} type="ts" />
                          </td>
                          <td className="py-3 px-4">
                            <CellStatus val={row.clientInv} type="cinv" />
                          </td>
                          <td className="py-3 px-4">
                            <CellStatus val={row.consInv} type="xinv" />
                          </td>
                          <td className="py-3 px-4">
                            {allOk ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Volledig</span>
                            ) : hasIssue ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> Actie nodig</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"><Clock className="w-3.5 h-3.5" /> In behandeling</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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