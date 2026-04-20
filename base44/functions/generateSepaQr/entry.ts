import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import QRCode from 'npm:qrcode@^1.5.3';

// Generate SEPA QR code for iDEAL payments
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, invoice_number, iban, bic, creditor_name, description } = await req.json();

    if (!amount || !iban || !creditor_name) {
      return Response.json(
        { error: 'Missing required fields: amount, iban, creditor_name' },
        { status: 400 }
      );
    }

    // Format amount: EUR with 2 decimals
    const amountStr = `EUR${(parseFloat(amount) || 0).toFixed(2)}`;

    // Build SEPA QR string (EPC standard)
    const sepaLines = [
      'BCD',                           // Service tag
      '002',                           // Version
      '1',                             // Encoding (UTF-8)
      'SCT',                           // Identification code
      (bic || '').toUpperCase() || '',  // BIC
      (iban || '').toUpperCase(),      // IBAN
      amountStr,                       // Amount
      '',                              // Purpose (empty)
      (invoice_number || '').substring(0, 35),  // Structured reference
      (creditor_name || '').substring(0, 70),   // Beneficiary name
      (description || '').substring(0, 140),    // Remittance info unstructured
    ];

    const sepaQr = sepaLines.join('\n');

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(sepaQr, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return Response.json({ qr_code: qrDataUrl, sepa_string: sepaQr });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});