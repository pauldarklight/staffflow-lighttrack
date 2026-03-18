import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Clock, Search } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatCurrency, getMonthName } from '@/lib/formatters';

export default function Timesheets() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const queryClient = useQueryClient();

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date'),
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

  const filtered = timesheets.filter(t => 
    t.month === parseInt(filterMonth) && t.year === parseInt(filterYear)
  );

  const totalRevenue = filtered.reduce((s, t) => s + (t.client_revenue || 0), 0);
  const totalCost = filtered.reduce((s, t) => s + (t.consultant_revenue || 0), 0);
  const totalMargin = filtered.reduce((s, t) => s + (t.margin || 0), 0);

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  return (
    <div>
      <PageHeader title="Timesheets" subtitle="Maandelijkse uren & omzet bijhouden">
        <Button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Timesheet
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-6">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({length: 12}, (_, i) => (
              <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Omzet" value={formatCurrency(totalRevenue)} />
        <StatCard title="Kost" value={formatCurrency(totalCost)} />
        <StatCard title="Marge" value={formatCurrency(totalMargin)} />
      </div>

      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) { setEditing(null); resetForm(); }}}>
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
                    {Array.from({length: 12}, (_, i) => (
                      <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultant</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Klant</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagen</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{t.consultant_name || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{t.client_company || '-'}</td>
                      <td className="py-3 px-4 text-right">{t.days_worked || 0}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(t.client_revenue)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(t.consultant_revenue)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(t.margin)}</td>
                      <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Bewerken</Button>
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