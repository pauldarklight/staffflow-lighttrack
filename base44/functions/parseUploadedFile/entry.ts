import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, month, year } = await req.json();
    if (!file_url) return Response.json({ error: 'Geen bestand meegegeven' }, { status: 400 });

    // Download the uploaded file
    const fileRes = await fetch(file_url);
    const arrayBuffer = await fileRes.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const workbook = XLSX.read(uint8, { type: 'array' });

    // Try to find a relevant sheet (prefer one matching month/year or just use first)
    let sheetName = workbook.SheetNames[0];
    const targetMonth = month || '';
    if (targetMonth) {
      const match = workbook.SheetNames.find(s => s.toLowerCase().includes(String(targetMonth).toLowerCase()));
      if (match) sheetName = match;
    }

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!raw || raw.length === 0) {
      return Response.json({ error: `Geen data gevonden in tab "${sheetName}"` }, { status: 400 });
    }

    // Normalize column names (lowercase, strip spaces)
    const normalize = (key) => String(key).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const rows = raw.map(rawRow => {
      const row = {};
      for (const [k, v] of Object.entries(rawRow)) {
        row[normalize(k)] = v;
      }

      // Map common column name patterns
      const get = (...keys) => {
        for (const k of keys) {
          const norm = normalize(k);
          if (row[norm] !== undefined && row[norm] !== '') return row[norm];
        }
        return null;
      };

      const consultant_name = get('consultant', 'consultant_name', 'naam', 'name', 'freelancer', 'medewerker');
      const client_company = get('klant', 'client', 'client_company', 'bedrijf', 'company', 'opdrachtgever');
      const client_rate = parseFloat(get('dagfee', 'client_rate', 'bill_rate', 'tarief_klant', 'dagtarief_klant', 'bill/dag') || 0) || null;
      const consultant_rate = parseFloat(get('consultant_rate', 'pay_rate', 'tarief_consultant', 'dagtarief_consultant', 'pay/dag') || 0) || null;
      const marge_per_dag = parseFloat(get('marge_per_dag', 'marge', 'margin', 'margin_per_dag') || 0) || null;
      const days_worked = parseFloat(get('days_worked', 'dagen', 'days', 'gewerkte_dagen', 'prestaties') || 0) || 0;
      const omzet = parseFloat(get('omzet', 'revenue', 'facturatie', 'totaal') || 0) || null;
      const total_marge = parseFloat(get('total_marge', 'totale_marge', 'total_margin', 'marge_totaal') || 0) || null;
      const start_date = get('start_date', 'startdatum', 'start', 'begin');
      const end_date = get('end_date', 'einddatum', 'einde', 'end');

      return { consultant_name, client_company, client_rate, consultant_rate, marge_per_dag, days_worked, omzet, total_marge, start_date, end_date };
    }).filter(r => r.consultant_name && r.client_company);

    return Response.json({ rows, sheet_name: sheetName, total_sheets: workbook.SheetNames.length, sheets: workbook.SheetNames });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});