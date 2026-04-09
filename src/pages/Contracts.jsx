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
import { Plus, FileText, Search, X, Download, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { generateContractPdf } from '@/lib/contractPdf';
import PageHeader from '@/components/shared/PageHeader';

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
  const [generating, setGenerating] = useState({}); // { [contractId]: true }
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

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.Template.list(),
  });

  const [form, setForm] = useState({
    placement_id: '', contract_type: 'client', status: 'draft',
    sent_date: '', signed_date: '', recipient_name: '', recipient_email: '',
    agoria_index_client: '', agoria_index_consultant: '',
    payment_terms_client: '', payment_terms_consultant: '',
    liability_limit: '', payroll_number: '', notes: '',
  });

  const resetForm = () => setForm({
    placement_id: '', contract_type: 'client', status: 'draft',
    sent_date: '', signed_date: '', recipient_name: '', recipient_email: '',
    agoria_index_client: '', agoria_index_consultant: '',
    payment_terms_client: '', payment_terms_consultant: '',
    liability_limit: '', payroll_number: '', notes: '',
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

  const handleGenerate = async (contract, placement, template) => {
    const key = `${contract.id}-${template.id}`;
    setGenerating(g => ({ ...g, [key]: true }));
    try {
      const res = await base44.functions.invoke('generateContract', {
        placement_id: placement.id,
        contract_type: contract.contract_type,
        language: template.language || 'nl',
        template_id: template.id,
      });
      const { file_url, file_name } = res.data;
      const a = document.createElement('a');
      a.href = file_url;
      a.download = file_name;
      a.target = '_blank';
      a.click();
      toast.success(`Contract gegenereerd: ${file_name}`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Genereren mislukt');
    }
    setGenerating(g => ({ ...g, [key]: false }));
  };

  const getTemplatesForPlacement = (contractType, placement) => {
    const selectedIds = placement?.contract_template_ids || [];
    if (selectedIds.length === 0) return [];
    const relevantTypes = contractType === 'client'
      ? ['contract_client', 'contract_addendum']
      : ['contract_consultant', 'contract_subcontractor', 'contract_addendum'];
    return templates.filter(t => selectedIds.includes(t.id) && relevantTypes.includes(t.template_type));
  };

  const DownloadDropdown = ({ contract, placement }) => {
    const tpls = getTemplatesForPlacement(contract.contract_type, placement);
    const isLoading = Object.keys(generating).some(k => k.startsWith(contract.id) && generating[k]);
    if (tpls.length === 0) {
      return (
        <Button variant="ghost" size="icon" title="Geen sjablonen beschikbaar" disabled>
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-primary" />}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs">Kies sjabloon</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tpls.map(t => (
            <DropdownMenuItem key={t.id} onClick={() => handleGenerate(contract, placement, t)} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-2" />
              {t.name} <span className="ml-1 text-muted-foreground">· {t.language?.toUpperCase()}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agoria-index klant</Label>
                <Input type="number" step="0.01" placeholder="bijv. 112.34" value={form.agoria_index_client} onChange={e => setForm(p => ({ ...p, agoria_index_client: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Agoria-index consultant</Label>
                <Input type="number" step="0.01" placeholder="bijv. 112.34" value={form.agoria_index_consultant} onChange={e => setForm(p => ({ ...p, agoria_index_consultant: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Betalingstermijn klant (dagen)</Label>
                <Input type="number" min="0" placeholder="bijv. 30" value={form.payment_terms_client} onChange={e => setForm(p => ({ ...p, payment_terms_client: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Betalingstermijn consultant (dagen)</Label>
                <Input type="number" min="0" placeholder="bijv. 30" value={form.payment_terms_consultant} onChange={e => setForm(p => ({ ...p, payment_terms_consultant: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aansprakelijkheid</Label>
                <Input placeholder="bijv. max. contractwaarde" value={form.liability_limit} onChange={e => setForm(p => ({ ...p, liability_limit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Payrollnummer</Label>
                <Input placeholder="bijv. PR-2024-001" value={form.payroll_number} onChange={e => setForm(p => ({ ...p, payroll_number: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opmerkingen</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className={form.notes ? 'border-blue-400 bg-blue-50 focus-visible:ring-blue-400' : ''}
              />
              {form.notes && <p className="text-xs text-blue-600 font-medium">📝 Opmerking aanwezig</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
              <Button type="submit">Opslaan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Toggle: klant / consultant */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={typeFilter !== 'consultant' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTypeFilter('client')}
        >Klantcontracten</Button>
        <Button
          variant={typeFilter === 'consultant' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTypeFilter('consultant')}
        >Consultantcontracten</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Geen samenwerkingen gevonden" description="Pas je filters aan of maak een nieuwe placement aan.">
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuw Contract</Button>
        </EmptyState>
      ) : typeFilter === 'consultant' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Referentie</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Consultant</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Klant</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Periode</th>
                    <th className="text-right py-3 px-4 font-bold whitespace-nowrap">Pay/dag</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Agoria-index</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Betalingstermijn</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Payroll nr.</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Status</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {collaborationsWithRef.filter(col => {
                    if (search) { const q = search.toLowerCase(); return col.consultantName.toLowerCase().includes(q) || col.clientName.toLowerCase().includes(q); }
                    return true;
                  }).map(col => (
                    <tr key={col.placement_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4"><span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{col.reference}</span></td>
                      <td className="py-3 px-4"><div className="font-bold">{col.consultantName}</div>{col.placement?.consultant_company_name && <div className="text-xs text-muted-foreground">{col.placement.consultant_company_name}</div>}</td>
                      <td className="py-3 px-4"><div className="font-bold">{col.clientName}</div></td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap"><div>{formatDate(col.startDate)}</div><div className="font-medium text-foreground">{col.endDate ? formatDate(col.endDate) : '—'}</div></td>
                      <td className="py-3 px-4 text-right"><div className="font-bold">{col.consultantRate ? formatCurrency(col.consultantRate) : '—'}</div></td>
                      <td className="py-3 px-4 text-xs font-mono font-bold">{col.consultant?.agoria_index_consultant || col.placement?.agoria_index_consultant || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 px-4 text-xs">{col.placement?.payment_terms_consultant ? <span className="font-semibold">{col.placement.payment_terms_consultant}d</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 px-4 text-xs">{col.placement?.payroll_number ? <span className="font-mono font-bold">{col.placement.payroll_number}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 px-4">{col.consultant ? <Badge variant="outline" className={`text-xs ${STATUS_STYLES[col.consultant.status]}`}>{STATUS_LABELS[col.consultant.status]}</Badge> : <span className="text-xs text-red-500 font-medium">Ontbreekt</span>}</td>
                      <td className="py-3 px-4"><div className="flex items-center gap-1">{col.consultant && <DownloadDropdown contract={col.consultant} placement={col.placement} />}{col.consultant && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(col.consultant)}>Bewerken</Button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Referentie</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Consultant</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Klant</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Periode</th>
                    <th className="text-right py-3 px-4 font-bold whitespace-nowrap">Bill/dag</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Agoria-index</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Betalingstermijn</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Aansprakelijkheid</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Status</th>
                    <th className="text-left py-3 px-4 font-bold whitespace-nowrap">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {collaborationsWithRef.filter(col => {
                    if (search) { const q = search.toLowerCase(); return col.consultantName.toLowerCase().includes(q) || col.clientName.toLowerCase().includes(q); }
                    return true;
                  }).map(col => (
                    <tr key={col.placement_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4"><span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{col.reference}</span></td>
                      <td className="py-3 px-4"><div className="font-bold">{col.consultantName}</div>{col.placement?.consultant_company_name && <div className="text-xs text-muted-foreground">{col.placement.consultant_company_name}</div>}</td>
                      <td className="py-3 px-4"><div className="font-bold">{col.clientName}</div>{col.placement?.client_vat_number && <div className="text-xs text-muted-foreground font-mono">{col.placement.client_vat_number}</div>}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap"><div>{formatDate(col.startDate)}</div><div className="font-medium text-foreground">{col.endDate ? formatDate(col.endDate) : '—'}</div></td>
                      <td className="py-3 px-4 text-right"><div className="font-bold">{col.clientRate ? formatCurrency(col.clientRate) : '—'}</div></td>
                      <td className="py-3 px-4 text-xs font-mono font-bold">{col.client?.agoria_index_client || col.placement?.agoria_index_client || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 px-4 text-xs">{col.placement?.payment_terms_client ? <span className="font-semibold">{col.placement.payment_terms_client}d</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 px-4 text-xs">{col.placement?.liability_limit || <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-3 px-4">{col.client ? <Badge variant="outline" className={`text-xs ${STATUS_STYLES[col.client.status]}`}>{STATUS_LABELS[col.client.status]}</Badge> : <span className="text-xs text-red-500 font-medium">Ontbreekt</span>}</td>
                      <td className="py-3 px-4"><div className="flex items-center gap-1">{col.client && <DownloadDropdown contract={col.client} placement={col.placement} />}{col.client && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(col.client)}>Bewerken</Button>}</div></td>
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