import React, { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Parses a CSV exported from Oki Oki.
 * We try to auto-detect columns for: invoice number, amount (excl. VAT), client name, date.
 * Returns array of { invoiceNumber, clientName, amount, date, raw }
 */
function parseOkiOkiCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect separator: ; or ,
  const sep = lines[0].includes(';') ? ';' : ',';

  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  // Try to find relevant columns by common Oki Oki header names
  const findCol = (...candidates) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colNumber = findCol('nummer', 'number', 'factuurnummer', 'invoice number', 'ref', 'referentie');
  const colAmount = findCol('bedrag excl', 'excl. btw', 'excl btw', 'amount excl', 'subtotal', 'netto', 'bedrag');
  const colTotal  = findCol('totaal', 'total', 'incl. btw', 'incl btw', 'amount incl');
  const colClient = findCol('klant', 'client', 'naam', 'name', 'company', 'bedrijf');
  const colDate   = findCol('datum', 'date', 'factuurdatum', 'invoice date');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields
    const cells = line.split(sep).map(c => c.replace(/^"|"$/g, '').trim());

    const parseAmt = (idx) => {
      if (idx === -1 || !cells[idx]) return null;
      const raw = cells[idx].replace(/\s/g, '').replace(',', '.');
      const num = parseFloat(raw);
      return isNaN(num) ? null : num;
    };

    const amount = parseAmt(colAmount) ?? parseAmt(colTotal);

    rows.push({
      invoiceNumber: colNumber !== -1 ? cells[colNumber] : `rij-${i}`,
      clientName:    colClient !== -1 ? cells[colClient] : '—',
      amount:        amount ?? 0,
      date:          colDate !== -1 ? cells[colDate] : '',
      raw:           cells,
    });
  }
  return rows;
}

export default function OkiOkiImport({ onImport, importedData }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setError('Enkel CSV-bestanden worden ondersteund.');
      return;
    }
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseOkiOkiCsv(e.target.result);
        if (rows.length === 0) {
          setError('Geen gegevens gevonden in het bestand. Controleer of het een geldig Oki Oki CSV-export is.');
          return;
        }
        onImport(rows);
      } catch (err) {
        setError('Fout bij verwerking van het bestand: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleClear = () => {
    onImport(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card className="border-dashed border-2 border-border bg-muted/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Oki Oki CSV import</p>
              <p className="text-xs text-muted-foreground">Exporteer facturen uit Oki Oki en upload het CSV-bestand</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {importedData ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {fileName} — {importedData.length} facturen geladen
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={handleClear}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  CSV uploaden
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}