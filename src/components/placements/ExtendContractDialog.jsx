import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/formatters';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function ExtendContractDialog({ placement, open, onClose, onSave }) {
  const currentConsultantRate = placement?.consultant_rate || 0;
  const currentClientRate = placement?.client_rate || 0;
  const currentMargin = currentClientRate - currentConsultantRate;

  const [form, setForm] = useState({
    extended_on: new Date().toISOString().split('T')[0],
    new_end_date: '',
    consultant_rate: currentConsultantRate,
    client_rate: currentClientRate,
    notes: '',
  });

  const newMargin = (parseFloat(form.client_rate) || 0) - (parseFloat(form.consultant_rate) || 0);
  const rateChanged = parseFloat(form.consultant_rate) !== currentConsultantRate || parseFloat(form.client_rate) !== currentClientRate;

  const handleSave = () => {
    const extension = {
      extended_on: form.extended_on,
      new_end_date: form.new_end_date,
      consultant_rate: parseFloat(form.consultant_rate) || currentConsultantRate,
      client_rate: parseFloat(form.client_rate) || currentClientRate,
      notes: form.notes,
    };
    const updatedExtensions = [...(placement.extensions || []), extension];
    const updateData = {
      extensions: updatedExtensions,
      consultant_rate: parseFloat(form.consultant_rate) || currentConsultantRate,
      client_rate: parseFloat(form.client_rate) || currentClientRate,
    };
    onSave(updateData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Contract verlengen
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {placement?.consultant_first_name} {placement?.consultant_last_name} — {placement?.client_company_name}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Datum verlenging</Label>
              <Input type="date" value={form.extended_on} onChange={e => setForm(f => ({ ...f, extended_on: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nieuwe einddatum *</Label>
              <Input type="date" value={form.new_end_date} onChange={e => setForm(f => ({ ...f, new_end_date: e.target.value }))} required />
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarieven</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Tarief consultant (€/dag)</Label>
                <Input type="number" step="0.01" value={form.consultant_rate}
                  onChange={e => setForm(f => ({ ...f, consultant_rate: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Huidig: {formatCurrency(currentConsultantRate)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Tarief klant (€/dag)</Label>
                <Input type="number" step="0.01" value={form.client_rate}
                  onChange={e => setForm(f => ({ ...f, client_rate: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Huidig: {formatCurrency(currentClientRate)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Marge per dag:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground line-through">{formatCurrency(currentMargin)}</span>
                <span className={`text-sm font-bold ${newMargin > currentMargin ? 'text-emerald-600' : newMargin < currentMargin ? 'text-red-600' : 'text-foreground'}`}>
                  {formatCurrency(newMargin)}
                </span>
              </div>
            </div>

            {rateChanged && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Tarieven worden aangepast. De placement wordt bijgewerkt met de nieuwe tarieven.</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Opmerking bij verlenging</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Optionele opmerking..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={handleSave} disabled={!form.new_end_date}>
            <RefreshCw className="w-4 h-4 mr-1" /> Verlengen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}