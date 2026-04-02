import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, ArrowUpDown, X, RefreshCw, MessageSquare, ChevronDown, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import PlacementForm from '@/components/placements/PlacementForm';
import ExtendContractDialog from '@/components/placements/ExtendContractDialog';
import { formatCurrency, formatDate } from '@/lib/formatters';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ended: 'bg-slate-100 text-slate-500 border-slate-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
  ending_soon: 'bg-orange-100 text-orange-700 border-orange-300',
};
const STATUS_LABELS = { active: 'Actief', ended: 'Beëindigd', on_hold: 'On hold', ending_soon: 'Eindigt binnenkort' };
const TYPE_STYLES = {
  freelancer: 'bg-blue-100 text-blue-700 border-blue-200',
  perm: 'bg-purple-100 text-purple-700 border-purple-200',
};
const TYPE_LABELS = { freelancer: 'Freelancer', perm: 'PERM' };

function isEndingSoon(p) {
  const endDate = effectiveEndDate(p);
  if (!endDate || p.status !== 'active') return false;
  const daysLeft = (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24);
  return daysLeft >= 0 && daysLeft <= 56;
}

// Returns the effective end date (last extension or original end_date)
function effectiveEndDate(p) {
  const exts = p.extensions || [];
  if (exts.length > 0) {
    const sorted = [...exts].sort((a, b) => new Date(b.new_end_date) - new Date(a.new_end_date));
    return sorted[0].new_end_date;
  }
  return p.end_date || null;
}

