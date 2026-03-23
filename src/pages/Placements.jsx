import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2, ArrowUpDown, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import PlacementForm from '@/components/placements/PlacementForm';
import { formatCurrency, formatDate } from '@/lib/formatters';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ended: 'bg-slate-100 text-slate-500 border-slate-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
};
const STATUS_LABELS = { active: 'Actief', ended: 'Beëindigd', on_hold: 'On hold' };
const TYPE_STYLES = {
  freelancer: 'bg-blue-100 text-blue-700 border-blue-200',
  perm: 'bg-purple-100 text-purple-700 border-purple-200',
};
const TYPE_LABELS = { freelancer: 'Freelancer', perm: 'PERM' };

export default function Placements() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
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
    mutationFn: (data) => base44.entities.Placement.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['placements'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Placement.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['placements'] }); setShowForm(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Placement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placements'] }),
  });

  const handleSave = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  // Enrich placements with aggregated timesheet financials
  const enriched = useMemo(() => placements.map((p, idx) => {
    const pts = timesheets.filter(t => t.placement_id === p.id);
    const totalDays = pts.reduce((s, t) => s + (t.days_worked || 0), 0);
    const totalRevenue = pts.reduce((s, t) => s + (t.client_revenue || 0), 0);
    const totalCost = pts.reduce((s, t) => s + (t.consultant_revenue || 0), 0);
    const totalMargin = pts.reduce((s, t) => s + (t.margin || 0), 0);
    const marginPerDay = (p.client_rate || 0) - (p.consultant_rate || 0);
    return { ...p, idx: idx + 1, totalDays, totalRevenue, totalCost, totalMargin, marginPerDay };
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

    if (statusFilter !== 'all') rows = rows.filter(p => p.status === statusFilter);
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
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="active">Actief</SelectItem>
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
                    <th className="text-right py-3 px-3 font-normal text-foreground whitespace-nowrap">Dagen</th>
                    <th className="text-right py-3 px-3 font-bold text-foreground whitespace-nowrap">Tarief/dag</th>
                    <th className="text-right py-3 px-3 font-normal text-white bg-primary whitespace-nowrap">Omzet</th>
                    <th className="text-right py-3 px-3 font-bold text-white bg-primary whitespace-nowrap">Marge</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Startdatum</th>
                    <th className="text-left py-3 px-3 font-bold text-foreground whitespace-nowrap">Einddatum</th>
                    <th className="text-left py-3 px-3 font-normal text-foreground whitespace-nowrap">Status</th>
                    <th className="text-right py-3 px-3 font-normal text-foreground whitespace-nowrap">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
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
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {p.totalDays > 0 ? p.totalDays : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="font-bold text-foreground">{p.client_rate ? formatCurrency(p.client_rate) : '—'}</div>
                        {p.consultant_rate > 0 && <div className="text-xs text-muted-foreground">cons: {formatCurrency(p.consultant_rate)}</div>}
                      </td>
                      <td className="py-3 px-3 text-right bg-primary/10 text-muted-foreground">
                        {p.totalRevenue > 0 ? formatCurrency(p.totalRevenue) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right bg-primary/10">
                        <div className={`font-bold ${p.totalMargin > 0 ? 'text-primary' : p.totalMargin < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {p.totalMargin !== 0 ? formatCurrency(p.totalMargin) : '—'}
                        </div>
                        {p.marginPerDay > 0 && (
                          <div className="text-xs text-muted-foreground">{formatCurrency(p.marginPerDay)}/dag</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{formatDate(p.start_date)}</td>
                      <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">
                        {p.end_date ? formatDate(p.end_date) : <span className="text-muted-foreground font-normal">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[p.status] || 'bg-muted text-muted-foreground'}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end gap-1">
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