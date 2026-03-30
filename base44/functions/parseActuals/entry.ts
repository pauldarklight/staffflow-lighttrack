import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const FILE_URL = 'https://media.base44.com/files/public/69babb9b316585d1576607e8/668a0c88f_KopievanActuals.xlsx';

    // Fetch the file
    const fileRes = await fetch(FILE_URL);
    if (!fileRes.ok) throw new Error(`Kan bestand niet ophalen: ${fileRes.status}`);
    const buffer = await fileRes.arrayBuffer();

    // Dynamically import xlsx
    const XLSX = await import('npm:xlsx@0.18.5');
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });

    // Find Jan 2026 sheet
    const sheetName = workbook.SheetNames.find(n => n.trim().toLowerCase().includes('jan') && n.includes('2026'));
    if (!sheetName) {
      return Response.json({ error: 'Sheet Jan 2026 niet gevonden', sheets: workbook.SheetNames }, { status: 404 });
    }

    const sheet = workbook.Sheets[sheetName];
    // Get as array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    const results = [];
    // Structure (from debug):
    // Row 4 (idx 4): headers - col0=start op, col1=loopt af op, col2=dagfee, col3=marge, col4=WGP, col5=Bedrijf, col6=Runner, col9=aantal dagen, col10=omzet, col11=marge, col17-21=Paul/Yunes/Thomas/Maxim/Arthur
    // Data starts at row 5 (idx 5)

    // Find header row dynamically
    const headerIdx = rows.findIndex(r => r && r.some(c => typeof c === 'string' && c.toLowerCase().includes('dagfee')));
    if (headerIdx === -1) return Response.json({ error: 'Headerrij niet gevonden' }, { status: 400 });

    const headers = rows[headerIdx];
    const salesNames = [headers[17], headers[18], headers[19], headers[20], headers[21]].filter(Boolean);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const consultantName = typeof row[6] === 'string' ? row[6].trim() : null;
      const clientCompany = typeof row[5] === 'string' ? row[5].trim() : null;
      const clientRate = parseFloat(row[2]);
      const margePerDag = parseFloat(row[3]);

      if (!consultantName || !clientCompany || isNaN(clientRate) || clientRate < 50) continue;

      const consultantRate = clientRate - (isNaN(margePerDag) ? 0 : margePerDag);
      const daysWorked = parseFloat(row[9]) || 0;
      const omzet = parseFloat(row[10]) || (daysWorked * clientRate);
      const totalMarge = parseFloat(row[11]) || (daysWorked * (isNaN(margePerDag) ? 0 : margePerDag));

      // Parse dates
      let startDate = null, endDate = null;
      if (row[0]) { try { startDate = new Date(row[0]).toISOString().split('T')[0]; } catch {} }
      if (row[1]) { try { endDate = new Date(row[1]).toISOString().split('T')[0]; } catch {} }

      // Sales contributors from cols 17-21
      const salesContributors = [];
      for (let s = 0; s < salesNames.length; s++) {
        const pct = parseFloat(row[17 + s]);
        if (!isNaN(pct) && pct > 0 && salesNames[s]) {
          salesContributors.push({ name: salesNames[s], percentage: pct });
        }
      }

      results.push({
        consultant_name: consultantName,
        client_company: clientCompany,
        client_rate: clientRate,
        marge_per_dag: isNaN(margePerDag) ? 0 : margePerDag,
        consultant_rate: consultantRate,
        days_worked: daysWorked,
        omzet,
        total_marge: totalMarge,
        start_date: startDate,
        end_date: endDate,
        sales_contributors: salesContributors,
      });
    }

    return Response.json({ success: true, sheet: sheetName, rows: results });
  } catch (e) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
});