// Diff in fractional months between two dates
function monthDiff(from, to) {
  const f = new Date(from);
  const t = new Date(to);
  return (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + (t.getDate() - f.getDate()) / 30;
}

function DurationBar({ p }) {
  const endDate = effectiveEndDate(p);
  if (!p.start_date || !endDate) {
    if (p.placement_type === 'perm') return <div className="text-xs text-muted-foreground">Onbepaalde duur</div>;
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const today = new Date();
  const totalMonths = monthDiff(p.start_date, endDate);
  const elapsedMonths = Math.max(0, Math.min(totalMonths, monthDiff(p.start_date, today.toISOString())));
  const totalDays = Math.round((new Date(endDate) - new Date(p.start_date)) / (1000 * 60 * 60 * 24));
  const isShort = totalMonths < 1;
  const pct = totalMonths > 0 ? Math.min(100, (elapsedMonths / totalMonths) * 100) : 0;
  const remainingMonths = Math.max(0, totalMonths - elapsedMonths);
  const isNearEnd = remainingMonths <= 1 && !isShort;
  return (
    <div className="min-w-[120px] space-y-1">
      <div className="text-xs font-bold text-foreground">
        {isShort ? `${totalDays} dagen` : `${Math.round(totalMonths)} mnd`}
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${isNearEnd ? 'bg-red-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DurationPrestaties({ p }) {
  const endDate = effectiveEndDate(p);
  if (!p.start_date || !endDate) return <span className="text-muted-foreground text-xs">—</span>;
  const today = new Date();
  const totalMonths = monthDiff(p.start_date, endDate);
  const elapsedMonths = Math.max(0, Math.min(totalMonths, monthDiff(p.start_date, today.toISOString())));
  const remainingMonths = Math.max(0, totalMonths - elapsedMonths);
  const isShort = totalMonths < 1;
  const totalDays = Math.round((new Date(endDate) - new Date(p.start_date)) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, Math.round((today - new Date(p.start_date)) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const isNearEnd = remainingMonths <= 1 && !isShort;
  return (
    <div className="min-w-[140px] space-y-0.5">
      <div className="text-xs text-muted-foreground">
        {isShort ? `${elapsedDays}d gepresteerd` : `${Math.round(elapsedMonths)} mnd gepresteerd`}
      </div>
      <div className={`text-xs font-medium ${isNearEnd ? 'text-red-600' : 'text-foreground'}`}>
        {isShort ? `${remainingDays}d resterend` : `${Math.round(remainingMonths)} mnd resterend`}
      </div>
    </div>
  );
}

function ContractValueCell({ p, daysPerMonth }) {
  if (p.placement_type === 'perm') {
    const fee = p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100));
    return (
      <div className="text-right min-w-[120px]">
        <div className="text-xs text-muted-foreground">Eenmalige fee</div>
        <div className="font-bold text-foreground">{fee > 0 ? formatCurrency(fee) : '—'}</div>
        {p.perm_fee_percentage && <div className="text-xs text-muted-foreground">{p.perm_fee_percentage}% van jaarloon</div>}
      </div>
    );
  }
  const endDate = effectiveEndDate(p);
  if (!p.start_date || !endDate || !p.client_rate) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const totalMonths = monthDiff(p.start_date, endDate);
  const fraction = (p.days_per_week || 5) / 5;
  const estimatedDays = Math.round(totalMonths * daysPerMonth * fraction);
  const contractValue = estimatedDays * (p.client_rate || 0);
  const contractMargin = estimatedDays * ((p.client_rate || 0) - (p.consultant_rate || 0));
  return (
    <div className="text-right min-w-[130px]">
      <div className="text-xs text-muted-foreground">
        Omzet (est.) · {(p.days_per_week || 5) < 5 ? <span className="text-amber-600 font-medium">{p.days_per_week}/5d</span> : <span className="text-emerald-600 font-medium">5/5d</span>}
      </div>
      <div className="font-bold text-foreground">{formatCurrency(contractValue)}</div>
      <div className="text-xs text-muted-foreground mt-1">Marge (est.)</div>
      <div className="font-semibold text-emerald-600">{formatCurrency(contractMargin)}</div>
    </div>
  );
}

function ExtensionCell({ p }) {
  const exts = p.extensions || [];
  const endDate = effectiveEndDate(p);
  if (exts.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <RefreshCw className="w-3 h-3 text-primary" />
        <span className="text-xs font-bold text-primary">{exts.length}x verlengd</span>
      </div>
      <div className="text-xs text-muted-foreground">Tot: {formatDate(endDate)}</div>
    </div>
  );
}

export default function Placements() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [extendingPlacement, setExtendingPlacement] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [daysPerMonth, setDaysPerMonth] = useState(21);
  const [showDaysEditor, setShowDaysEditor] = useState(false);
  const [daysInput, setDaysInput] = useState('21');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const queryClient = useQueryClient();

  const { data: placements = [], isLoading } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list('-created_date'),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const placement = await base44.entities.Placement.create(data);
      // Auto-create client contract
      await base44.entities.Contract.create({
        placement_id: placement.id,
        contract_type: 'client',
        status: 'draft',
        recipient_name: data.client_company_name || '',
        recipient_email: data.client_billing_email || '',
        agoria_index_client: data.agoria_index_client || null,
        notes: '',
      });
      // Auto-create consultant contract
      await base44.entities.Contract.create({
        placement_id: placement.id,
        contract_type: 'consultant',
        status: 'draft',
        recipient_name: `${data.consultant_first_name || ''} ${data.consultant_last_name || ''}`.trim(),
        recipient_email: '',
        agoria_index_consultant: data.agoria_index_consultant || null,
        notes: '',
      });
      return placement;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['placements'] }); queryClient.invalidateQueries({ queryKey: ['contracts'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Placement.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['placements'] }); setShowForm(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Placement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placements'] }),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Placement.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['placements'] }); setExtendingPlacement(null); },
  });

  const handleSave = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const enriched = useMemo(() => placements.map((p, idx) => {
    const endDate = effectiveEndDate(p);
    const totalMonths = p.start_date && endDate ? monthDiff(p.start_date, endDate) : 0;
    const endingSoon = isEndingSoon(p);

    if (p.placement_type === 'perm') {
      const fee = p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100));
      return { ...p, idx: idx + 1, totalDays: 0, totalRevenue: fee, totalCost: 0, totalMargin: fee, marginPerDay: 0, totalMonths, endingSoon };
    }

    const pts = timesheets.filter(t => t.placement_id === p.id);
    const totalDays = pts.reduce((s, t) => s + (t.days_worked || 0), 0);
    const totalRevenue = pts.reduce((s, t) => s + (t.client_revenue || 0), 0);
    const totalCost = pts.reduce((s, t) => s + (t.consultant_revenue || 0), 0);
    const totalMargin = pts.reduce((s, t) => s + (t.margin || 0), 0);
    const marginPerDay = (p.client_rate || 0) - (p.consultant_rate || 0);
    return { ...p, idx: idx + 1, totalDays, totalRevenue, totalCost, totalMargin, marginPerDay, totalMonths, endingSoon };
  }), [placements, timesheets]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(p =>
        `${p.consultant_first_name} ${p.consultant_last_name}`.toLowerCase().includes(q) ||
        (p.consultant_company_name || '').toLowerCase().includes(q) ||
        (p.client_company_name || '').toLowerCase().includes(q) ||
        (p.client_vat_number || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'ending_soon') rows = rows.filter(p => p.endingSoon);
    else if (statusFilter !== 'all') rows = rows.filter(p => p.status === statusFilter);
    if (typeFilter !== 'all') rows = rows.filter(p => (p.placement_type || 'freelancer') === typeFilter);
    if (sortBy !== 'default') {
      rows = [...rows].sort((a, b) => {
        if (sortBy === 'revenue_desc') return b.totalRevenue - a.totalRevenue;
        if (sortBy === 'revenue_asc') return a.totalRevenue - b.totalRevenue;
        if (sortBy === 'margin_desc') return b.totalMargin - a.totalMargin;
        if (sortBy === 'margin_asc') return a.totalMargin - b.totalMargin;
        if (sortBy === 'days_desc') return b.totalDays - a.totalDays;
        if (sortBy === 'days_asc') return a.totalDays - b.totalDays;
        if (sortBy === 'rate_desc') return (b.client_rate || 0) - (a.client_rate || 0);
        if (sortBy === 'rate_asc') return (a.client_rate || 0) - (b.client_rate || 0);
        if (sortBy === 'start_asc') return new Date(a.start_date || 0) - new Date(b.start_date || 0);
        if (sortBy === 'start_desc') return new Date(b.start_date || 0) - new Date(a.start_date || 0);
        if (sortBy === 'duration_desc') return b.totalMonths - a.totalMonths;
        if (sortBy === 'duration_asc') return a.totalMonths - b.totalMonths;
        return 0;
      });
    }
    return rows;
  }, [enriched, search, statusFilter, typeFilter, sortBy]);

  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all' || sortBy !== 'default';

  return (
    <div>
      <PageHeader title="Placements" subtitle={`${placements.length} placements`}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Placement
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/40 rounded-lg border border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, firma, BTW-nr..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
            <SelectItem value="ending_soon">⚠️ Eindigt binnenkort</SelectItem>
            <SelectItem value="ended">Beëindigd</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
            <SelectItem value="perm">PERM</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-56 h-8 text-xs gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <SelectValue placeholder="Sorteren op" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Standaard</SelectItem>
            <SelectItem value="revenue_desc">Hoogste omzet</SelectItem>
            <SelectItem value="revenue_asc">Laagste omzet</SelectItem>
            <SelectItem value="margin_desc">Hoogste marge</SelectItem>
            <SelectItem value="margin_asc">Laagste marge</SelectItem>
            <SelectItem value="days_desc">Meeste dagen</SelectItem>
            <SelectItem value="days_asc">Minste dagen</SelectItem>
            <SelectItem value="rate_desc">Hoogste tarief</SelectItem>
            <SelectItem value="rate_asc">Laagste tarief</SelectItem>
            <SelectItem value="start_asc">Startdatum (vroegst)</SelectItem>
            <SelectItem value="start_desc">Startdatum (nieuwst)</SelectItem>
            <SelectItem value="duration_desc">Langste looptijd</SelectItem>
            <SelectItem value="duration_asc">Kortste looptijd</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); setSortBy('default'); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Placement Bewerken' : 'Nieuwe Placement'}</DialogTitle>
            <DialogDescription>Vul de gegevens in voor de placement.</DialogDescription>
          </DialogHeader>
          <PlacementForm
            placement={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <ExtendContractDialog
        open={!!extendingPlacement}
        placement={extendingPlacement}
        onClose={() => setExtendingPlacement(null)}
        onSave={(data) => extendMutation.mutate({ id: extendingPlacement.id, data })}
      />

      {/* Table */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Plus} title="Geen placements gevonden" description="Pas je filters aan of maak een nieuwe placement aan.">
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuwe Placement</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">#</th>
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">Consultant</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Firma klant</th>
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">Type</th>
                    <th className="text-right py-3 px-3 font-bold text-foreground whitespace-nowrap">Pay/dag</th>
                    <th className="text-right py-3 px-3 font-bold text-foreground whitespace-nowrap">Bill/dag</th>
                    <th className="text-right py-3 px-3 font-bold text-foreground whitespace-nowrap">Marge/dag</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Startdatum</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Einddatum</th>
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">Looptijd</th>
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">Prestaties</th>
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">Regime</th>
                    <th className="text-right py-3 px-3 font-normal text-white bg-primary whitespace-nowrap">
                      <div className="relative inline-block">
                        <button
                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                          onClick={() => { setDaysInput(String(daysPerMonth)); setShowDaysEditor(v => !v); }}
                        >
                          Contractwaarde
                          <Settings2 className="w-3 h-3 opacity-70" />
                        </button>
                        {showDaysEditor && (
                          <div className="absolute right-0 top-full mt-2 z-50 bg-background border border-border rounded-lg shadow-lg p-3 w-56 text-foreground">
                            <div className="text-xs font-semibold mb-1">Werkdagen per maand</div>
                            <div className="text-xs text-muted-foreground mb-2">Formule: dagtarief × maanden × dagen/maand</div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1" max="31"
                                value={daysInput}
                                onChange={e => setDaysInput(e.target.value)}
                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                              />
                              <button
                                className="shrink-0 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-md hover:bg-primary/90"
                                onClick={() => { const v = parseFloat(daysInput); if (v > 0) setDaysPerMonth(v); setShowDaysEditor(false); }}
                              >OK</button>
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">Huidig: {daysPerMonth} dagen/maand</div>
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="text-right py-3 px-3 font-bold text-foreground whitespace-nowrap">Gerealiseerde Omzet</th>
                    <th className="text-right py-3 px-3 font-bold text-foreground whitespace-nowrap">Gerealiseerde Marge</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Verlengingen</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Status</th>
                    <th className="text-right py-3 px-3 font-normal text-foreground whitespace-nowrap">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <React.Fragment key={p.id}>
                      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-bold text-foreground">{p.idx}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-foreground whitespace-nowrap">{p.consultant_first_name} {p.consultant_last_name}</div>
                          {p.consultant_company_name && <div className="text-xs text-muted-foreground">{p.consultant_company_name}</div>}
                          {p.consultant_vat_number && <div className="text-xs text-muted-foreground font-mono">{p.consultant_vat_number}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-foreground whitespace-nowrap">{p.client_company_name}</div>
                          {p.client_vat_number && <div className="text-xs text-muted-foreground font-mono">{p.client_vat_number}</div>}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className={`text-xs ${TYPE_STYLES[p.placement_type || 'freelancer']}`}>
                            {TYPE_LABELS[p.placement_type || 'freelancer']}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                           <div className="font-bold text-foreground">{p.consultant_rate ? formatCurrency(p.consultant_rate) : '—'}</div>
                         </td>
                         <td className="py-3 px-3 text-right">
                           <div className="font-bold text-foreground">{p.client_rate ? formatCurrency(p.client_rate) : '—'}</div>
                         </td>
                         <td className="py-3 px-3 text-right">
                           {p.client_rate && p.consultant_rate
                             ? <div className="font-bold text-emerald-600">{formatCurrency((p.client_rate || 0) - (p.consultant_rate || 0))}</div>
                             : <span className="text-muted-foreground">—</span>}
                         </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(p.start_date)}
                        </td>
                        <td className="py-3 px-3 text-xs whitespace-nowrap">
                          <span className="font-bold text-foreground">{effectiveEndDate(p) ? formatDate(effectiveEndDate(p)) : '—'}</span>
                        </td>
                        <td className="py-3 px-3"><DurationBar p={p} /></td>
                        <td className="py-3 px-3"><DurationPrestaties p={p} /></td>
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className={`text-xs font-semibold ${(p.days_per_week || 5) < 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {(p.days_per_week || 5) >= 5 ? 'Voltijds' : 'Deeltijds'}
                            </div>
                            <select
                              className="text-xs border border-border rounded px-1 py-0.5 bg-background cursor-pointer"
                              value={p.days_per_week || 5}
                              onChange={e => updateMutation.mutate({ id: p.id, data: { days_per_week: parseFloat(e.target.value) } })}
                            >
                              <option value="5">5/5 voltijds</option>
                              <option value="4">4/5</option>
                              <option value="3">3/5</option>
                              <option value="2.5">2.5/5 halftijds</option>
                              <option value="2">2/5</option>
                              <option value="1">1/5</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-3 bg-primary/10">
                          <ContractValueCell p={p} daysPerMonth={daysPerMonth} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-bold text-foreground">{p.totalRevenue > 0 ? formatCurrency(p.totalRevenue) : <span className="text-muted-foreground text-xs">—</span>}</div>
                          <div className="text-xs text-muted-foreground">{p.totalDays > 0 ? `${p.totalDays}d` : ''}</div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className={`font-bold ${p.totalMargin > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{p.totalMargin > 0 ? formatCurrency(p.totalMargin) : '—'}</div>
                          {p.totalRevenue > 0 && p.totalMargin > 0 && <div className="text-xs text-muted-foreground">{((p.totalMargin / p.totalRevenue) * 100).toFixed(1)}%</div>}
                        </td>
                        <td className="py-3 px-3"><ExtensionCell p={p} /></td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className={`text-xs ${p.endingSoon ? STATUS_STYLES.ending_soon : (STATUS_STYLES[p.status] || 'bg-muted text-muted-foreground')}`}>
                            {p.endingSoon ? '⚠️ Eindigt binnenkort' : (STATUS_LABELS[p.status] || p.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Verlengen" onClick={() => setExtendingPlacement(p)}>
                              <RefreshCw className="w-4 h-4 text-primary" />
                            </Button>
                            {p.notes && (
                              <Button variant="ghost" size="icon" title="Opmerkingen" onClick={() => setExpandedNotes(n => ({ ...n, [p.id]: !n[p.id] }))}>
                                <MessageSquare className="w-4 h-4 text-amber-500" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setShowForm(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Verwijderen?</AlertDialogTitle>
                                  <AlertDialogDescription>Dit verwijdert deze placement permanent.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>Verwijderen</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                      {expandedNotes[p.id] && p.notes && (
                        <tr className="bg-amber-50 border-b border-amber-200">
                          <td colSpan={13} className="px-4 py-2">
                            <div className="flex items-start gap-2 text-sm text-amber-900">
                              <MessageSquare className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                              <span>{p.notes}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
                </table>
                </div>
                </CardContent>
                </Card>
      )}
    </div>
  );
}