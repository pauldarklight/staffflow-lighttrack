import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Uses the free EU VIES REST API — no API key required
// Docs: https://ec.europa.eu/taxation_customs/vies/rest-api

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { vat_number } = await req.json();
    if (!vat_number) return Response.json({ error: 'Geen BTW-nummer opgegeven' }, { status: 400 });

    // Normalize: strip spaces, dots, dashes — extract country code + number
    const cleaned = vat_number.replace(/[\s.\-]/g, '').toUpperCase();
    const countryCode = cleaned.match(/^[A-Z]{2}/) ? cleaned.slice(0, 2) : 'BE';
    const vatNum = cleaned.replace(/^[A-Z]{2}/, '');

    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNum}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
      return Response.json({ valid: false, error: 'BTW-nummer kon niet worden opgezocht via VIES' }, { status: 200 });
    }

    const data = await res.json();

    if (!data.isValid) {
      return Response.json({ valid: false, message: 'BTW-nummer is niet geldig of niet actief in VIES' });
    }

    // Parse address from VIES (format varies per country, typically "STREET\nPOSTAL CITY")
    const rawAddress = data.address || '';
    const lines = rawAddress.split('\n').map(l => l.trim()).filter(Boolean);

    return Response.json({
      valid: true,
      company_name: data.name || '',
      raw_address: rawAddress,
      address_lines: lines,
      country_code: countryCode,
      vat_number: `${countryCode}${vatNum}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});