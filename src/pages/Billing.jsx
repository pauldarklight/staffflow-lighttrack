import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Receipt, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatCurrency, formatDate, getMonthName } from '@/lib/formatters';

export default function Billing() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date'),
  });

  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
  });

  const [form, setForm] = useState({
    placement_id: '', timesheet_id: '', invoice_type: 'client_invoice', invoice_number: '',
    amount: '', vat_amount: '', total_amount: '', status: 'draft',
    issue_date: '', due_date: '', paid_date: '', payment_terms_days: 30,
    consultant_name: '', client_company: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
  });

  const resetForm = () => setForm({
    placement_id: '', timesheet_id: '', invoice_type: 'client_invoice', invoice_number: '',
    amount: '', vat_amount: '', total_amount: '', status: 'draft',
    issue_date: '', due_date: '', paid_date: '', payment_terms_days: 30,
    consultant_name: '', client_company: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount) || 0;
    const vatAmount = parseFloat(form.vat_amount) || amount * 0.21;
    const data = {
      ...form,
      amount,
      vat_amount: vatAmount,
      total_amount: amount + vatAmount,
      month: parseInt(form.month),
      year: parseInt(form.year),
      payment_terms_days: parseInt(form.payment_terms_days) || 30,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (inv) => {
    setEditing(inv);
    setForm({ ...inv, amount: inv.amount || '', vat_amount: inv.vat_amount || '', total_amount: inv.total_amount || '' });
    setShowForm(true);
  };

  const sentAmount = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + (i.total_amount || 0), 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total_amount || 0), 0);

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    return !q || i.consultant_name?.toLowerCase().includes(q) || i.client_company?.toLowerCase().includes(q) || i.invoice_number?.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Facturatie" subtitle="Facturen beheren">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Zoeken..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Factuur
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Openstaand" value={formatCurrency(sentAmount)} icon={Receipt} />
        <StatCard title="Betaald" value={formatCurrency(paidAmount)} />
        <StatCard title="Achterstallig" value={formatCurrency(overdueAmount)} />
      </div>

      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) { setEditing(null); resetForm(); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Factuur Bewerken' : 'Nieuwe Factuur'}</DialogTitle>
            <DialogDescription>Maak of bewerk een factuur.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.invoice_type} onValueChange={v => setForm(p => ({ ...p, invoice_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_invoice">Klantfactuur</SelectItem>
                    <SelectItem value="consultant_invoice">Consultantfactuur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Factuurnummer</Label>
                <Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Consultant naam</Label>
                <Input value={form.consultant_name} onChange={e => setForm(p => ({ ...p, consultant_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Klant bedrijf</Label>
                <Input value={form.client_company} onChange={e => setForm(p => ({ ...p, client_company: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bedrag excl. BTW</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>BTW</Label>
                <Input type="number" step="0.01" value={form.vat_amount} onChange={e => setForm(p => ({ ...p, vat_amount: e.target.value }))} placeholder="Auto 21%" />
              </div>
              <div className="space-y-2">
                <Label>Betaaltermijn (dagen)</Label>
                <Input type="number" value={form.payment_terms_days} onChange={e => setForm(p => ({ ...p, payment_terms_days: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Factuurdatum</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Vervaldatum</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Concept</SelectItem>
                    <SelectItem value="sent">Verstuurd</SelectItem>
                    <SelectItem value="paid">Betaald</SelectItem>
                    <SelectItem value="overdue">Achterstallig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
              <Button type="submit">Opslaan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="Nog geen facturen" description="Maak je eerste factuur aan.">
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuwe Factuur</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nr.</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultant</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Klant</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Bedrag</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vervaldatum</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{i.invoice_number || '-'}</td>
                      <td className="py-3 px-4"><StatusBadge status={i.invoice_type} /></td>
                      <td className="py-3 px-4">{i.consultant_name || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{i.client_company || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatCurrency(i.total_amount || i.amount)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(i.due_date)}</td>
                      <td className="py-3 px-4"><StatusBadge status={i.status} /></td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>Bewerken</Button>
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