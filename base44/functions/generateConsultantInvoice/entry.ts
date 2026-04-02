import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import PizZip from 'npm:pizzip@3.1.7';
import Docxtemplater from 'npm:docxtemplater@3.50.0';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('nl-BE');
}

function fmtCurrency(n) {
  if (!n && n !== 0) return '';
  return `€ ${Number(n).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMonthName(m) {
  const names = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
  return names[(m || 1) - 1] || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { placement_id, timesheet_id, month, year, language = 'nl', invoice_for = 'consultant' } = await req.json();

    // Fetch placement
    const placements = await base44.asServiceRole.entities.Placement.filter({ id: placement_id });
    const placement = placements[0];
    if (!placement) return Response.json({ error: 'Placement niet gevonden' }, { status: 404 });

    // Fetch timesheet (optional, use for days_worked)
    let timesheet = null;
    if (timesheet_id) {
      const ts = await base44.asServiceRole.entities.Timesheet.filter({ id: timesheet_id });
      timesheet = ts[0] || null;
    } else if (month && year) {
      const ts = await base44.asServiceRole.entities.Timesheet.filter({ placement_id, month, year });
      timesheet = ts[0] || null;
    }

    const daysWorked = timesheet?.days_worked || 0;
    const consultantRate = placement.consultant_rate || 0;
    const amountExcl = daysWorked * consultantRate;
    const vatAmount = amountExcl * 0.21;
    const amountIncl = amountExcl + vatAmount;
    const invoiceMonth = timesheet?.month || month;
    const invoiceYear = timesheet?.year || year;

    // Find active invoice template
    const templateType = invoice_for === 'client' ? 'invoice_client' : 'invoice_consultant';
    const allTemplates = await base44.asServiceRole.entities.Template.filter({ template_type: templateType, is_active: true });
    const template = allTemplates.find(t => t.language === language) || allTemplates[0];
    if (!template || !template.file_url) {
      return Response.json({ error: 'Geen actief sjabloon gevonden voor type "invoice_consultant"' }, { status: 404 });
    }

    // Download template
    const fileRes = await fetch(template.file_url);
    if (!fileRes.ok) return Response.json({ error: 'Sjabloonbestand kon niet worden gedownload' }, { status: 500 });
    const fileBuffer = await fileRes.arrayBuffer();

    const consultantName = `${placement.consultant_first_name || ''} ${placement.consultant_last_name || ''}`.trim();
    const issueDate = new Date().toISOString().split('T')[0];
    const paymentDays = placement.payment_terms_consultant || 30;
    const dueDate = new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = {
      consultant_name: consultantName,
      consultant_first_name: placement.consultant_first_name || '',
      consultant_last_name: placement.consultant_last_name || '',
      consultant_company: placement.consultant_company_name || '',
      consultant_vat: placement.consultant_vat_number || '',
      consultant_address: placement.consultant_company_address || placement.consultant_personal_address || '',
      client_company: placement.client_company_name || '',
      client_vat: placement.client_vat_number || '',
      client_address: placement.client_address || '',
      client_billing_email: placement.client_billing_email || '',
      start_date: fmtDate(placement.start_date),
      end_date: fmtDate(placement.end_date),
      consultant_rate: fmtCurrency(consultantRate),
      consultant_rate_raw: consultantRate,
      days_worked: daysWorked,
      amount_excl: fmtCurrency(amountExcl),
      amount_excl_raw: amountExcl,
      vat_amount: fmtCurrency(vatAmount),
      vat_amount_raw: vatAmount,
      amount_incl: fmtCurrency(amountIncl),
      amount_incl_raw: amountIncl,
      month: invoiceMonth,
      month_name: getMonthName(invoiceMonth),
      year: invoiceYear,
      issue_date: fmtDate(issueDate),
      due_date: fmtDate(dueDate),
      payment_terms_days: paymentDays,
      reference_instructions: placement.reference_instructions || '',
      notes: placement.notes || '',
    };

    const zip = new PizZip(fileBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    const output = doc.getZip().generate({ type: 'uint8array' });

    const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const safeConsultant = consultantName.replace(/\s+/g, '_');
    const fileName = `Factuur_${safeConsultant}_${getMonthName(invoiceMonth)}_${invoiceYear}.docx`;

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });

    return Response.json({ file_url, file_name: fileName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});