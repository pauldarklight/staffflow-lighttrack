import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, FileText, Upload, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/formatters';

export default function Contracts() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  });

  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const [form, setForm] = useState({ placement_id: '', contract_type: 'client', status: 'draft', sent_date: '', signed_date: '', recipient_name: '', recipient_email: '', notes: '' });

  const resetForm = () => setForm({ placement_id: '', contract_type: 'client', status: 'draft', sent_date: '', signed_date: '', recipient_name: '', recipient_email: '', notes: '' });

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
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (contract) => {
    setEditing(contract);
    setForm({ ...contract });
    setShowForm(true);
  };

  const getPlacementLabel = (id) => {
    const p = placements.find(pl => pl.id === id);
    return p ? `${p.consultant_first_name} ${p.consultant_last_name} → ${p.client_company_name}` : id;
  };

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase();
    return !q || getPlacementLabel(c.placement_id).toLowerCase().includes(q) || c.recipient_name?.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Contracten" subtitle={`${contracts.length} contracten`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Zoeken..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuw Contract
        </Button>
      </PageHeader>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditing(null); resetForm(); }}}>
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

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Nog geen contracten" description="Maak contracten aan voor je placements.">
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuw Contract</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Placement</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ontvanger</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Verstuurd</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{getPlacementLabel(c.placement_id)}</td>
                      <td className="py-3 px-4"><StatusBadge status={c.contract_type} /></td>
                      <td className="py-3 px-4 text-muted-foreground">{c.recipient_name || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(c.sent_date)}</td>
                      <td className="py-3 px-4"><StatusBadge status={c.status} /></td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Bewerken</Button>
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