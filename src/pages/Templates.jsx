import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, FileText, Trash2, CheckCircle2, Plus, ExternalLink, Pencil } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/formatters';

const TYPE_LABELS = {
  contract_client: 'Contract Klant',
  contract_consultant: 'Contract Consultant',
  contract_subcontractor: 'Contract Onderaannemer',
  contract_addendum: 'Addendum',
  invoice_client: 'Factuur Klant',
  invoice_consultant: 'Factuur Consultant',
};
const TYPE_STYLES = {
  contract_client: 'bg-primary/10 text-primary border-primary/20',
  contract_consultant: 'bg-foreground/10 text-foreground border-foreground/20',
  contract_subcontractor: 'bg-orange-100 text-orange-700 border-orange-200',
  contract_addendum: 'bg-purple-100 text-purple-700 border-purple-200',
  invoice_client: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  invoice_consultant: 'bg-blue-100 text-blue-700 border-blue-200',
};

const LANG_LABELS = { nl: '🇧🇪 NL', en: '🇬🇧 EN' };

const GROUPS = [

  { key: 'contract', label: 'Contracten', types: ['contract_client', 'contract_consultant', 'contract_subcontractor', 'contract_addendum'] },
  { key: 'invoice', label: 'Facturen', types: ['invoice_client', 'invoice_consultant'] },
];

