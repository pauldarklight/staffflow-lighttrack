import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch the Excel file
  const fileUrl = 'https://media.base44.com/files/public/69babb9b316585d1576607e8/668a0c88f_KopievanActuals.xlsx';
  const fileRes = await fetch(fileUrl);
  const buffer = await fileRes.arrayBuffer();

  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

  // Find the Jan 2026 sheet (name may have trailing spaces)
  const sheetName = workbook.SheetNames.find(n => n.trim().toLowerCase() === 'jan 2026');
  if (!sheetName) {
    return Response.json({ error: 'Sheet "Jan 2026" niet gevonden', available: workbook.SheetNames }, { status: 404 });
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  // Find header row: the row that contains 'dagfee' or 'Runner'
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.some(c => typeof c === 'string' && (c.toLowerCase().includes('runner') || c.toLowerCase().includes('dagfee')))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return Response.json({ error: 'Headerrij niet gevonden', preview: rows.slice(0, 5) }, { status: 400 });
  }

  const headers = rows[headerRowIdx];

  // Find column indices
  const findCol = (keywords) => headers.findIndex(h => h && keywords.some(k => String(h).toLowerCase().includes(k.toLowerCase())));

  const colStartDate = 0; // col_0 = start op
  const colEndDate = 1;   // col 1 = loopt af op / aantal contractors
  const colDagfee = findCol(['dagfee', 'gemiddelde']);
  const colMarge = findCol(['marge']);
  const colBedrijf = findCol(['bedrijf']);
  const colRunner = findCol(['runner', 'consultant']);

  const created = [];
  const skipped = [];

  // Data rows start after header row
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[colRunner] || typeof row[colRunner] !== 'string') continue;

    const consultantFullName = String(row[colRunner]).trim();
    if (!consultantFullName || consultantFullName.length < 2) continue;

    const clientCompany = row[colBedrijf] ? String(row[colBedrijf]).trim() : '';
    if (!clientCompany) continue;

    // Parse dagfee and marge
    const dagfee = parseFloat(row[colDagfee]) || 0;
    const marge = parseFloat(row[colMarge]) || 0;
    const consultantRate = dagfee - marge;

    // Parse dates
    let startDate = null;
    let endDate = null;

    const rawStart = row[colStartDate];
    const rawEnd = row[colEndDate];

    if (rawStart && rawStart !== 'start op') {
      try {
        const d = new Date(rawStart);
        if (!isNaN(d.getTime())) startDate = d.toISOString().split('T')[0];
      } catch {}
    }
    if (rawEnd && rawEnd !== 'Loopt af op' && rawEnd !== 'aantal contractors') {
      try {
        const d = new Date(rawEnd);
        if (!isNaN(d.getTime())) endDate = d.toISOString().split('T')[0];
      } catch {}
    }

    // Split name
    const nameParts = consultantFullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    if (!firstName || !clientCompany) {
      skipped.push({ row: i, reason: 'Ontbrekende naam of bedrijf', data: { consultantFullName, clientCompany } });
      continue;
    }

    // Check if placement already exists to avoid duplicates
    const existing = await base44.asServiceRole.entities.Placement.filter({
      consultant_first_name: firstName,
      consultant_last_name: lastName,
      client_company_name: clientCompany,
    });

    if (existing && existing.length > 0) {
      skipped.push({ row: i, reason: 'Placement bestaat al', name: consultantFullName, company: clientCompany });
      continue;
    }

    const placementData = {
      placement_type: 'freelancer',
      consultant_first_name: firstName,
      consultant_last_name: lastName,
      client_company_name: clientCompany,
      client_rate: dagfee,
      consultant_rate: consultantRate > 0 ? consultantRate : 0,
      start_date: startDate || '2026-01-01',
      end_date: endDate || null,
      status: endDate && new Date(endDate) < new Date() ? 'ended' : 'active',
      notes: `Geïmporteerd vanuit Actuals Excel - Jan 2026`,
    };

    const placement = await base44.asServiceRole.entities.Placement.create(placementData);

    // Auto-create contracts
    await base44.asServiceRole.entities.Contract.create({
      placement_id: placement.id,
      contract_type: 'client',
      status: 'draft',
      recipient_name: clientCompany,
      recipient_email: '',
      notes: 'Auto aangemaakt via import Jan 2026',
    });
    await base44.asServiceRole.entities.Contract.create({
      placement_id: placement.id,
      contract_type: 'consultant',
      status: 'draft',
      recipient_name: consultantFullName,
      recipient_email: '',
      notes: 'Auto aangemaakt via import Jan 2026',
    });

    created.push({ name: consultantFullName, company: clientCompany, dagfee, marge, startDate, endDate });
  }

  return Response.json({
    success: true,
    sheet: sheetName,
    created_count: created.length,
    skipped_count: skipped.length,
    created,
    skipped,
  });
});