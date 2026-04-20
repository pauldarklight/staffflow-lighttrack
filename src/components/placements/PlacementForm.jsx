import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, X, RefreshCw, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import AddressFields, { composeAddress } from './AddressFields';
import VatLookupInput from './VatLookupInput';
import SalesContributorField from './SalesContributorField';
import FormSection from './FormSection';
import InfoTooltip from './InfoTooltip';

const TYPE_LABELS = {
  contract_client: 'Contract Klant',
  contract_consultant: 'Contract Consultant',
  contract_subcontractor: 'Contract Onderaannemer',
  contract_addendum: 'Addendum',
  invoice_client: 'Factuur Klant',
  invoice_consultant: 'Factuur Consultant',
};

// Which template types are relevant per placement type
const RELEVANT_CONTRACT_TYPES = {
  freelancer: ['contract_client', 'contract_consultant', 'contract_subcontractor', 'contract_addendum'],
  perm: ['contract_client', 'contract_addendum'],
};
const RELEVANT_INVOICE_TYPES = {
  freelancer: ['invoice_client', 'invoice_consultant'],
  perm: ['invoice_client'],
};

function parseAddr(str) {
  if (!str) return { street: '', number: '', bus: '', postal_code: '', city: '', country: '' };
  const parts = str.split(',').map(s => s.trim());
  const firstPart = parts[0] || '';
  const busMatch = firstPart.match(/\bbus\s+(\S+)/i);
  const bus = busMatch ? busMatch[1] : '';
  const withoutBus = firstPart.replace(/\bbus\s+\S+/i, '').trim();
  const tokens = withoutBus.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];
  const isNum = /^\d+[A-Za-z]?$/.test(lastToken);
  const number = isNum ? lastToken : '';
  const street = isNum ? tokens.slice(0, -1).join(' ') : withoutBus;
  const secondPart = parts[1] || '';
  const pcMatch = secondPart.match(/^(\d{4,5})\s+(.+)$/);
  const postal_code = pcMatch ? pcMatch[1] : '';
  const city = pcMatch ? pcMatch[2] : secondPart;
  const country = parts[2] || '';
  return { street, number, bus, postal_code, city, country };
}

function parseRepFirst(str) { if (!str) return ''; return str.trim().split(' ')[0] || ''; }
function parseRepLast(str) { if (!str) return ''; const p = str.trim().split(' '); return p.slice(1).join(' '); }

const DRAFT_KEY = 'placement_draft';

