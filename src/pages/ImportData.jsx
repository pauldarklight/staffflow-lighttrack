import React, { useState, useRef } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, Upload, Loader2, FileSpreadsheet, RefreshCw, Search, X, FolderOpen, History, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import { formatDate } from '@/lib/formatters';

export default function ImportData() {
  const [status, setStatus] = useState('idle'); // idle | extracting | preview | creating | done | error
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [search, setSearch] = useState('');
  const [updateResults, setUpdateResults] = useState({ updated: 0, skipped: 0, details: [] });
  const [extracted, setExtracted] = useState([]);
  const [results, setResults] = useState({ created: [], skipped: [] });
  const [errorMsg, setErrorMsg] = useState('');

  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null); // { name, url }
  const [uploadLoading, setUploadLoading] = useState(false);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [detectedMonth, setDetectedMonth] = useState(null);
  const [detectedYear, setDetectedYear] = useState(null);
  const [importMonth, setImportMonth] = useState(String(new Date().getMonth() + 1));
  const [importYear, setImportYear] = useState(String(new Date().getFullYear()));
  const fileInputRef = useRef(null);

  const queryClient = useQueryClient();

  const { data: importLogs = [] } = useQuery({
    queryKey: ['importLogs'],
    queryFn: () => base44.entities.ImportLog.list('-created_date', 50),
  });

  // Upload a file from computer
  const handleFileUpload = async (file) => {
    setUploadLoading(true);
    setAvailableSheets([]);
    setSelectedSheet('');
    setExtracted([]);
    setStatus('idle');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Parse it to get sheet names
      const response = await base44.functions.invoke('parseUploadedFile', { file_url, month: importMonth, year: importYear });
      const sheets = response.data?.sheets || [];
      setUploadedFile({ name: file.name, url: file_url });
      setAvailableSheets(sheets);
      setSelectedSheet(response.data?.sheet_name || sheets[0] || '');
      if (response.data?.detected_month) setDetectedMonth(response.data.detected_month);
      if (response.data?.detected_year) setDetectedYear(response.data.detected_year);
      // Log the upload
      await base44.entities.ImportLog.create({
        file_name: file.name,
        file_url,
        sheet_name: response.data?.sheet_name || sheets[0] || '',
        detected_month: response.data?.detected_month || null,
        detected_year: response.data?.detected_year || null,
        status: 'uploaded',
      });
      queryClient.invalidateQueries({ queryKey: ['importLogs'] });
    } catch (e) {
      setErrorMsg(e.response?.data?.error || e.message || 'Upload mislukt');
      setStatus('error');
    }
    setUploadLoading(false);
  };

  const handleExtract = async () => {
    setStatus('extracting');
    setErrorMsg('');
    try {
      let response;
      if (uploadedFile) {
        // Use uploaded file
        response = await base44.functions.invoke('parseUploadedFile', {
          file_url: uploadedFile.url,
          sheet_name: selectedSheet || '',
          month: importMonth,
          year: importYear,
        });
      } else {
        // Fallback: use hardcoded server-side file
        response = await base44.functions.invoke('parseActuals', {});
      }
      const rows = (response.data?.rows || []).filter(r => r.consultant_name && r.client_company);
      if (rows.length === 0) throw new Error('Geen geldige rijen gevonden. Controleer of het juiste tabblad geselecteerd is.');
      setExtracted(rows);
      setStatus('preview');
    } catch (e) {
      setErrorMsg(e.response?.data?.error || e.message || 'Onbekende fout');
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

      const existing = await base44.entities.Placement.filter({
        consultant_first_name: firstName,
        consultant_last_name: lastName,
        client_company_name: row.client_company.trim(),
      });

      if (existing && existing.length > 0) { skipped.push({ ...row, reason: 'Bestaat al' }); continue; }

      const importLabel = uploadedFile ? uploadedFile.name : 'Actuals Excel';
      const placement = await base44.entities.Placement.create({
        placement_type: 'freelancer',
        consultant_first_name: firstName,
        consultant_last_name: lastName,
        client_company_name: row.client_company.trim(),
        client_rate: dagfee,
        consultant_rate: consultantRate > 0 ? consultantRate : 0,
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        sales_contributors: (row.sales_contributors || []).filter(s => s.name && s.percentage > 0),
        notes: `Geïmporteerd vanuit Actuals Excel – ${importLabel}`,
      });

      await base44.entities.Contract.create({ placement_id: placement.id, contract_type: 'client', status: 'draft', recipient_name: row.client_company.trim(), recipient_email: '', notes: 'Auto aangemaakt via import Jan 2026' });
      await base44.entities.Contract.create({ placement_id: placement.id, contract_type: 'consultant', status: 'draft', recipient_name: row.consultant_name.trim(), recipient_email: '', notes: 'Auto aangemaakt via import Jan 2026' });

      if (row.days_worked > 0) {
        const daysWorked = parseFloat(row.days_worked);
        const clientRevenue = parseFloat(row.omzet) || (daysWorked * dagfee);
        const consultantCost = daysWorked * consultantRate;
        const margin = parseFloat(row.margin) || parseFloat(row.total_marge) || (daysWorked * marge);
        const tsMonth = detectedMonth || parseInt(importMonth);
        const tsYear = detectedYear || parseInt(importYear);
        await base44.entities.Timesheet.create({
          placement_id: placement.id, month: tsMonth, year: tsYear,
          days_worked: daysWorked, client_revenue: clientRevenue,
          consultant_revenue: consultantCost, margin: margin,
          status: 'approved', consultant_name: row.consultant_name.trim(), client_company: row.client_company.trim(),
        });
      }

      created.push(row);
    }

    setResults({ created, skipped });
    queryClient.invalidateQueries({ queryKey: ['placements'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    // Update the most recent log for this file
    if (uploadedFile) {
      const matchingLog = importLogs.find(l => l.file_url === uploadedFile.url);
      if (matchingLog) {
        await base44.entities.ImportLog.update(matchingLog.id, {
          status: 'imported',
          rows_created: created.length,
          rows_skipped: skipped.length,
          sheet_name: selectedSheet,
        });
        queryClient.invalidateQueries({ queryKey: ['importLogs'] });
      }
    }
    setStatus('done');
  };

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const handleUpdate = async () => {
    setUpdateStatus('running');
    setUpdateResults({ updated: 0, skipped: 0, details: [] });

    try {
      // First extract latest data from Excel
      const response = await base44.functions.invoke('parseActuals', {});
      const rows = (response.data?.rows || []).filter(r => r.consultant_name && r.client_company);

      let updated = 0;
      let skipped = 0;
      const details = [];

      for (const row of rows) {
        const nameParts = row.consultant_name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const dagfee = parseFloat(row.client_rate) || 0;
        const marge = parseFloat(row.marge_per_dag) || 0;
        const consultantRate = parseFloat(row.consultant_rate) || (dagfee - marge);

        await sleep(300);
        const existing = await base44.entities.Placement.filter({
          consultant_first_name: firstName,
          consultant_last_name: lastName,
          client_company_name: row.client_company.trim(),
        });

        if (!existing || existing.length === 0) { skipped++; continue; }

        const placement = existing[0];

        // Update placement with latest rates, dates and sales contributors
        await base44.entities.Placement.update(placement.id, {
          client_rate: dagfee,
          consultant_rate: consultantRate > 0 ? consultantRate : placement.consultant_rate,
          start_date: row.start_date || placement.start_date,
          end_date: row.end_date || placement.end_date,
          sales_contributors: (row.sales_contributors || []).filter(s => s.name && s.percentage > 0),
        });

        // Ensure contracts exist
        const contracts = await base44.entities.Contract.filter({ placement_id: placement.id });
        const hasClient = contracts.some(c => c.contract_type === 'client');
        const hasConsultant = contracts.some(c => c.contract_type === 'consultant');

        if (!hasClient) {
          await base44.entities.Contract.create({ placement_id: placement.id, contract_type: 'client', status: 'draft', recipient_name: row.client_company.trim(), recipient_email: '' });
          details.push(`${row.consultant_name}: klantcontract aangemaakt`);
        }
        if (!hasConsultant) {
          await base44.entities.Contract.create({ placement_id: placement.id, contract_type: 'consultant', status: 'draft', recipient_name: row.consultant_name.trim(), recipient_email: '' });
          details.push(`${row.consultant_name}: consultantcontract aangemaakt`);
        }

        // Ensure Jan 2026 timesheet exists
        if (row.days_worked > 0) {
          const timesheets = await base44.entities.Timesheet.filter({ placement_id: placement.id, month: 1, year: 2026 });
          if (timesheets.length === 0) {
            const daysWorked = parseFloat(row.days_worked);
            const clientRevenue = parseFloat(row.omzet) || (daysWorked * dagfee);
            const consultantCost = daysWorked * consultantRate;
            const margin = parseFloat(row.total_marge) || (daysWorked * marge);
            await base44.entities.Timesheet.create({
              placement_id: placement.id, month: 1, year: 2026,
              days_worked: daysWorked, client_revenue: clientRevenue,
              consultant_revenue: consultantCost, margin: margin,
              status: 'approved', consultant_name: row.consultant_name.trim(), client_company: row.client_company.trim(),
            });
            details.push(`${row.consultant_name}: timesheet jan 2026 aangemaakt`);
          } else {
            // Update existing timesheet with correct figures
            const daysWorked = parseFloat(row.days_worked);
            const clientRevenue = parseFloat(row.omzet) || (daysWorked * dagfee);
            const consultantCost = daysWorked * consultantRate;
            const margin = parseFloat(row.total_marge) || (daysWorked * marge);
            await base44.entities.Timesheet.update(timesheets[0].id, {
              days_worked: daysWorked, client_revenue: clientRevenue,
              consultant_revenue: consultantCost, margin: margin, status: 'approved',
            });
          }
        }

        updated++;
      }

      queryClient.invalidateQueries({ queryKey: ['placements'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      setUpdateResults({ updated, skipped, details });
      setUpdateStatus('done');
    } catch (e) {
      setUpdateStatus('error');
      setUpdateResults({ updated: 0, skipped: 0, details: [e.message] });
    }
  };

  return (
    <div>
      <PageHeader title="Data Import" subtitle="Verwerk historische Excel-data naar placements, contracten en timesheets" />

      <div className="space-y-6 max-w-4xl">
        {/* Update button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleUpdate}
            disabled={updateStatus === 'running'}
            className="gap-2"
          >
            {updateStatus === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {updateStatus === 'running' ? 'Bezig met bijwerken...' : 'Werk placements bij'}
          </Button>
        </div>

        {updateStatus === 'done' && (
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-700">{updateResults.updated} placements bijgewerkt · {updateResults.skipped} niet gevonden</span>
              </div>
              {updateResults.details.length > 0 && (
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 mt-1">
                  {updateResults.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {updateStatus === 'error' && (
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-4 flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {updateResults.details[0] || 'Onbekende fout'}
            </CardContent>
          </Card>
        )}

        {/* Upload from computer */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" /> Bestand uploaden van computer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload een Excel (.xlsx) of CSV bestand. De kolommen worden automatisch herkend.</p>

            <div
              className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center cursor-pointer hover:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
            >
              {uploadLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Bestand uploaden en analyseren...</span>
                </div>
              ) : uploadedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">{uploadedFile.name}</span>
                  <span className="text-xs text-muted-foreground">{availableSheets.length} tab(bladen) gevonden · Klik om te vervangen</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Klik of sleep een bestand hier</span>
                  <span className="text-xs">.xlsx of .csv</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
              />
            </div>

            {availableSheets.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1 flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-muted-foreground">Tabblad</label>
                  <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableSheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 1: Extract */}
        {(status === 'idle' || status === 'error') && (
          <Card>
            <CardHeader><CardTitle className="text-base">Stap 1 — Gegevens extraheren</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {uploadedFile
                  ? `Klik op "Extraheer Data" om de gegevens uit "${uploadedFile.name}" (tab: ${selectedSheet}) in te lezen.`
                  : 'Klik op "Extraheer Data" om de consultants, tarieven en prestaties uit de Jan 2026 tab te lezen.'}
              </p>
              {status === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
                </div>
              )}
              <Button onClick={handleExtract} disabled={!uploadedFile && status !== 'error'}>
                <Upload className="w-4 h-4 mr-2" /> Extraheer Data
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base">Stap 2 — Controleer & Bevestig ({extracted.filter(r => !search || r.consultant_name?.toLowerCase().includes(search.toLowerCase()) || r.client_company?.toLowerCase().includes(search.toLowerCase())).length} / {extracted.length} rijen)</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Zoek op naam of klant..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-8 h-8 text-xs w-52"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Button onClick={handleCreate}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Maak Placements aan
                  </Button>
                </div>
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
                    {extracted.filter(r => !search || r.consultant_name?.toLowerCase().includes(search.toLowerCase()) || r.client_company?.toLowerCase().includes(search.toLowerCase())).map((r, i) => (
                      <tr key={i} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium">{r.consultant_name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{r.client_company}</td>
                        <td className="py-2 px-3 text-right">{r.client_rate ? formatCurrency(r.client_rate) : '—'}</td>
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

      {/* Import geschiedenis */}
      {importLogs.length > 0 && (
        <div className="max-w-4xl mt-10">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Import geschiedenis</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Bestand</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Tabblad</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Periode</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Aangemaakt</th>
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {importLogs.map(log => (
                    <tr key={log.id} className="border-b hover:bg-muted/20">
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[200px]">{log.file_name}</span>
                          {log.file_url && (
                            <a href={log.file_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{log.sheet_name || '—'}</td>
                      <td className="py-2 px-4 text-muted-foreground">
                        {log.detected_month && log.detected_year
                          ? `${getMonthName(log.detected_month)} ${log.detected_year}`
                          : '—'}
                      </td>
                      <td className="py-2 px-4">
                        {log.status === 'imported' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">✓ Verwerkt</Badge>
                        ) : log.status === 'extracted' ? (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Geëxtraheerd</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Geüpload</Badge>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {log.status === 'imported'
                          ? <span className="text-emerald-700 font-semibold">{log.rows_created ?? '—'} <span className="text-xs font-normal text-muted-foreground">/ {(log.rows_skipped ?? 0) + (log.rows_created ?? 0)} rijen</span></span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground text-xs">{formatDate(log.created_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}