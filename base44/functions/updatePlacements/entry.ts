import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const FILE_URL = 'https://media.base44.com/files/public/69babb9b316585d1576607e8/668a0c88f_KopievanActuals.xlsx';

    const fileRes = await fetch(FILE_URL);
    if (!fileRes.ok) throw new Error(`Kan bestand niet ophalen: ${fileRes.status}`);
    const buffer = await fileRes.arrayBuffer();

    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

    const sheetName = workbook.SheetNames.find(n => n.trim().toLowerCase().includes('jan') && n.includes('2026'));
    if (!sheetName) return Response.json({ error: 'Sheet Jan 2026 niet gevonden' }, { status: 404 });

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    const headerIdx = rows.findIndex(r => r && r.some(c => typeof c === 'string' && c.toLowerCase().includes('dagfee')));
    if (headerIdx === -1) return Response.json({ error: 'Headerrij niet gevonden' }, { status: 400 });

    const headers = rows[headerIdx];
    const salesNames = [headers[17], headers[18], headers[19], headers[20], headers[21]].filter(Boolean);

    // Build Excel data map keyed by "firstname lastname|company"
    const excelMap = {};
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const consultantName = typeof row[6] === 'string' ? row[6].trim() : null;
      const clientCompany = typeof row[5] === 'string' ? row[5].trim() : null;
      const clientRate = parseFloat(row[2]);
      if (!consultantName || !clientCompany || isNaN(clientRate) || clientRate < 50) continue;

      const margePerDag = parseFloat(row[3]) || 0;
      const consultantRate = clientRate - margePerDag;
      const daysWorked = parseFloat(row[9]) || 0;
      const omzet = parseFloat(row[10]) || (daysWorked * clientRate);
      const totalMarge = parseFloat(row[11]) || (daysWorked * margePerDag);

      let startDate = null, endDate = null;
      if (row[0]) { try { startDate = new Date(row[0]).toISOString().split('T')[0]; } catch {} }
      if (row[1]) { try { endDate = new Date(row[1]).toISOString().split('T')[0]; } catch {} }

      const salesContributors = [];
      for (let s = 0; s < salesNames.length; s++) {
        const pct = parseFloat(row[17 + s]);
        if (!isNaN(pct) && pct > 0 && salesNames[s]) {
          salesContributors.push({ name: salesNames[s], percentage: pct });
        }
      }

      const key = `${consultantName.toLowerCase()}|${clientCompany.toLowerCase()}`;
      excelMap[key] = { clientRate, consultantRate, margePerDag, daysWorked, omzet, totalMarge, startDate, endDate, salesContributors, consultantName, clientCompany };
    }

    // Fetch all placements
    const placements = await base44.asServiceRole.entities.Placement.list();

    let updated = 0;
    let skipped = 0;
    const details = [];

    for (const placement of placements) {
      const fullName = `${placement.consultant_first_name} ${placement.consultant_last_name}`.trim();
      const company = (placement.client_company_name || '').trim();
      const key = `${fullName.toLowerCase()}|${company.toLowerCase()}`;

      const excelRow = excelMap[key];
      if (!excelRow) {
        skipped++;
        continue;
      }

      // Update placement with rates, dates, and sales contributors
      const updateData = {
        client_rate: excelRow.clientRate,
        consultant_rate: excelRow.consultantRate > 0 ? excelRow.consultantRate : 0,
        sales_contributors: excelRow.salesContributors,
      };
      if (excelRow.startDate) updateData.start_date = excelRow.startDate;
      if (excelRow.endDate) updateData.end_date = excelRow.endDate;

      await base44.asServiceRole.entities.Placement.update(placement.id, updateData);

      // Update or create Jan 2026 timesheet
      if (excelRow.daysWorked > 0) {
        const timesheets = await base44.asServiceRole.entities.Timesheet.filter({ placement_id: placement.id, month: 1, year: 2026 });
        const tsData = {
          placement_id: placement.id,
          month: 1, year: 2026,
          days_worked: excelRow.daysWorked,
          client_revenue: excelRow.omzet,
          consultant_revenue: excelRow.daysWorked * excelRow.consultantRate,
          margin: excelRow.totalMarge,
          status: 'approved',
          consultant_name: fullName,
          client_company: company,
        };
        if (timesheets.length > 0) {
          await base44.asServiceRole.entities.Timesheet.update(timesheets[0].id, tsData);
        } else {
          await base44.asServiceRole.entities.Timesheet.create(tsData);
        }
      }

      details.push(`${fullName} @ ${company}: ${excelRow.clientRate}€/dag`);
      updated++;
    }

    return Response.json({ success: true, updated, skipped, details });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});