export default function Templates() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', template_type: 'contract_client', language: 'nl', description: '', version: 'v1.0', is_active: true });
  const [file, setFile] = useState(null);
  const [fileRemoved, setFileRemoved] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => base44.entities.Template.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Template.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Template.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['templates'] }); setShowForm(false); setEditing(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Template.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const activateMutation = useMutation({
    mutationFn: async ({ id, type, language }) => {
      const sameType = templates.filter(t => t.template_type === type && t.language === language && t.id !== id);
      await Promise.all(sameType.map(t => base44.entities.Template.update(t.id, { is_active: false })));
      return base44.entities.Template.update(id, { is_active: true });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const resetForm = () => { setForm({ name: '', template_type: 'contract_client', language: 'nl', description: '', version: 'v1.0', is_active: true }); setFile(null); setFileRemoved(false); setEditing(null); };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, template_type: t.template_type, language: t.language || 'nl', description: t.description || '', version: t.version || 'v1.0', is_active: t.is_active });
    setFile(null);
    setFileRemoved(false);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    let fileUrl = fileRemoved ? null : (editing?.file_url || null);
    let fileName = fileRemoved ? null : (editing?.file_name || null);
    if (file) {
      const res = await base44.integrations.Core.UploadFile({ file });
      fileUrl = res.file_url;
      fileName = file.name;
    }
    if (form.is_active) {
      const sameType = templates.filter(t => t.template_type === form.template_type && t.language === form.language && t.id !== editing?.id);
      await Promise.all(sameType.map(t => base44.entities.Template.update(t.id, { is_active: false })));
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { ...form, file_url: fileUrl, file_name: fileName } });
    } else {
      createMutation.mutate({ ...form, file_url: fileUrl, file_name: fileName });
    }
    setUploading(false);
  };

  return (
    <div>
      <PageHeader title="Sjablonen" subtitle="Beheer contract- en factuursjablonen">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nieuw Sjabloon
        </Button>
      </PageHeader>

      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sjabloon Bewerken' : 'Nieuw Sjabloon Uploaden'}</DialogTitle>
            <DialogDescription>Upload een sjabloonbestand (PDF, DOCX, XLSX). Je kunt placeholders gebruiken zoals {'{consultant_name}'}, {'{client_company}'}, {'{start_date}'}, enz.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Naam *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Versie</Label>
                <Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="v1.0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.template_type} onValueChange={v => setForm(p => ({ ...p, template_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taal *</Label>
              <Select value={form.language} onValueChange={v => setForm(p => ({ ...p, language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nl">🇧🇪 Nederlands</SelectItem>
                  <SelectItem value="en">🇬🇧 Engels</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Beschrijving / Placeholders uitleg</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Bijv: gebruik {consultant_name}, {start_date}, {client_rate} als placeholders..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Bestand uploaden</Label>
              {editing && editing.file_url && !fileRemoved && !file && (
                <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30 text-xs">
                  <span className="text-muted-foreground truncate">{editing.file_name || 'Huidig bestand'}</span>
                  <button type="button" className="ml-2 text-destructive hover:underline shrink-0" onClick={() => setFileRemoved(true)}>Verwijderen</button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="flex-1 cursor-pointer border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors">
                  <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{file ? file.name : (editing && editing.file_url && !fileRemoved ? 'Nieuw bestand selecteren (vervangt huidig)' : 'Klik om bestand te selecteren (PDF, DOCX, XLSX)')}</span>
                  <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.doc,.xls" onChange={e => setFile(e.target.files[0])} />
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <Label htmlFor="is_active" className="cursor-pointer">Instellen als actief sjabloon voor dit type</Label>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuleren</Button>
              <Button type="submit" disabled={uploading || createMutation.isPending}>
                {uploading ? 'Uploaden...' : 'Opslaan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {templates.length === 0 ? (
        <EmptyState icon={FileText} title="Geen sjablonen" description="Upload je eerste contract- of factuursjabloon om de automatische flow te activeren.">
          <Button onClick={() => setShowForm(true)}><Upload className="w-4 h-4 mr-1" /> Upload Sjabloon</Button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {GROUPS.map(group => {
            const groupTemplates = templates.filter(t => group.types.includes(t.template_type));
            return (
              <div key={group.key}>
                <h2 className="text-base font-semibold mb-3">{group.label}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.types.map(type => {
                    const typeTemplates = groupTemplates.filter(t => t.template_type === type);
                    const active = typeTemplates.find(t => t.is_active);
                    return (
                      <Card key={type} className={active ? 'border-primary/30' : ''}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{TYPE_LABELS[type]}</CardTitle>
                            {active ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Actief
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Geen actief sjabloon</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {typeTemplates.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Nog geen sjabloon geüpload</p>
                          ) : (
                            typeTemplates.map(t => (
                              <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg border ${t.is_active ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className={`w-4 h-4 shrink-0 ${t.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                                  <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate">{t.name}</div>
                                    <div className="text-xs text-muted-foreground">{t.version} · {LANG_LABELS[t.language] || 'NL'} · {formatDate(t.created_date)}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {t.file_url && (
                                    <Button variant="ghost" size="icon" asChild title="Bekijken">
                                      <a href={t.file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" title="Bewerken" onClick={() => openEdit(t)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  {!t.is_active && (
                                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => activateMutation.mutate({ id: t.id, type: t.template_type, language: t.language })}>
                                      Activeren
                                    </Button>
                                  )}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Verwijderen?</AlertDialogTitle>
                                        <AlertDialogDescription>Dit verwijdert het sjabloon permanent.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteMutation.mutate(t.id)}>Verwijderen</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Placeholder reference */}
      <Card className="mt-8 bg-muted/30">
        <CardHeader><CardTitle className="text-sm">📋 Beschikbare Placeholders</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridAutoFlow: 'column', gridTemplateRows: 'repeat(11, auto)' }}>
            {[
              '{afwervingsboete}',
              '{afwijkingsnota}',
              '{agoria_index_client}',
              '{agoria_index_consultant}',
              '{amount_excl_vat}',
              '{billing_client_rate}',
              '{client_address}',
              '{client_bank_account}',
              '{client_bank_reference}',
              '{client_billing_email}',
              '{client_company}',
              '{client_country}',
              '{client_vat}',
              '{consultant_address}',
              '{consultant_bank_account}',
              '{consultant_bank_reference}',
              '{consultant_company}',
              '{consultant_company_representative}',
              '{consultant_representative}',
              '{consultant_first_name}',
              '{consultant_job_description}',
              '{consultant_last_name}',
              '{consultant_name}',
              '{consultant_personal_address}',
              '{consultant_vat}',
              '{contract_date}',
              '{contract_place}',
              '{current_date}',
              '{days_per_week}',
              '{days_worked}',
              '{days_worked_q}',
              '{due_date}',
              '{end_date}',
              '{ts_confirmed}',
              '{garantieperiode}',
              '{invoice_date}',
              '{invoice_number}',
              '{job_description}',
              '{job_title}',
              '{month}',
              '{month_end_total_client}',
              '{notice_period_client}',
              '{notice_period_consultant}',
              '{our_company_address}',
              '{our_company_name}',
              '{paying_consultant_rate}',
              '{reference}',
              '{start_date}',
              '{total_amount}',
              '{vat_amount}',
              '{year}',
            ].map(p => <div key={p}>{p}</div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}