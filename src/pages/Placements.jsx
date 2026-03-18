import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import PlacementForm from '@/components/placements/PlacementForm';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function Placements() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: placements = [], isLoading } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list('-created_date'),
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
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = placements.filter(p => {
    const q = search.toLowerCase();
    return !q || 
      `${p.consultant_first_name} ${p.consultant_last_name}`.toLowerCase().includes(q) ||
      p.client_company_name?.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Placements" subtitle={`${placements.length} placements`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Zoeken..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Placement
        </Button>
      </PageHeader>

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

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Plus} title="Nog geen placements" description="Maak je eerste placement aan om te beginnen.">
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Nieuwe Placement</Button>
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Start</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Einde</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tarief Klant</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge/dag</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium">{p.consultant_first_name} {p.consultant_last_name}</div>
                        {p.consultant_company_name && <div className="text-xs text-muted-foreground">{p.consultant_company_name}</div>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{p.client_company_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(p.start_date)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDate(p.end_date)}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(p.client_rate)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency((p.client_rate || 0) - (p.consultant_rate || 0))}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.status} /></td>
                      <td className="py-3 px-4">
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