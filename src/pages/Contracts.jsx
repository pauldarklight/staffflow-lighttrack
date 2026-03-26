import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, FileText, Search, ArrowUpDown, X, CheckCircle2, Clock, Send, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { generateContractPdf } from '@/lib/contractPdf';
import PageHeader from '@/components/shared/PageHeader';
import MonthlyOverview from '@/components/contracts/MonthlyOverview';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate, formatCurrency } from '@/lib/formatters';

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  signed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expired: 'bg-red-100 text-red-600 border-red-200',
};
const STATUS_LABELS = {
  draft: 'Concept', sent: 'Verstuurd', signed: 'Getekend', expired: 'Verlopen',
};
const TYPE_STYLES = {
  client: 'bg-primary/10 text-primary border-primary/20',
  consultant: 'bg-foreground/10 text-foreground border-foreground/20',
};
const TYPE_LABELS = { client: 'Klant', consultant: 'Consultant' };

export default function Contracts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const syncMissingContracts = async () => {
    setSyncing(true);
    let created = 0;
    for (const p of placements) {
      const existing = contracts.filter(c => c.placement_id === p.id);
      const hasClient = existing.some(c => c.contract_type === 'client');
      const hasConsultant = existing.some(c => c.contract_type === 'consultant');
      if (!hasClient) {
        await base44.entities.Contract.create({
          placement_id: p.id,
          contract_type: 'client',
          status: 'draft',
          recipient_name: p.client_company_name || '',
          recipient_email: p.client_billing_email || '',
          notes: '',
        });
        created++;
      }
      if (!hasConsultant) {
        await base44.entities.Contract.create({
          placement_id: p.id,
          contract_type: 'consultant',
          status: 'draft',
          recipient_name: `${p.consultant_first_name || ''} ${p.consultant_last_name || ''}`.trim(),
          recipient_email: '',
          notes: '',
        });
        created++;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    setSyncing(false);
    toast.success(`${created} ontbrekende contract(en) aangemaakt.`);
  };

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  });

  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const [form, setForm] = useState({
    placement_id: '', contract_type: 'client', status: 'draft',
    sent_date: '', signed_date: '', recipient_name: '', recipient_email: '', notes: '',
  });

  const resetForm = () => setForm({
    placement_id: '', contract_type: 'client', status: 'draft',
    sent_date: '', signed_date: '', recipient_name: '', recipient_email: '', notes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contracts'] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const openEdit = (contract) => {
    setEditing(contract);
    setForm({ ...contract });
    setShowForm(true);
  };

  const getPlacement = (id) => placements.find(p => p.id === id);

  // Group contracts by placement → one row per collaboration
  const collaborations = useMemo(() => {
    const map = {};
    contracts.forEach(c => {
      if (!c.placement_id) return;
      if (!map[c.placement_id]) map[c.placement_id] = { placement_id: c.placement_id, client: null, consultant: null };
      if (c.contract_type === 'client') map[c.placement_id].client = c;
      else map[c.placement_id].consultant = c;
    });
    return Object.values(map).map(col => {
      const p = getPlacement(col.placement_id);
      // Generate reference: REF-YYYY-NNN based on start date + index
      const year = p?.start_date ? new Date(p.start_date).getFullYear() : new Date().getFullYear();
      return {
        ...col,
        placement: p,
        consultantName: p ? `${p.consultant_first_name} ${p.consultant_last_name}` : '—',
        clientName: p?.client_company_name || '—',
        clientRate: p?.client_rate || 0,
        consultantRate: p?.consultant_rate || 0,
        margin: (p?.client_rate || 0) - (p?.consultant_rate || 0),
        startDate: p?.start_date || null,
        endDate: p?.end_date || null,
        year,
      };
    });
  }, [contracts, placements]);

  // Add reference numbers per year
  const collaborationsWithRef = useMemo(() => {
    const byYear = {};
    const sorted = [...collaborations].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
    return sorted.map(col => {
      byYear[col.year] = (byYear[col.year] || 0) + 1;
      const ref = `REF-${col.year}-${String(byYear[col.year]).padStart(3, '0')}`;
      return { ...col, reference: ref };
    });
  }, [collaborations]);

  const filtered = useMemo(() => {
    let rows = collaborationsWithRef;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(c =>
        c.consultantName.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        (c.reference || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      rows = rows.filter(c =>
        c.client?.status === statusFilter || c.consultant?.status === statusFilter
      );
    }
    if (typeFilter !== 'all') {
      rows = rows.filter(c => typeFilter === 'client' ? !!c.client : !!c.consultant);
    }
    return rows;
  }, [collaborationsWithRef, search, statusFilter, typeFilter]);

  const hasFilters = search || statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <div>
      <PageHeader title="Contracten" subtitle={`${collaborationsWithRef.length} samenwerkingen · ${contracts.length} contracten`}>
        <Button variant="outline" onClick={syncMissingContracts} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Bezig...' : 'Sync ontbrekende contracten'}
        </Button>
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuw Contract
        </Button>
      </PageHeader>

      <MonthlyOverview placements={placements} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-muted/40 rounded-lg border border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, klant of BTW-nr..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="draft">Concept</SelectItem>
            <SelectItem value="sent">Verstuurd</SelectItem>
            <SelectItem value="signed">Getekend</SelectItem>
            <SelectItem value="expired">Verlopen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            <SelectItem value="client">Klant</SelectItem>
            <SelectItem value="consultant">Consultant</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Contract Bewerken' : 'Nieuw Contract'}</DialogTitle>
            <DialogDescription>Koppel een contract aan een placement.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Placement *</Label>
              <Select value={form.placement_id} onValueChange={v => setForm(p => ({ ...p, placement_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecteer placement" /></SelectTrigger>
                <SelectContent>
                  {placements.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.consultant_first_name} {p.consultant_last_name} → {p.client_company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.contract_type} onValueChange={v => setForm(p => ({ ...p, contract_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Klant</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Concept</SelectItem>
                    <SelectItem value="sent">Verstuurd</SelectItem>
                    <SelectItem value="signed">Getekend</SelectItem>
                    <SelectItem value="expired">Verlopen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ontvanger naam</Label>
                <Input value={form.recipient_name} onChange={e => setForm(p => ({ ...p, recipient_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Ontvanger email</Label>
                <Input type="email" value={form.recipient_email} onChange={e => setForm(p => ({ ...p, recipient_email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datum verstuurd</Label>
                <Input type="date" value={form.sent_date} onChange={e => setForm(p => ({ ...p, sent_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Datum getekend</Label>
                <Input type="date" value={form.signed_date} onChange={e => setForm(p => ({ ...p, signed_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opmerkingen</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
              <Button type="submit">Opslaan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Collaborations Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Geen samenwerkingen gevonden" description="Pas je filters aan of maak een nieuwe placement aan.">
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuw Contract</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-bold text-foreground whitespace-nowrap">Referentie</th>
                    <th className="text-left py-3 px-4 font-bold text-foreground whitespace-nowrap">Consultant</th>
                    <th className="text-left py-3 px-4 font-bold text-foreground whitespace-nowrap">Klant</th>
                    <th className="text-left py-3 px-4 font-bold text-foreground whitespace-nowrap">Periode</th>
                    <th className="text-right py-3 px-4 font-bold text-foreground whitespace-nowrap">Tarief/dag</th>
                    <th className="text-center py-3 px-4 font-bold text-foreground whitespace-nowrap" colSpan={2}>Contracten</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(col => (
                    <tr key={col.placement_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{col.reference}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{col.consultantName}</div>
                        {col.placement?.consultant_company_name && <div className="text-xs text-muted-foreground">{col.placement.consultant_company_name}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{col.clientName}</div>
                        {col.placement?.client_vat_number && <div className="text-xs text-muted-foreground font-mono">{col.placement.client_vat_number}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        <div>{formatDate(col.startDate)}</div>
                        <div className="font-medium text-foreground">{col.endDate ? formatDate(col.endDate) : '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-foreground">{col.clientRate ? formatCurrency(col.clientRate) : '—'}</div>
                        {col.margin > 0 && <div className="text-xs text-emerald-600">+{formatCurrency(col.margin)}/dag</div>}
                      </td>
                      {/* Client contract */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${TYPE_STYLES.client}`}>Klant</Badge>
                          {col.client ? (
                            <>
                              <Badge variant="outline" className={`text-xs ${STATUS_STYLES[col.client.status]}`}>{STATUS_LABELS[col.client.status]}</Badge>
                              <Button variant="ghost" size="icon" title="Download klantcontract" onClick={() => generateContractPdf(col.client, col.placement)}>
                                <Download className="w-3.5 h-3.5 text-primary" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(col.client)}>Bewerken</Button>
                            </>
                          ) : <span className="text-xs text-muted-foreground">Ontbreekt</span>}
                        </div>
                      </td>
                      {/* Consultant contract */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${TYPE_STYLES.consultant}`}>Consultant</Badge>
                          {col.consultant ? (
                            <>
                              <Badge variant="outline" className={`text-xs ${STATUS_STYLES[col.consultant.status]}`}>{STATUS_LABELS[col.consultant.status]}</Badge>
                              <Button variant="ghost" size="icon" title="Download consultantcontract" onClick={() => generateContractPdf(col.consultant, col.placement)}>
                                <Download className="w-3.5 h-3.5 text-primary" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(col.consultant)}>Bewerken</Button>
                            </>
                          ) : <span className="text-xs text-muted-foreground">Ontbreekt</span>}
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