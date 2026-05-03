import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Clock, Search, ArrowUpDown, X, AlertTriangle } from 'lucide-react';
import ReconcileCell from '@/components/timesheets/ReconcileCell';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import ImportedBadge from '@/components/shared/ImportedBadge';
import { formatCurrency, getMonthName } from '@/lib/formatters';

// Returns true if timesheet is "late": created_date > 15 days after end of the month it covers
function isLate(ts) {
  if (!ts.month || !ts.year) return false;
  // End of the performance month
  const endOfMonth = new Date(ts.year, ts.month, 0); // last day of ts.month
  const createdAt = ts.created_date ? new Date(ts.created_date) : null;
  if (!createdAt) return false;
  const diffDays = (createdAt - endOfMonth) / (1000 * 60 * 60 * 24);
  return diffDays > 15;
}

const STATUS_LABELS = {
  requested: 'Aangevraagd',
  submitted: 'Ingediend',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
};

const STATUS_STYLES = {
  requested: 'bg-amber-100 text-amber-700 border-amber-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
};

export default function Timesheets() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterMonth, setFilterMonth] = useState(() => localStorage.getItem('ts_filterMonth') || String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(() => localStorage.getItem('ts_filterYear') || String(new Date().getFullYear()));
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('ts_viewMode') || 'month');
  const [search, setSearch] = useState(() => localStorage.getItem('ts_search') || '');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('ts_sortBy') || 'default');
  const [onlyActive, setOnlyActive] = useState(() => localStorage.getItem('ts_onlyActive') === 'true');
  const [completionFilter, setCompletionFilter] = useState(() => localStorage.getItem('ts_completionFilter') || 'all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const queryClient = useQueryClient();

  // Persist filters
  React.useEffect(() => { localStorage.setItem('ts_filterMonth', filterMonth); }, [filterMonth]);
  React.useEffect(() => { localStorage.setItem('ts_filterYear', filterYear); }, [filterYear]);
  React.useEffect(() => { localStorage.setItem('ts_viewMode', viewMode); }, [viewMode]);
  React.useEffect(() => { localStorage.setItem('ts_search', search); }, [search]);
  React.useEffect(() => { localStorage.setItem('ts_sortBy', sortBy); }, [sortBy]);
  React.useEffect(() => { localStorage.setItem('ts_onlyActive', onlyActive); }, [onlyActive]);
  React.useEffect(() => { localStorage.setItem('ts_completionFilter', completionFilter); }, [completionFilter]);

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const [form, setForm] = useState({
    placement_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    days_worked: '', hours_worked: '', status: 'requested',
  });

  const resetForm = () => setForm({
    placement_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    days_worked: '', hours_worked: '', status: 'requested',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Timesheet.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Timesheet.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const placement = placements.find(p => p.id === form.placement_id);
    const days = parseFloat(form.days_worked) || 0;
    const clientRevenue = days * (placement?.client_rate || 0);
    const consultantRevenue = days * (placement?.consultant_rate || 0);
    const data = {
      ...form,
      month: parseInt(form.month),
      year: parseInt(form.year),
      days_worked: days,
      hours_worked: parseFloat(form.hours_worked) || 0,
      client_revenue: clientRevenue,
      consultant_revenue: consultantRevenue,
      margin: clientRevenue - consultantRevenue,
      consultant_name: placement ? `${placement.consultant_first_name} ${placement.consultant_last_name}` : '',
      client_company: placement?.client_company_name || '',
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (ts) => {
    setEditing(ts);
    setForm({ ...ts, days_worked: ts.days_worked || '', hours_worked: ts.hours_worked || '' });
    setShowForm(true);
  };

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  // Enrich timesheets with placement data + invoice reconciliation
  const enriched = useMemo(() => timesheets.map(t => {
    const placement = placements.find(p => p.id === t.placement_id);
    const isImported = placement?.notes?.includes('Geïmporteerd vanuit Actuals Excel');
    const clientInvoice = invoices.find(i => i.placement_id === t.placement_id && i.month === t.month && i.year === t.year && i.invoice_type === 'client_invoice');
    const consultantInvoice = invoices.find(i => i.placement_id === t.placement_id && i.month === t.month && i.year === t.year && i.invoice_type === 'consultant_invoice');
    const days = t.days_worked || 0;
    const expectedClient = days * (placement?.client_rate || 0);
    const expectedConsultant = days * (placement?.consultant_rate || 0);
    const clientMatch = clientInvoice ? Math.abs((clientInvoice.amount || 0) - expectedClient) < 0.5 : null;
    const consultantMatch = consultantInvoice ? Math.abs((consultantInvoice.amount || 0) - expectedConsultant) < 0.5 : null;
    return {
      ...t,
      placement,
      clientVat: placement?.client_vat_number || '',
      clientRate: placement?.client_rate || 0,
      consultantRate: placement?.consultant_rate || 0,
      late: isLate(t) && !isImported,
      isImported,
      clientInvoice, consultantInvoice,
      expectedClient, expectedConsultant,
      clientMatch, consultantMatch,
    };
  }), [timesheets, placements, invoices]);

  // Virtual rows: active placements without a timesheet for selected month (only in month view)
  const missingRows = useMemo(() => {
    if (viewMode !== 'month') return [];
    const yr = parseInt(filterYear);
    const mo = parseInt(filterMonth);
    return placements
      .filter(p => p.status === 'active' && p.placement_type !== 'perm')
      .filter(p => !timesheets.some(t => t.placement_id === p.id && t.month === mo && t.year === yr))
      .map(p => ({
        _virtual: true,
        placement_id: p.id,
        placement: p,
        consultant_name: `${p.consultant_first_name} ${p.consultant_last_name}`,
        client_company: p.client_company_name,
        clientVat: p.client_vat_number || '',
        clientRate: p.client_rate || 0,
        consultantRate: p.consultant_rate || 0,
        days_worked: null,
        month: mo,
        year: yr,
      }));
  }, [placements, timesheets, filterMonth, filterYear, viewMode]);

  const filtered = useMemo(() => {
    let rows;
    const yr = parseInt(filterYear);
    const currentMonth = new Date().getFullYear() === yr ? new Date().getMonth() + 1 : 12;
    if (viewMode === 'month') {
      rows = enriched.filter(t => t.month === parseInt(filterMonth) && t.year === yr);
    } else if (viewMode === 'ytd') {
      rows = enriched.filter(t => t.year === yr && t.month <= currentMonth);
    } else {
      rows = enriched.filter(t => t.year === yr);
    }

    // Section filter
    if (sectionFilter === 'freelancer') rows = rows.filter(t => !t.isImported && t.placement?.placement_type !== 'perm');
    else if (sectionFilter === 'import_freelancer') rows = rows.filter(t => t.isImported && t.placement?.placement_type !== 'perm');
    else if (sectionFilter === 'import_all') rows = rows.filter(t => t.isImported);

    if (onlyActive) {
      rows = rows.filter(t => t.placement?.status === 'active');
    }

    if (completionFilter === 'complete') {
      rows = rows.filter(t => t.confirmed_to_client);
    } else if (completionFilter === 'pending') {
      rows = rows.filter(t => !t.confirmed_to_client);
    }

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(t =>
        (t.consultant_name || '').toLowerCase().includes(q) ||
        (t.client_company || '').toLowerCase().includes(q) ||
        (t.clientVat || '').toLowerCase().includes(q)
      );
    }

    if (sortBy !== 'default') {
      rows = [...rows].sort((a, b) => {
        if (sortBy === 'revenue_desc') return (b.client_revenue || 0) - (a.client_revenue || 0);
        if (sortBy === 'revenue_asc') return (a.client_revenue || 0) - (b.client_revenue || 0);
        if (sortBy === 'margin_desc') return (b.margin || 0) - (a.margin || 0);
        if (sortBy === 'margin_asc') return (a.margin || 0) - (b.margin || 0);
        if (sortBy === 'days_desc') return (b.days_worked || 0) - (a.days_worked || 0);
        if (sortBy === 'days_asc') return (a.days_worked || 0) - (b.days_worked || 0);
        return 0;
      });
    }

    return rows;
  }, [enriched, filterMonth, filterYear, viewMode, search, sortBy, onlyActive, completionFilter, sectionFilter]);

  const totalRevenue = filtered.reduce((s, t) => s + (t.client_revenue || 0), 0);
  const totalCost = filtered.reduce((s, t) => s + (t.consultant_revenue || 0), 0);
  const totalMargin = filtered.reduce((s, t) => s + (t.margin || 0), 0);

  const quickCreateTimesheet = (virtual) => {
    const days = virtual.days_worked;
    const clientRevenue = days * virtual.clientRate;
    const consultantRevenue = days * virtual.consultantRate;
    createMutation.mutate({
      placement_id: virtual.placement_id,
      month: virtual.month,
      year: virtual.year,
      days_worked: days,
      hours_worked: 0,
      status: 'approved',
      client_revenue: clientRevenue,
      consultant_revenue: consultantRevenue,
      margin: clientRevenue - consultantRevenue,
      consultant_name: virtual.consultant_name,
      client_company: virtual.client_company,
    });
  };

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Maandelijkse uren & omzet bijhouden">
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Timesheet
        </Button>
      </PageHeader>

      {/* Month/Year filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* View mode toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {[['month', 'Maand'], ['ytd', 'YTD'], ['year', 'Volledig jaar']].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {viewMode === 'month' && (
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {viewMode !== 'month' && (
          <span className="text-xs text-muted-foreground">
            {viewMode === 'ytd' ? `YTD t/m ${getMonthName(Math.min(new Date().getMonth() + 1, 12))} ${filterYear}` : `Volledig jaar ${filterYear}`}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title={viewMode === 'month' ? 'Omzet' : 'Gecumuleerde Omzet'} value={formatCurrency(totalRevenue)} />
        <StatCard title={viewMode === 'month' ? 'Kost' : 'Gecumuleerde Kost'} value={formatCurrency(totalCost)} />
        <StatCard title={viewMode === 'month' ? 'Marge' : 'Gecumuleerde Marge'} value={formatCurrency(totalMargin)} />
        <StatCard title="Dagen" value={`${filtered.reduce((s, t) => s + (t.days_worked || 0), 0)}d`} />
      </div>



      {/* Search + Sort bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/40 rounded-lg border border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Zoek op consultant, klant of BTW-nr..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-52 h-8 text-xs gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <SelectValue placeholder="Sorteren op" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Standaard</SelectItem>
            <SelectItem value="revenue_desc">Hoogste omzet eerst</SelectItem>
            <SelectItem value="revenue_asc">Laagste omzet eerst</SelectItem>
            <SelectItem value="margin_desc">Hoogste marge eerst</SelectItem>
            <SelectItem value="margin_asc">Laagste marge eerst</SelectItem>
            <SelectItem value="days_desc">Meeste dagen eerst</SelectItem>
            <SelectItem value="days_asc">Minste dagen eerst</SelectItem>
          </SelectContent>
        </Select>
        <Select value={completionFilter} onValueChange={setCompletionFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle timesheets</SelectItem>
            <SelectItem value="complete">Alles in orde</SelectItem>
            <SelectItem value="pending">Actie nodig</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={onlyActive ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setOnlyActive(v => !v)}
        >
          Enkel actieve placements
        </Button>
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle secties</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
            <SelectItem value="import_freelancer">Import — Freelancer</SelectItem>
            <SelectItem value="import_all">Import (alle)</SelectItem>
          </SelectContent>
        </Select>
        {(search || sortBy !== 'default' || onlyActive || completionFilter !== 'all' || sectionFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(''); setSortBy('default'); setOnlyActive(false); setCompletionFilter('all'); setSectionFilter('all'); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) { setEditing(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Timesheet Bewerken' : 'Nieuwe Timesheet'}</DialogTitle>
            <DialogDescription>Vul de gewerkte dagen in. Omzet en marge worden automatisch berekend.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Placement *</Label>
              <Select value={form.placement_id} onValueChange={v => setForm(p => ({ ...p, placement_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecteer placement" /></SelectTrigger>
                <SelectContent>
                  {placements.filter(p => p.status === 'active').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.consultant_first_name} {p.consultant_last_name} → {p.client_company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Maand</Label>
                <Select value={String(form.month)} onValueChange={v => setForm(p => ({ ...p, month: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{getMonthName(i + 1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jaar</Label>
                <Select value={String(form.year)} onValueChange={v => setForm(p => ({ ...p, year: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dagen gewerkt</Label>
                <Input type="number" step="0.5" value={form.days_worked} onChange={e => setForm(p => ({ ...p, days_worked: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Uren gewerkt</Label>
                <Input type="number" step="0.5" value={form.hours_worked} onChange={e => setForm(p => ({ ...p, hours_worked: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested">Aangevraagd</SelectItem>
                  <SelectItem value="submitted">Ingediend</SelectItem>
                  <SelectItem value="approved">Goedgekeurd</SelectItem>
                  <SelectItem value="rejected">Afgewezen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.placement_id && form.days_worked && (
              <Card className="bg-muted/50 p-4">
                <div className="text-sm space-y-1">
                  {(() => {
                    const pl = placements.find(p => p.id === form.placement_id);
                    const days = parseFloat(form.days_worked) || 0;
                    const rev = days * (pl?.client_rate || 0);
                    const cost = days * (pl?.consultant_rate || 0);
                    return (
                      <>
                        <div className="flex justify-between"><span className="text-muted-foreground">Omzet:</span><span className="font-semibold">{formatCurrency(rev)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Kost:</span><span className="font-semibold">{formatCurrency(cost)}</span></div>
                        <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">Marge:</span><span className="font-bold text-emerald-600">{formatCurrency(rev - cost)}</span></div>
                      </>
                    );
                  })()}
                </div>
              </Card>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
              <Button type="submit">Opslaan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Clock} title="Geen timesheets" description={`Geen timesheets voor ${getMonthName(parseInt(filterMonth))} ${filterYear}.`}>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuwe Timesheet</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-bold text-foreground">Consultant</th>
                    <th className="text-left py-3 px-4 font-normal text-foreground">Klant</th>
                    <th className="text-left py-3 px-4 font-bold text-foreground">BTW nr. klant</th>
                    <th className="text-right py-3 px-4 font-normal text-foreground">Dagen</th>
                    <th className="text-right py-3 px-4 font-bold text-foreground">Tarief/dag</th>
                    <th className="text-right py-3 px-4 font-normal text-white bg-primary">Omzet</th>
                    <th className="text-right py-3 px-4 font-bold text-white bg-primary">Kost</th>
                    <th className="text-right py-3 px-4 font-bold text-foreground">Marge</th>
                    <th className="text-center py-3 px-2 font-bold text-foreground whitespace-nowrap">Van consultant</th>
                    <th className="text-center py-3 px-2 font-bold text-foreground whitespace-nowrap">Klant bevestigd</th>
                    <th className="text-right py-3 px-4 font-normal text-foreground">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">{t.consultant_name || '—'}</span>
                          {t.isImported && <ImportedBadge />}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{t.client_company || '—'}</td>
                      <td className="py-3 px-4 font-bold text-foreground text-xs">{t.clientVat || '—'}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{t.days_worked || 0}</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground text-xs">
                        <div>{formatCurrency(t.clientRate)}</div>
                        <div className="text-muted-foreground font-normal">cons: {formatCurrency(t.consultantRate)}</div>
                      </td>
                      <td className="py-3 px-4 text-right bg-primary/10 text-muted-foreground">{formatCurrency(t.client_revenue)}</td>
                      <td className="py-3 px-4 text-right bg-primary/10 font-bold text-foreground">{formatCurrency(t.consultant_revenue)}</td>
                      <td className={`py-3 px-4 text-right font-bold flex items-center justify-end gap-1.5 ${(t.margin || 0) < 80 ? 'text-red-600' : (t.margin || 0) >= 0 ? 'text-primary' : 'text-red-500'}`}>
                        {(t.margin || 0) < 80 && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                        {formatCurrency(t.margin)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => {
                            const newStatus = t.confirmed_to_client ? 'requested' : 'submitted';
                            updateMutation.mutate({ id: t.id, data: { confirmed_to_client: !t.confirmed_to_client, status: newStatus } });
                          }}
                          className={`flex items-center justify-center w-6 h-6 rounded-md border transition-colors mx-auto ${
                            t.confirmed_to_client
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                              : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}
                          title={t.confirmed_to_client ? 'Ontvangen' : 'Niet ontvangen'}
                        >
                          {t.confirmed_to_client ? '✓' : '—'}
                        </button>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => {
                            const newStatus = t.status === 'approved' ? 'submitted' : 'approved';
                            updateMutation.mutate({ id: t.id, data: { status: newStatus } });
                          }}
                          className={`flex items-center justify-center w-6 h-6 rounded-md border transition-colors mx-auto ${
                            t.status === 'approved'
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                              : 'bg-slate-100 border-slate-300 text-slate-500'
                          }`}
                          title={t.status === 'approved' ? 'Goedgekeurd' : 'Niet goedgekeurd'}
                        >
                          {t.status === 'approved' ? '✓' : '—'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Bewerken</Button>
                      </td>
                    </tr>
                  ))}

                  {filtered.length > 0 && (
                    <tr className="bg-muted/40 border-t-2 font-semibold">
                      <td colSpan={5} className="py-3 px-4 text-right text-xs text-muted-foreground font-bold">Totaal (gefilterd)</td>
                      <td className="py-3 px-4 text-right bg-primary/10 text-muted-foreground">{formatCurrency(filtered.reduce((s, t) => s + (t.client_revenue || 0), 0))}</td>
                      <td className="py-3 px-4 text-right bg-primary/10 font-bold text-foreground">{formatCurrency(filtered.reduce((s, t) => s + (t.consultant_revenue || 0), 0))}</td>
                      <td className="py-3 px-4 text-right text-primary font-bold">{formatCurrency(filtered.reduce((s, t) => s + (t.margin || 0), 0))}</td>
                      <td colSpan={3} />
                                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}