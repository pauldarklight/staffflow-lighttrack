import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * KOLOMSTRUCTUUR (vastgelegd door gebruiker):
 * - Rij 1-4: negeren (headers/titels staan op rij 5, data vanaf rij 6)
 * - Kolom B  = start_date (startdatum freelancer)
 * - Kolom C  = client_rate (dagtarief klant)
 * - Kolom D  = marge_per_dag (marge per dag → consultant_rate = C - D)
 * - Kolom E  = weekly_gross_profit (negeren)
 * - Kolom F  = client_company (naam klant)
 * - Kolom G  = consultant_name (naam consultant)
 * - Kolom J  = days_worked (aantal gepresteerde dagen die maand)
 * - Kolom K  = omzet (client_rate * days_worked)
 * - Kolom L  = margin (marge die maand)
 * - Kolom R  = sales_paul (%)
 * - Kolom S  = sales_yunes (%)
 * - Kolom T  = sales_thomas (%)
 * - Kolom U  = sales_maxim (%)
 * - Kolom V  = sales_arthur (%)
 * - Kolom W  = sales_marloes (%)
 */

// Column letter to 0-based index
function colIndex(letter) {
  letter = letter.toUpperCase();
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

function cellVal(sheet, col, rowIndex) {
  const cellAddr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex(col) });
  const cell = sheet[cellAddr];
  if (!cell) return null;
  return cell.v !== undefined ? cell.v : null;
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

function excelSerialToDate(serial) {
  // Excel serial: days since 1900-01-01 (with Lotus 1-2-3 leap year bug: serial 60 = fake 1900-02-29)
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899
  const d = new Date(epoch.getTime() + serial * 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(val) {
  if (!val) return null;
  // Excel serial date (number)
  if (typeof val === 'number' && val > 1000) {
    return excelSerialToDate(val);
  }
  // String date
  const s = String(val).trim();
  // dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // yyyy-mm-dd
  const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
  return s || null;
}

const SALES_PEOPLE = [
  { col: 'R', name: 'Paul' },
  { col: 'S', name: 'Yunes' },
  { col: 'T', name: 'Thomas' },
  { col: 'U', name: 'Maxim' },
  { col: 'V', name: 'Arthur' },
  { col: 'W', name: 'Marloes' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, month, year, sheet_name } = await req.json();
    if (!file_url) return Response.json({ error: 'Geen bestand meegegeven' }, { status: 400 });

    // Download the file
    const fileRes = await fetch(file_url);
    const arrayBuffer = await fileRes.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(uint8, { type: 'array', cellDates: false });

    // Sheet selection: use provided name, or match by month string, or first sheet
    let sheetName = sheet_name || workbook.SheetNames[0];
    if (!sheet_name && month) {
      const match = workbook.SheetNames.find(s => s.toLowerCase().includes(String(month).toLowerCase()));
      if (match) sheetName = match;
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return Response.json({ error: `Sheet "${sheetName}" niet gevonden` }, { status: 400 });
    }

    // Find the actual data range
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const totalRows = range.e.r + 1;

    // Data starts at row index 5 (0-based) = rij 6 in Excel (rij 5 = headers)
    const DATA_START_ROW = 5; // 0-based index

    const rows = [];

    for (let r = DATA_START_ROW; r < totalRows; r++) {
      const consultant_name = cellVal(sheet, 'G', r);
      const client_company = cellVal(sheet, 'F', r);

      // Skip empty rows
      if (!consultant_name && !client_company) continue;
      if (!consultant_name || String(consultant_name).trim() === '') continue;

      const client_rate = parseNum(cellVal(sheet, 'C', r));
      const marge_per_dag = parseNum(cellVal(sheet, 'D', r));
      const consultant_rate = (client_rate !== null && marge_per_dag !== null)
        ? client_rate - marge_per_dag
        : null;

      const days_worked = parseNum(cellVal(sheet, 'J', r)) || 0;
      const omzet = parseNum(cellVal(sheet, 'K', r));
      const margin = parseNum(cellVal(sheet, 'L', r));
      const start_date = parseDate(cellVal(sheet, 'B', r));

      // Sales contributors (filter out 0% and null)
      const sales_contributors = SALES_PEOPLE
        .map(sp => {
          const pct = parseNum(cellVal(sheet, sp.col, r));
          return pct && pct > 0 ? { name: sp.name, percentage: Math.round(pct * (pct <= 1 ? 100 : 1)) } : null;
        })
        .filter(Boolean);

      rows.push({
        consultant_name: String(consultant_name).trim(),
        client_company: String(client_company || '').trim(),
        start_date,
        client_rate,
        consultant_rate,
        marge_per_dag,
        days_worked,
        omzet,
        margin,
        sales_contributors,
      });
    }

    // Determine month/year from sheet name if not provided
    let detectedMonth = month ? parseInt(month) : null;
    let detectedYear = year ? parseInt(year) : null;

    if (!detectedMonth || !detectedYear) {
      const MONTHS_NL = ['jan','feb','maa','mar','apr','mei','jun','jul','aug','sep','okt','oct','nov','dec'];
      const MONTHS_EN = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const sLow = sheetName.toLowerCase();
      MONTHS_NL.forEach((m, i) => { if (sLow.includes(m)) detectedMonth = detectedMonth || (i < 2 ? i+1 : i === 2 || i === 3 ? i+1 : i+1); });
      if (!detectedMonth) MONTHS_EN.forEach((m, i) => { if (sLow.includes(m)) detectedMonth = i + 1; });
      const yearMatch = sheetName.match(/20\d{2}/);
      if (yearMatch) detectedYear = parseInt(yearMatch[0]);
    }

    return Response.json({
      rows,
      sheet_name: sheetName,
      total_sheets: workbook.SheetNames.length,
      sheets: workbook.SheetNames,
      detected_month: detectedMonth,
      detected_year: detectedYear,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});