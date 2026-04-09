import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const TYPE_LABELS = {
  contract_client: 'Contract Klant',
  contract_consultant: 'Contract Consultant',
  contract_subcontractor: 'Contract Onderaannemer',
  contract_addendum: 'Addendum',
  invoice_client: 'Factuur Klant',
  invoice_consultant: 'Factuur Consultant',
};

export default function PlacementForm({ placement, onSave, onCancel }) {
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.Template.list('-created_date'),
  });

  const [form, setForm] = useState(placement || {
    placement_type: 'freelancer',
    consultant_first_name: '',
    consultant_last_name: '',
    job_title: '',
    job_description: '',
    consultant_company_name: '',
    consultant_company_address: '',
    consultant_vat_number: '',
    consultant_company_representative: '',

    consultant_personal_address: '',
    consultant_contact_name: '',
    consultant_contact_email: '',
    consultant_contact_phone: '',
    start_date: '',
    end_date: '',
    extensions: [],
    consultant_rate: '',
    client_rate: '',
    agoria_index_client: '',
    agoria_index_consultant: '',
    payment_terms_client: placement?.payment_terms_client || '',
    payment_terms_consultant: placement?.payment_terms_consultant || '',
    notice_period_client: placement?.notice_period_client || '',
    notice_period_consultant: placement?.notice_period_consultant || '',
    liability_limit: placement?.liability_limit || '',
    payroll_number: placement?.payroll_number || '',
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
    contract_template_ids: placement?.contract_template_ids || [],
    invoice_template_ids: placement?.invoice_template_ids || [],
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
            <div className="space-y-2">
              <Label>Functietitel</Label>
              {(() => {
                const presets = ['Data Analist', 'Data Engineer', 'Data Scientist', 'Data Architect', 'BI Analist', 'Analytics Engineer'];
                const isCustom = form.job_title && !presets.includes(form.job_title);
                return (
                  <>
                    <Select
                      value={isCustom ? '__custom__' : (form.job_title || '')}
                      onValueChange={v => { if (v !== '__custom__') updateField('job_title', v); else updateField('job_title', ''); }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecteer functie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Data Analist">Data Analist</SelectItem>
                        <SelectItem value="Data Engineer">Data Engineer</SelectItem>
                        <SelectItem value="Data Scientist">Data Scientist</SelectItem>
                        <SelectItem value="Data Architect">Data Architect</SelectItem>
                        <SelectItem value="BI Analist">BI Analist</SelectItem>
                        <SelectItem value="Analytics Engineer">Analytics Engineer</SelectItem>
                        <SelectItem value="__custom__">Andere (zelf invoeren)</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCustom && (
                      <Input
                        placeholder="Typ een functietitel..."
                        value={form.job_title}
                        onChange={e => updateField('job_title', e.target.value)}
                        className="mt-2"
                        autoFocus
                      />
                    )}
                  </>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Functieomschrijving
                <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📄 wordt gekopieerd naar contract</span>
              </Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Beschrijf de rol in woorden, bijv: De consultant zal instaan voor de implementatie van data pipelines en rapportage-oplossingen..."
                value={form.job_description || ''}
                onChange={e => updateField('job_description', e.target.value)}
              />
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
                <div className="space-y-2">
                  <Label>Vertegenwoordiger firma consultant</Label>
                  <Input value={form.consultant_company_representative || ''} onChange={e => updateField('consultant_company_representative', e.target.value)} placeholder="bijv. Jan Janssen (zaakvoerder)" />
                </div>
                </>
                )}
                <div className="space-y-2">
                <Label>Persoonlijk adres consultant</Label>
                <Input value={form.consultant_personal_address || ''} onChange={e => updateField('consultant_personal_address', e.target.value)} placeholder="Straat 1, 1000 Brussel" />
                </div>
                <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Contactpersoon (optioneel)</p>
                <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Naam contactpersoon</Label>
                  <Input value={form.consultant_contact_name || ''} onChange={e => updateField('consultant_contact_name', e.target.value)} placeholder="Jan Janssen" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail contactpersoon</Label>
                    <Input type="email" value={form.consultant_contact_email || ''} onChange={e => updateField('consultant_contact_email', e.target.value)} placeholder="jan@bedrijf.be" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefoon contactpersoon</Label>
                    <Input value={form.consultant_contact_phone || ''} onChange={e => updateField('consultant_contact_phone', e.target.value)} placeholder="+32 4xx xx xx xx" />
                  </div>
                </div>
                </div>
                </div>
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
            {!isPerm && (
            <div className="space-y-2">
              <Label>E-mail timesheet-verantwoordelijke klant</Label>
              <Input type="email" placeholder="bijv. approve@klant.be" value={form.client_timesheet_approver_email || ''} onChange={e => updateField('client_timesheet_approver_email', e.target.value)} />
              <p className="text-xs text-muted-foreground">Persoon bij de klant die timesheets controleert en goedkeurt.</p>
            </div>
            )}
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

        {/* Contractinformatie */}
        {!isPerm && (
          <Card>
            <CardHeader><CardTitle className="text-base">Contractinformatie</CardTitle></CardHeader>
            <CardContent className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Betalingstermijn klant (dagen)</Label>
                  <Input type="number" min="0" placeholder="bijv. 30" value={form.payment_terms_client || ''} onChange={e => updateField('payment_terms_client', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Betalingstermijn consultant (dagen)</Label>
                  <Input type="number" min="0" placeholder="bijv. 30" value={form.payment_terms_consultant || ''} onChange={e => updateField('payment_terms_consultant', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Opzegtermijn klant</Label>
                  <Input placeholder="bijv. 30 dagen" value={form.notice_period_client || ''} onChange={e => updateField('notice_period_client', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Opzegtermijn consultant</Label>
                  <Input placeholder="bijv. 30 dagen" value={form.notice_period_consultant || ''} onChange={e => updateField('notice_period_consultant', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Aansprakelijkheid</Label>
                  <Input placeholder="bijv. max. contractwaarde" value={form.liability_limit || ''} onChange={e => updateField('liability_limit', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Payrollnummer</Label>
                  <Input placeholder="bijv. PR-2024-001" value={form.payroll_number || ''} onChange={e => updateField('payroll_number', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Afwervingsboete</Label>
                  <Input placeholder="bijv. 3 maanden salaris" value={form.afwervingsboete || ''} onChange={e => updateField('afwervingsboete', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Garantieperiode</Label>
                  <Input placeholder="bijv. 3 maanden" value={form.garantieperiode || ''} onChange={e => updateField('garantieperiode', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Afwijkingsnota / bijzondere bepalingen</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Bijzondere bepalingen of afwijkingen van de standaardcontractvoorwaarden..."
                  value={form.afwijkingsnota || ''}
                  onChange={e => updateField('afwijkingsnota', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Contract sjablonen */}
        <Card>
          <CardHeader><CardTitle className="text-base">Sjablonen die automatisch moeten worden ingevuld</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {templates.filter(t => !['invoice_client','invoice_consultant'].includes(t.template_type)).length === 0 && (
              <p className="text-sm text-muted-foreground">Geen contractsjablonen beschikbaar</p>
            )}
            {templates.filter(t => !['invoice_client','invoice_consultant'].includes(t.template_type)).map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <Checkbox
                  id={`ct-${t.id}`}
                  checked={(form.contract_template_ids || []).includes(t.id)}
                  onCheckedChange={checked => {
                    const ids = form.contract_template_ids || [];
                    updateField('contract_template_ids', checked ? [...ids, t.id] : ids.filter(id => id !== t.id));
                  }}
                />
                <label htmlFor={`ct-${t.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[t.template_type]} · {t.language?.toUpperCase()}{t.is_active ? ' · ✓' : ''}</span>
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Factuur sjablonen */}
        <Card>
          <CardHeader><CardTitle className="text-base">Facturen die automatisch worden aangemaakt</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {templates.filter(t => ['invoice_client','invoice_consultant'].includes(t.template_type)).length === 0 && (
              <p className="text-sm text-muted-foreground">Geen factuursjablonen beschikbaar</p>
            )}
            {templates.filter(t => ['invoice_client','invoice_consultant'].includes(t.template_type)).map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <Checkbox
                  id={`it-${t.id}`}
                  checked={(form.invoice_template_ids || []).includes(t.id)}
                  onCheckedChange={checked => {
                    const ids = form.invoice_template_ids || [];
                    updateField('invoice_template_ids', checked ? [...ids, t.id] : ids.filter(id => id !== t.id));
                  }}
                />
                <label htmlFor={`it-${t.id}`} className="text-sm cursor-pointer flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[t.template_type]} · {t.language?.toUpperCase()}{t.is_active ? ' · ✓' : ''}</span>
                </label>
              </div>
            ))}
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