export default function PlacementForm({ placement, onSave, onCancel }) {
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.Template.list('-created_date'),
  });

  const isNew = !placement?.id;
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimerRef = useRef(null);

  const getInitial = () => {
    if (!isNew) return placement;
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (draft) return draft;
    } catch {}
    return null;
  };

  const [form, setForm] = useState(getInitial() || {
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
    afwervingsboete: placement?.afwervingsboete || '',
    garantieperiode: placement?.garantieperiode || '',
    afwijkingsnota: placement?.afwijkingsnota || '',
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

  const [personalAddr, setPersonalAddr] = useState(() => parseAddr(placement?.consultant_personal_address));
  const [companyAddr, setCompanyAddr] = useState(() => parseAddr(placement?.consultant_company_address));
  const [clientAddr, setClientAddr] = useState(() => parseAddr(placement?.client_address));
  const [companyAddrSameAsPersonal, setCompanyAddrSameAsPersonal] = useState(!placement?.consultant_company_address);
  const [repFirstName, setRepFirstName] = useState(() => parseRepFirst(placement?.consultant_company_representative));
  const [repLastName, setRepLastName] = useState(() => parseRepLast(placement?.consultant_company_representative));

  useEffect(() => {
    if (companyAddrSameAsPersonal) setCompanyAddr(personalAddr);
  }, [personalAddr, companyAddrSameAsPersonal]);

  const triggerAutosave = useCallback((currentForm) => {
    if (!isNew) return;
    clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(currentForm));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 800);
  }, [isNew]);

  useEffect(() => { triggerAutosave(form); }, [form, triggerAutosave]);

  const updatePersonalAddr = (field, value) => setPersonalAddr(prev => ({ ...prev, [field]: value }));
  const updateCompanyAddr = (field, value) => { setCompanyAddrSameAsPersonal(false); setCompanyAddr(prev => ({ ...prev, [field]: value })); };
  const updateClientAddr = (field, value) => setClientAddr(prev => ({ ...prev, [field]: value }));
  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const parseVatAddress = (address_lines) => {
    const combined = address_lines.join(', ');
    const parts = combined.split(',').map(s => s.trim());
    const firstPart = parts[0] || '';
    const busMatch = firstPart.match(/\bbus\s+(\S+)/i);
    const bus = busMatch ? busMatch[1] : '';
    const withoutBus = firstPart.replace(/\bbus\s+\S+/i, '').trim();
    const tokens = withoutBus.split(/\s+/);
    const lastToken = tokens[tokens.length - 1];
    const isNum = /^\d+[A-Za-z]?$/.test(lastToken);
    const number = isNum ? lastToken : '';
    const street = isNum ? tokens.slice(0, -1).join(' ') : withoutBus;
    const secondPart = parts[1] || '';
    const pcMatch = secondPart.match(/^(\d{4,5})\s+(.+)$/);
    return { street, number, bus, postal_code: pcMatch ? pcMatch[1] : '', city: pcMatch ? pcMatch[2] : secondPart, country: parts[2] || '' };
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalPct = (form.sales_contributors || []).reduce((s, c) => s + (parseFloat(c.percentage) || 0), 0);
    if (totalPct > 100) { alert('Sales contributors totaal mag niet boven 100% uitkomen.'); return; }
    const annualSalary = parseFloat(form.perm_annual_salary) || 0;
    const feePerc = parseFloat(form.perm_fee_percentage) || 20;
    const repFull = [repFirstName, repLastName].filter(Boolean).join(' ');
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
      sales_contributors: (form.sales_contributors || []).map(c => ({ ...c, percentage: parseFloat(c.percentage) || 0 })),
      consultant_personal_address: composeAddress(personalAddr),
      consultant_company_address: composeAddress(companyAddr),
      client_address: composeAddress(clientAddr),
      consultant_company_representative: repFull,
    };
    if (isNew) localStorage.removeItem(DRAFT_KEY);
    onSave(data);
  };

  const isPerm = form.placement_type === 'perm';
  const permFee = (parseFloat(form.perm_annual_salary) || 0) * ((parseFloat(form.perm_fee_percentage) || 20) / 100);

  const relevantContractTypes = RELEVANT_CONTRACT_TYPES[form.placement_type] || RELEVANT_CONTRACT_TYPES.freelancer;
  const relevantInvoiceTypes = RELEVANT_INVOICE_TYPES[form.placement_type] || RELEVANT_INVOICE_TYPES.freelancer;
  const contractTemplates = templates.filter(t => relevantContractTypes.includes(t.template_type));
  const invoiceTemplates = templates.filter(t => relevantInvoiceTypes.includes(t.template_type));

  const presets = ['Data Analist', 'Data Engineer', 'Data Scientist', 'Data Architect', 'BI Analist', 'Analytics Engineer'];
  const isCustomJob = form.job_title && !presets.includes(form.job_title);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Header: type + autosave */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-muted/40 rounded-xl px-5 py-4 border">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type placement *</Label>
            <Select value={form.placement_type || 'freelancer'} onValueChange={v => updateField('placement_type', v)}>
              <SelectTrigger className="w-64 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="freelancer">🧑‍💻 Freelancer</SelectItem>
                <SelectItem value="perm">🏢 PERM (vaste aanwerving)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className={isPerm ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}>
            {isPerm ? 'Vaste aanwerving — eenmalige fee' : 'Freelancer — maandelijkse facturatie'}
          </Badge>
        </div>
        {isNew && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveStatus === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opslaan...</>}
            {saveStatus === 'saved' && <><Cloud className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">Concept opgeslagen</span></>}
            {saveStatus === 'error' && <><CloudOff className="w-3.5 h-3.5 text-destructive" /><span className="text-destructive">Autosave mislukt</span></>}
            {!saveStatus && <><Cloud className="w-3.5 h-3.5" /> Autosave actief</>}
          </div>
        )}
      </div>

      {/* 1 — Consultant gegevens */}
      <FormSection title="Consultant" icon="👤" defaultOpen={true}>
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
          <Select
            value={isCustomJob ? '__custom__' : (form.job_title || '')}
            onValueChange={v => { if (v !== '__custom__') updateField('job_title', v); else updateField('job_title', ''); }}
          >
            <SelectTrigger><SelectValue placeholder="Selecteer functie..." /></SelectTrigger>
            <SelectContent>
              {presets.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              <SelectItem value="__custom__">Andere (zelf invoeren)</SelectItem>
            </SelectContent>
          </Select>
          {isCustomJob && (
            <Input placeholder="Typ een functietitel..." value={form.job_title} onChange={e => updateField('job_title', e.target.value)} autoFocus />
          )}
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            Functieomschrijving
            <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">📄 gekopieerd naar contract</span>
          </Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Beschrijf de rol..."
            value={form.job_description || ''}
            onChange={e => updateField('job_description', e.target.value)}
          />
        </div>
      </FormSection>

      {/* 2 — Bedrijfsgegevens consultant (enkel freelancer) */}
      {!isPerm && (
        <FormSection title="Bedrijfsgegevens Consultant" icon="🏢" defaultOpen={true}>
          <div className="space-y-2">
            <Label>Bedrijfsnaam</Label>
            <Input value={form.consultant_company_name} onChange={e => updateField('consultant_company_name', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              BTW nummer
              <InfoTooltip text="Vul het BTW-nummer in en klik op 'Ophalen' om automatisch bedrijfsgegevens op te halen via VIES." />
            </Label>
            <VatLookupInput
              value={form.consultant_vat_number}
              onChange={v => updateField('consultant_vat_number', v)}
              onFill={({ company_name, address_lines }) => {
                if (company_name) updateField('consultant_company_name', company_name);
                if (address_lines?.length) {
                  const parsed = parseVatAddress(address_lines);
                  setCompanyAddr(parsed);
                  if (companyAddrSameAsPersonal) setPersonalAddr(parsed);
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Adres bedrijf</Label>
              <button
                type="button"
                onClick={() => { setCompanyAddrSameAsPersonal(true); setCompanyAddr(personalAddr); }}
                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  companyAddrSameAsPersonal ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                {companyAddrSameAsPersonal ? 'Zelfde als persoonlijk' : 'Synchroniseren'}
              </button>
            </div>
            <AddressFields values={companyAddr} onChange={updateCompanyAddr} />
          </div>
          <div className="space-y-2">
            <Label>Vertegenwoordiger firma</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Voornaam" value={repFirstName} onChange={e => setRepFirstName(e.target.value)} />
              <Input placeholder="Achternaam" value={repLastName} onChange={e => setRepLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Persoonlijk adres consultant</Label>
            <AddressFields values={personalAddr} onChange={updatePersonalAddr} />
          </div>
        </FormSection>
      )}

      {/* 3 — Klant */}
      <FormSection title="Klant" icon="🏦" defaultOpen={true}>
        <div className="space-y-2">
          <Label>Bedrijfsnaam *</Label>
          <Input value={form.client_company_name} onChange={e => updateField('client_company_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            BTW nummer
            <InfoTooltip text="Vul het BTW-nummer in en klik op 'Ophalen' om automatisch klantgegevens op te halen via VIES." />
          </Label>
          <VatLookupInput
            value={form.client_vat_number}
            onChange={v => updateField('client_vat_number', v)}
            onFill={({ company_name, address_lines }) => {
              if (company_name) updateField('client_company_name', company_name);
              if (address_lines?.length) setClientAddr(parseVatAddress(address_lines));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Adres</Label>
          <AddressFields values={clientAddr} onChange={updateClientAddr} />
        </div>
        <div className="space-y-2">
          <Label>Facturatiemail / Peppol</Label>
          <Input value={form.client_billing_email} onChange={e => updateField('client_billing_email', e.target.value)} />
        </div>
        {!isPerm && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              E-mail timesheet-verantwoordelijke
              <InfoTooltip text="Persoon bij de klant die maandelijkse timesheets controleert en goedkeurt." />
            </Label>
            <Input type="email" placeholder="approve@klant.be" value={form.client_timesheet_approver_email || ''} onChange={e => updateField('client_timesheet_approver_email', e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            📋 Referentie-instructies factuur
            <InfoTooltip text="Specificeer hoe de referentie op facturen moet worden ingevuld voor deze klant. Dit verschijnt als herinnering bij facturatie." />
          </Label>
          <textarea
            className="flex min-h-[64px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Bijv: PO-XXXXXX"
            value={form.reference_instructions || ''}
            onChange={e => updateField('reference_instructions', e.target.value)}
          />
          {form.reference_instructions && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
              <span>⚠️</span><span><strong>Herinnering actief</strong> bij aanmaken facturen.</span>
            </div>
          )}
        </div>
      </FormSection>

      {/* 4 — Tarieven & Data */}
      <FormSection title="Tarieven & Data" icon="💶" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Startdatum *</Label>
            <Input type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Einddatum {isPerm && <span className="text-xs font-normal text-muted-foreground">(optioneel)</span>}</Label>
            <Input type="date" value={form.end_date} onChange={e => updateField('end_date', e.target.value)} />
          </div>
        </div>
        {!isPerm && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Tarief Consultant (€/dag)
                  <InfoTooltip text="Het dagelijks bedrag dat aan de consultant wordt uitbetaald." />
                </Label>
                <Input type="number" step="0.01" value={form.consultant_rate} onChange={e => updateField('consultant_rate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Tarief Klant (€/dag)
                  <InfoTooltip text="Het dagelijks bedrag dat aan de klant wordt gefactureerd." />
                </Label>
                <Input type="number" step="0.01" value={form.client_rate} onChange={e => updateField('client_rate', e.target.value)} />
              </div>
            </div>
            {form.consultant_rate && form.client_rate && (
              <div className="flex gap-4 text-xs bg-muted/50 rounded-lg p-3">
                <span className="text-muted-foreground">Marge per dag:</span>
                <span className="font-semibold text-primary">{formatCurrency((parseFloat(form.client_rate) || 0) - (parseFloat(form.consultant_rate) || 0))}</span>
                <span className="text-muted-foreground ml-2">({(((parseFloat(form.client_rate) - parseFloat(form.consultant_rate)) / parseFloat(form.client_rate)) * 100).toFixed(1)}%)</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Dagen per week</Label>
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
            </div>
          </>
        )}
        {isPerm && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Jaarloon kandidaat (€)
                  <InfoTooltip text="Het bruto jaarloon van de kandidaat dat als basis dient voor de recruitmentfee." />
                </Label>
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
          </>
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
      </FormSection>

      {/* 5 — Contractinformatie (enkel freelancer) */}
      {!isPerm && (
        <FormSection title="Contractinformatie" icon="📋" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Agoria-index klant <InfoTooltip text="De Agoria-index wordt gebruikt voor automatische tariefherzieningen op basis van loonindexering." /></Label>
              <Input type="number" step="0.01" value={form.agoria_index_client || ''} onChange={e => updateField('agoria_index_client', e.target.value)} placeholder="110.25" />
            </div>
            <div className="space-y-2">
              <Label>Agoria-index consultant</Label>
              <Input type="number" step="0.01" value={form.agoria_index_consultant || ''} onChange={e => updateField('agoria_index_consultant', e.target.value)} placeholder="108.50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">Betalingstermijn klant (dagen) <InfoTooltip text="Aantal dagen waarbinnen de klant facturen moet betalen." /></Label>
              <Input type="number" min="0" placeholder="30" value={form.payment_terms_client || ''} onChange={e => updateField('payment_terms_client', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Betalingstermijn consultant (dagen)</Label>
              <Input type="number" min="0" placeholder="30" value={form.payment_terms_consultant || ''} onChange={e => updateField('payment_terms_consultant', e.target.value)} />
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
              className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Bijzondere bepalingen..."
              value={form.afwijkingsnota || ''}
              onChange={e => updateField('afwijkingsnota', e.target.value)}
            />
          </div>
        </FormSection>
      )}

      {/* 6 — Contactpersoon consultant */}
      <FormSection title="Contactpersoon Consultant" icon="📞" defaultOpen={false}>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Naam contactpersoon</Label>
            <Input value={form.consultant_contact_name || ''} onChange={e => updateField('consultant_contact_name', e.target.value)} placeholder="Jan Janssen" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.consultant_contact_email || ''} onChange={e => updateField('consultant_contact_email', e.target.value)} placeholder="jan@bedrijf.be" />
            </div>
            <div className="space-y-2">
              <Label>Telefoon</Label>
              <Input value={form.consultant_contact_phone || ''} onChange={e => updateField('consultant_contact_phone', e.target.value)} placeholder="+32 4xx xx xx xx" />
            </div>
          </div>
        </div>
      </FormSection>

      {/* 7 — Verlengingen (enkel freelancer) */}
      {!isPerm && (
        <FormSection title="Verlengingen" icon="🔄" defaultOpen={false} badge={(form.extensions || []).length > 0 ? `${form.extensions.length}` : undefined}>
          <div className="space-y-3">
            {(form.extensions || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Geen verlengingen geregistreerd</p>
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
                <Button type="button" variant="ghost" size="icon" onClick={() => setForm(p => ({ ...p, extensions: p.extensions.filter((_, i) => i !== idx) }))}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setForm(prev => ({ ...prev, extensions: [...(prev.extensions || []), { extended_on: '', new_end_date: '', notes: '' }] }))}>
              <Plus className="w-4 h-4 mr-1" /> Verlenging toevoegen
            </Button>
          </div>
        </FormSection>
      )}

      {/* 8 — Sjablonen */}
      <FormSection
        title="Contractsjablonen"
        icon="📄"
        defaultOpen={true}
        badge={isPerm ? 'PERM' : 'Freelancer'}
      >
        <p className="text-xs text-muted-foreground -mt-1 mb-2 flex items-center gap-1">
          Enkel sjablonen relevant voor <strong>{isPerm ? 'PERM' : 'Freelancer'}</strong> placements worden getoond.
          <InfoTooltip text="Kies hier de sjablonen die automatisch worden ingevuld bij het genereren van contracten. Enkel relevante types worden getoond op basis van het placement type." />
        </p>
        {contractTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen contractsjablonen beschikbaar voor dit type</p>
        ) : (
          <div className="space-y-2">
            {contractTemplates.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                <Checkbox
                  id={`ct-${t.id}`}
                  checked={(form.contract_template_ids || []).includes(t.id)}
                  onCheckedChange={checked => {
                    const ids = form.contract_template_ids || [];
                    updateField('contract_template_ids', checked ? [...ids, t.id] : ids.filter(id => id !== t.id));
                  }}
                />
                <label htmlFor={`ct-${t.id}`} className="text-sm cursor-pointer flex items-center gap-2 flex-1">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[t.template_type]} · {t.language?.toUpperCase()}{t.is_active ? ' · ✓' : ''}</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Factuursjablonen" icon="🧾" defaultOpen={true}>
        <p className="text-xs text-muted-foreground -mt-1 mb-2 flex items-center gap-1">
          Facturen die automatisch worden aangemaakt.
          <InfoTooltip text="Selecteer welke factuursjablonen automatisch moeten worden aangemaakt op basis van dit placement type." />
        </p>
        {invoiceTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen factuursjablonen beschikbaar voor dit type</p>
        ) : (
          <div className="space-y-2">
            {invoiceTemplates.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                <Checkbox
                  id={`it-${t.id}`}
                  checked={(form.invoice_template_ids || []).includes(t.id)}
                  onCheckedChange={checked => {
                    const ids = form.invoice_template_ids || [];
                    updateField('invoice_template_ids', checked ? [...ids, t.id] : ids.filter(id => id !== t.id));
                  }}
                />
                <label htmlFor={`it-${t.id}`} className="text-sm cursor-pointer flex items-center gap-2 flex-1">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[t.template_type]} · {t.language?.toUpperCase()}{t.is_active ? ' · ✓' : ''}</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* 9 — Sales Contributors */}
      <FormSection title="Sales Contributors" icon="💼" defaultOpen={false} badge={(form.sales_contributors || []).length > 0 ? `${form.sales_contributors.length} personen` : undefined}>
        <p className="text-xs text-muted-foreground -mt-1 mb-2 flex items-center gap-1">
          Wijs commissie-percentages toe aan salesmedewerkers.
          <InfoTooltip text="De percentages van alle sales contributors moeten samen maximaal 100% zijn. Het resterende percentage wordt niet toegewezen." />
        </p>
        <SalesContributorField
          contributors={form.sales_contributors || []}
          onChange={(contributors) => updateField('sales_contributors', contributors)}
        />
      </FormSection>

      {/* 10 — Opmerkingen */}
      <FormSection title="Extra Opmerkingen" icon={form.notes ? '💬' : '📝'} defaultOpen={!!form.notes}>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Bijv: specifieke afspraken, escalatiepunten..."
          value={form.notes || ''}
          onChange={e => updateField('notes', e.target.value)}
        />
      </FormSection>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => { if (isNew) localStorage.removeItem(DRAFT_KEY); onCancel(); }}>
          <X className="w-4 h-4 mr-1" /> Annuleren
        </Button>
        <Button type="submit"><Save className="w-4 h-4 mr-1" /> Opslaan</Button>
      </div>
    </form>
  );
}