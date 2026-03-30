import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatCurrency } from '@/lib/formatters';

const FILE_URL = 'https://media.base44.com/files/public/69babb9b316585d1576607e8/668a0c88f_KopievanActuals.xlsx';

export default function ImportData() {
  const [status, setStatus] = useState('idle'); // idle | extracting | creating | done | error
  const [extracted, setExtracted] = useState([]);
  const [results, setResults] = useState({ created: [], skipped: [] });
  const [errorMsg, setErrorMsg] = useState('');
  const queryClient = useQueryClient();

  const handleExtract = async () => {
    setStatus('extracting');
    setErrorMsg('');
    try {
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: FILE_URL,
        json_schema: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              description: 'Elke rij = 1 consultant/placement op de Jan 2026 tab. Sla lege rijen en header-rijen over.',
              items: {
                type: 'object',
                properties: {
                  consultant_name: { type: 'string', description: 'Volledige naam van de consultant/runner (bijv. kolom A of B)' },
                  client_company: { type: 'string', description: 'Bedrijfsnaam van de klant' },
                  client_rate: { type: 'number', description: 'Dagtarief klant = omzet per dag (kolom C, bijv. 814 voor Bart Malfait)' },
                  marge_per_dag: { type: 'number', description: 'Marge per dag in EUR (kolom D, bijv. 100)' },
                  consultant_rate: { type: 'number', description: 'Tarief consultant = client_rate minus marge_per_dag (bijv. 714)' },
                  days_worked: { type: 'number', description: 'Aantal gepresteerde dagen in januari 2026 (kolom J, bijv. 14.5). Dit is de som van X-markeringen in de dagkolommen.' },
                  omzet: { type: 'number', description: 'Totale omzet = days_worked * client_rate (kolom K, bijv. 11803)' },
                  total_marge: { type: 'number', description: 'Totale marge = days_worked * marge_per_dag (kolom L, bijv. 1450)' },
                  start_date: { type: 'string', description: 'Startdatum van het contract (format YYYY-MM-DD indien aanwezig)' },
                  end_date: { type: 'string', description: 'Einddatum van het contract (format YYYY-MM-DD indien aanwezig)' },
                  sales_contributors: {
                    type: 'array',
                    description: 'Bonusverdeling uit kolommen R t/m V: naam medewerker + percentage',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Naam van de medewerker die bonus ontvangt' },
                        percentage: { type: 'number', description: 'Percentage van de marge (bijv. 50 voor 50%)' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (result.status !== 'success' || !result.output?.rows) {
        throw new Error(result.details || 'Extractie mislukt');
      }

      const rows = result.output.rows.filter(r => r.consultant_name && r.client_company);
      setExtracted(rows);
      setStatus('preview');
    } catch (e) {
      setErrorMsg(e.message || 'Onbekende fout');
      setStatus('error');
    }
  };

  const handleCreate = async () => {
    setStatus('creating');
    const created = [];
    const skipped = [];

    for (const row of extracted) {
      if (!row.consultant_name || !row.client_company) { skipped.push({ ...row, reason: 'Ontbrekende naam of bedrijf' }); continue; }

      const nameParts = row.consultant_name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const dagfee = parseFloat(row.client_rate) || 0;
      const marge = parseFloat(row.marge_per_dag) || 0;
      const consultantRate = parseFloat(row.consultant_rate) || (dagfee - marge);

      // Check duplicates
      const existing = await base44.entities.Placement.filter({
        consultant_first_name: firstName,
        consultant_last_name: lastName,
        client_company_name: row.client_company.trim(),
      });

      if (existing && existing.length > 0) {
        skipped.push({ ...row, reason: 'Bestaat al' });
        continue;
      }

      const placement = await base44.entities.Placement.create({
        placement_type: 'freelancer',
        consultant_first_name: firstName,
        consultant_last_name: lastName,
        client_company_name: row.client_company.trim(),
        client_rate: dagfee,
        consultant_rate: consultantRate > 0 ? consultantRate : 0,
        sales_contributors: (row.sales_contributors || []).filter(s => s.name && s.percentage > 0),
        notes: 'Geïmporteerd vanuit Actuals Excel – Jan 2026',
      });

      // Auto-create contracts
      await base44.entities.Contract.create({
        placement_id: placement.id, contract_type: 'client', status: 'draft',
        recipient_name: row.client_company.trim(), recipient_email: '',
        notes: 'Auto aangemaakt via import Jan 2026',
      });
      await base44.entities.Contract.create({
        placement_id: placement.id, contract_type: 'consultant', status: 'draft',
        recipient_name: row.consultant_name.trim(), recipient_email: '',
        notes: 'Auto aangemaakt via import Jan 2026',
      });

      // Create timesheet for Jan 2026 if days worked known
      if (row.days_worked > 0) {
        const daysWorked = parseFloat(row.days_worked);
        const clientRevenue = parseFloat(row.omzet) || (daysWorked * dagfee);
        const consultantCost = daysWorked * consultantRate;
        const margin = parseFloat(row.total_marge) || (daysWorked * marge);
        await base44.entities.Timesheet.create({
          placement_id: placement.id,
          month: 1, year: 2026,
          days_worked: daysWorked,
          client_revenue: clientRevenue,
          consultant_revenue: consultantCost,
          margin: margin,
          status: 'approved',
          consultant_name: row.consultant_name.trim(),
          client_company: row.client_company.trim(),
        });
      }

      created.push(row);
    }

    setResults({ created, skipped });
    queryClient.invalidateQueries({ queryKey: ['placements'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    setStatus('done');
  };

  return (
    <div>
      <PageHeader title="Data Import" subtitle="Verwerk historische Excel-data naar placements, contracten en timesheets" />

      <div className="space-y-6 max-w-4xl">
        {/* Source file info */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 flex items-center gap-4">
            <FileSpreadsheet className="w-10 h-10 text-blue-600 shrink-0" />
            <div>
              <div className="font-semibold text-sm">KopievanActuals.xlsx — Tab: Jan 2026</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                48 contractors · Gemiddelde dagfee: ~€790 · Totale omzet: ~€577.135
              </div>
            </div>
            <div className="ml-auto">
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Klaar om te importeren</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Extract */}
        {(status === 'idle' || status === 'error') && (
          <Card>
            <CardHeader><CardTitle className="text-base">Stap 1 — Gegevens extraheren</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Klik op "Extraheer Data" om de consultants, tarieven en prestaties uit de Jan 2026 tab te lezen via AI-extractie.
              </p>
              {status === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
                </div>
              )}
              <Button onClick={handleExtract}>
                <Upload className="w-4 h-4 mr-2" /> Extraheer Data uit Excel
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'extracting' && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Data extraheren uit Excel...</p>
              <p className="text-xs text-muted-foreground">Dit kan 15-30 seconden duren</p>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Preview */}
        {status === 'preview' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Stap 2 — Controleer & Bevestig ({extracted.length} rijen gevonden)</CardTitle>
                <Button onClick={handleCreate}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Maak Placements aan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-3">Consultant</th>
                      <th className="text-left py-2 px-3">Klant</th>
                      <th className="text-right py-2 px-3">Dagfee</th>
                      <th className="text-right py-2 px-3">Marge/dag</th>
                    <th className="text-right py-2 px-3">Cons. tarief</th>
                      <th className="text-right py-2 px-3">Dagen jan</th>
                      <th className="text-left py-2 px-3">Start</th>
                      <th className="text-left py-2 px-3">Einde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extracted.map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium">{r.consultant_name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.client_company}</td>
                        <td className="py-2 px-3 text-right">{r.dagfee ? formatCurrency(r.dagfee) : '—'}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">{r.marge_per_dag ? formatCurrency(r.marge_per_dag) : '—'}</td>
                        <td className="py-2 px-3 text-right text-muted-foreground">{r.consultant_rate ? formatCurrency(r.consultant_rate) : '—'}</td>
                        <td className="py-2 px-3 text-right">{r.days_worked || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.start_date || '—'}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.end_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {status === 'creating' && (
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Placements, contracten en timesheets aanmaken...</p>
              <p className="text-xs text-muted-foreground">Even geduld</p>
            </CardContent>
          </Card>
        )}

        {status === 'done' && (
          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" /> Import voltooid
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{results.created.length}</div>
                  <div className="text-xs text-emerald-600">Placements aangemaakt</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border text-center">
                  <div className="text-2xl font-bold text-muted-foreground">{results.skipped.length}</div>
                  <div className="text-xs text-muted-foreground">Overgeslagen (duplicaten)</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Per placement zijn automatisch 2 contracten (klant + consultant) en 1 goedgekeurde timesheet voor januari 2026 aangemaakt.
              </p>
              {results.skipped.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <strong>Overgeslagen:</strong> {results.skipped.map(s => `${s.consultant_name} (${s.reason})`).join(', ')}
                </div>
              )}
              <Button onClick={() => { setStatus('idle'); setExtracted([]); setResults({ created: [], skipped: [] }); }} variant="outline">
                Opnieuw importeren
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}