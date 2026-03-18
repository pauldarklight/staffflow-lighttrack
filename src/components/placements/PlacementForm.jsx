import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X } from 'lucide-react';

export default function PlacementForm({ placement, onSave, onCancel }) {
  const [form, setForm] = useState(placement || {
    consultant_first_name: '',
    consultant_last_name: '',
    consultant_company_name: '',
    consultant_company_address: '',
    consultant_vat_number: '',
    start_date: '',
    end_date: '',
    consultant_rate: '',
    client_rate: '',
    sales_contributors: [],
    client_company_name: '',
    client_address: '',
    client_vat_number: '',
    client_billing_email: '',
    status: 'active',
    vincere_id: '',
  });

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addContributor = () => {
    setForm(prev => ({
      ...prev,
      sales_contributors: [...(prev.sales_contributors || []), { name: '', percentage: 0 }]
    }));
  };

  const updateContributor = (idx, field, value) => {
    const updated = [...(form.sales_contributors || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm(prev => ({ ...prev, sales_contributors: updated }));
  };

  const removeContributor = (idx) => {
    setForm(prev => ({
      ...prev,
      sales_contributors: prev.sales_contributors.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...form,
      consultant_rate: parseFloat(form.consultant_rate) || 0,
      client_rate: parseFloat(form.client_rate) || 0,
      sales_contributors: (form.sales_contributors || []).map(c => ({
        ...c,
        percentage: parseFloat(c.percentage) || 0
      })),
    };
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Consultant</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Voornaam *</Label>
                <Input value={form.consultant_first_name} onChange={e => updateField('consultant_first_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Achternaam *</Label>
                <Input value={form.consultant_last_name} onChange={e => updateField('consultant_last_name', e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bedrijfsnaam (freelancer)</Label>
              <Input value={form.consultant_company_name} onChange={e => updateField('consultant_company_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Adres bedrijf</Label>
              <Input value={form.consultant_company_address} onChange={e => updateField('consultant_company_address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>BTW nummer</Label>
              <Input value={form.consultant_vat_number} onChange={e => updateField('consultant_vat_number', e.target.value)} placeholder="BE0123.456.789" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Klant</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bedrijfsnaam *</Label>
              <Input value={form.client_company_name} onChange={e => updateField('client_company_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Adres</Label>
              <Input value={form.client_address} onChange={e => updateField('client_address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>BTW nummer</Label>
              <Input value={form.client_vat_number} onChange={e => updateField('client_vat_number', e.target.value)} placeholder="BE0123.456.789" />
            </div>
            <div className="space-y-2">
              <Label>Facturatiemail / Peppol</Label>
              <Input value={form.client_billing_email} onChange={e => updateField('client_billing_email', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tarieven & Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Startdatum *</Label>
                <Input type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Einddatum</Label>
                <Input type="date" value={form.end_date} onChange={e => updateField('end_date', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tarief Consultant (€/dag) *</Label>
                <Input type="number" step="0.01" value={form.consultant_rate} onChange={e => updateField('consultant_rate', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Tarief Klant (€/dag) *</Label>
                <Input type="number" step="0.01" value={form.client_rate} onChange={e => updateField('client_rate', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => updateField('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actief</SelectItem>
                    <SelectItem value="ended">Beëindigd</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vincere ID</Label>
                <Input value={form.vincere_id} onChange={e => updateField('vincere_id', e.target.value)} placeholder="Optioneel" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Sales Contributors</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addContributor}>
              <Plus className="w-4 h-4 mr-1" /> Toevoegen
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(form.sales_contributors || []).map((c, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Input 
                  placeholder="Naam" 
                  value={c.name} 
                  onChange={e => updateContributor(idx, 'name', e.target.value)}
                  className="flex-1"
                />
                <Input 
                  type="number" 
                  placeholder="%" 
                  value={c.percentage} 
                  onChange={e => updateContributor(idx, 'percentage', e.target.value)}
                  className="w-20"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeContributor(idx)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(!form.sales_contributors || form.sales_contributors.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">Geen sales contributors toegevoegd</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-1" /> Annuleren</Button>
        <Button type="submit"><Save className="w-4 h-4 mr-1" /> Opslaan</Button>
      </div>
    </form>
  );
}