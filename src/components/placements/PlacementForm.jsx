import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function PlacementForm({ placement, onSave, onCancel }) {
  const [form, setForm] = useState(placement || {
    placement_type: 'freelancer',
    consultant_first_name: '',
    consultant_last_name: '',
    consultant_company_name: '',
    consultant_company_address: '',
    consultant_vat_number: '',
    start_date: '',
    end_date: '',
    extensions: [],
    consultant_rate: '',
    client_rate: '',
    agoria_index_client: '',
    agoria_index_consultant: '',
    perm_annual_salary: '',
    perm_fee_percentage: 20,
    perm_fee_amount: '',
    sales_contributors: [],
    client_company_name: '',
    client_address: '',
    client_vat_number: '',
    client_billing_email: '',
    notes: '',
    status: 'active',
    vincere_id: '',
    contract_type: 'contract_client',
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
    const annualSalary = parseFloat(form.perm_annual_salary) || 0;
    const feePerc = parseFloat(form.perm_fee_percentage) || 20;
    const data = {
      ...form,
      consultant_rate: parseFloat(form.consultant_rate) || 0,
      client_rate: parseFloat(form.client_rate) || 0,
      agoria_index_client: parseFloat(form.agoria_index_client) || null,
      agoria_index_consultant: parseFloat(form.agoria_index_consultant) || null,
      perm_annual_salary: annualSalary,
      perm_fee_percentage: feePerc,
      perm_fee_amount: form.placement_type === 'perm' ? annualSalary * (feePerc / 100) : 0,
      extensions: form.extensions || [],
      sales_contributors: (form.sales_contributors || []).map(c => ({
        ...c,
        percentage: parseFloat(c.percentage) || 0
      })),
    };
    onSave(data);
  };

  const isPerm = form.placement_type === 'perm';
  const permFee = (parseFloat(form.perm_annual_salary) || 0) * ((parseFloat(form.perm_fee_percentage) || 20) / 100);

  return (
    <form onSubmit={handleSubmit}>
      {/* Type selector */}
      <div className="mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <Label>Type placement *</Label>
              <Select value={form.placement_type || 'freelancer'} onValueChange={v => updateField('placement_type', v)}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="perm">PERM (vaste aanwerving)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consultant */}
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
            {!isPerm && (
              <>
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Klant */}
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <span>📋</span> Referentie-instructies factuur/bestelbon
              </Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Bijv: Referentie moet beginnen met PO- gevolgd door het projectnummer. Formaat: PO-XXXXXX"
                value={form.reference_instructions || ''}
                onChange={e => updateField('reference_instructions', e.target.value)}
              />
              {form.reference_instructions && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                  <span className="text-base leading-none">⚠️</span>
                  <span><strong>Herinnering actief:</strong> bij het aanmaken van facturen of bestelbonnen voor deze klant zal een melding verschijnen.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tarieven */}
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

            {!isPerm && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tarief Consultant (€/dag) *</Label>
                    <Input type="number" step="0.01" value={form.consultant_rate} onChange={e => updateField('consultant_rate', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tarief Klant (€/dag) *</Label>
                    <Input type="number" step="0.01" value={form.client_rate} onChange={e => updateField('client_rate', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agoria-index klant</Label>
                    <Input type="number" step="0.01" value={form.agoria_index_client || ''} onChange={e => updateField('agoria_index_client', e.target.value)} placeholder="bijv. 110.25" />
                  </div>
                  <div className="space-y-2">
                    <Label>Agoria-index consultant</Label>
                    <Input type="number" step="0.01" value={form.agoria_index_consultant || ''} onChange={e => updateField('agoria_index_consultant', e.target.value)} placeholder="bijv. 108.50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dagen per week *</Label>
                  <Select value={String(form.days_per_week || 5)} onValueChange={v => updateField('days_per_week', parseFloat(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5/5 — voltijds</SelectItem>
                      <SelectItem value="4">4/5 — 4 dagen/week</SelectItem>
                      <SelectItem value="3">3/5 — 3 dagen/week</SelectItem>
                      <SelectItem value="2.5">2.5/5 — halftijds</SelectItem>
                      <SelectItem value="2">2/5 — 2 dagen/week</SelectItem>
                      <SelectItem value="1">1/5 — 1 dag/week</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Bepaalt het verwacht aantal werkdagen per maand in het maandoverzicht.</p>
                </div>
              </div>
            )}

            {isPerm && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jaarloon kandidaat (€)</Label>
                    <Input type="number" step="0.01" value={form.perm_annual_salary} onChange={e => updateField('perm_annual_salary', e.target.value)} placeholder="bijv. 60000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fee % (standaard 20%)</Label>
                    <Input type="number" step="0.1" value={form.perm_fee_percentage} onChange={e => updateField('perm_fee_percentage', e.target.value)} />
                  </div>
                </div>
                {form.perm_annual_salary && (
                  <div className="bg-primary/10 rounded-lg p-3 text-sm">
                    <span className="text-muted-foreground">Eenmalige fee aan klant: </span>
                    <span className="font-bold text-primary">{formatCurrency(permFee)}</span>
                  </div>
                )}
              </div>
            )}

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

        {/* Verlengingen */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Verlengingen</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setForm(prev => ({
                ...prev,
                extensions: [...(prev.extensions || []), { extended_on: '', new_end_date: '', notes: '' }]
              }));
            }}>
              <Plus className="w-4 h-4 mr-1" /> Verlenging toevoegen
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(form.extensions || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Geen verlengingen geregistreerd</p>
            )}
            {(form.extensions || []).map((ext, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Datum verlenging</label>
                  <Input type="date" value={ext.extended_on} onChange={e => {
                    const updated = [...(form.extensions || [])];
                    updated[idx] = { ...updated[idx], extended_on: e.target.value };
                    setForm(p => ({ ...p, extensions: updated }));
                  }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Nieuwe einddatum</label>
                  <Input type="date" value={ext.new_end_date} onChange={e => {
                    const updated = [...(form.extensions || [])];
                    updated[idx] = { ...updated[idx], new_end_date: e.target.value };
                    setForm(p => ({ ...p, extensions: updated }));
                  }} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => {
                  setForm(p => ({ ...p, extensions: p.extensions.filter((_, i) => i !== idx) }));
                }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contract */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contract</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kies type contract</Label>
              <Select value={form.contract_type || 'contract_client'} onValueChange={v => updateField('contract_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contract_client">Contract Klant</SelectItem>
                  <SelectItem value="contract_consultant">Contract Consultant</SelectItem>
                  <SelectItem value="contract_subcontractor">Contract Onderaannemer</SelectItem>
                  <SelectItem value="contract_addendum">Addendum</SelectItem>
                  <SelectItem value="invoice_client">Factuur Klant</SelectItem>
                  <SelectItem value="invoice_consultant">Factuur Consultant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sales Contributors */}
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
                <Input placeholder="Naam" value={c.name} onChange={e => updateContributor(idx, 'name', e.target.value)} className="flex-1" />
                <Input type="number" placeholder="%" value={c.percentage} onChange={e => updateContributor(idx, 'percentage', e.target.value)} className="w-20" />
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

      {/* Opmerkingen */}
      <Card className={`mt-6 ${form.notes ? 'border-amber-300 bg-amber-50/30' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-base flex items-center gap-2 ${form.notes ? 'text-amber-700' : ''}`}>
            {form.notes ? '💬' : '📝'} Extra Opmerkingen
            {form.notes && <span className="text-xs font-normal text-amber-600">(ingevuld)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Bijv: specifieke afspraken, escalatiepunten, aandachtspunten..."
            value={form.notes || ''}
            onChange={e => updateField('notes', e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Button type="button" variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-1" /> Annuleren</Button>
        <Button type="submit"><Save className="w-4 h-4 mr-1" /> Opslaan</Button>
      </div>
    </form>
  );
}