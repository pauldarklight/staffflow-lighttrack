import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import PizZip from 'npm:pizzip@3.1.7';
import Docxtemplater from 'npm:docxtemplater@3.50.0';

const TYPE_MAP = {
  client: 'contract_client',
  consultant: 'contract_consultant',
  subcontractor: 'contract_subcontractor',
  addendum: 'contract_addendum',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('nl-BE');
}

function fmtCurrency(n) {
  if (!n && n !== 0) return '';
  return `€ ${Number(n).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { placement_id, contract_type, language = 'nl' } = await req.json();

    // Fetch placement
    const placements = await base44.asServiceRole.entities.Placement.filter({ id: placement_id });
    const placement = placements[0];
    if (!placement) return Response.json({ error: 'Placement niet gevonden' }, { status: 404 });

    // Find active template
    const template_type = TYPE_MAP[contract_type] || `contract_${contract_type}`;
    const allTemplates = await base44.asServiceRole.entities.Template.filter({ template_type, is_active: true });
    // Try matching language first, then fallback to any active
    const template = allTemplates.find(t => t.language === language) || allTemplates[0];
    if (!template || !template.file_url) {
      return Response.json({ error: `Geen actief sjabloon gevonden voor type "${template_type}" (${language})` }, { status: 404 });
    }

    // Download template file
    const fileRes = await fetch(template.file_url);
    if (!fileRes.ok) return Response.json({ error: 'Sjabloonbestand kon niet worden gedownload' }, { status: 500 });
    const fileBuffer = await fileRes.arrayBuffer();

    // Build placeholder data
    const consultantName = `${placement.consultant_first_name || ''} ${placement.consultant_last_name || ''}`.trim();
    const data = {
      job_title: placement.job_title || '',
      job_description: placement.job_description || '',
      consultant_company: placement.consultant_company_name || '',
      consultant_vat: placement.consultant_vat_number || '',
      consultant_address: placement.consultant_company_address || '',
      client_company: placement.client_company_name || '',
      client_vat: placement.client_vat_number || '',
      client_address: placement.client_address || '',
      client_billing_email: placement.client_billing_email || '',
      start_date: fmtDate(placement.start_date),
      end_date: fmtDate(placement.end_date),
      client_rate: fmtCurrency(placement.client_rate),
      consultant_rate: fmtCurrency(placement.consultant_rate),
      billing_client_rate: fmtCurrency(placement.client_rate),
      paying_consultant_rate: fmtCurrency(placement.consultant_rate),
      client_rate_raw: placement.client_rate || '',
      consultant_rate_raw: placement.consultant_rate || '',
      billing_rate: fmtCurrency(placement.client_rate),
      billing_rate_raw: placement.client_rate || '',
      consultant_personal_address: placement.consultant_personal_address || '',
      days_per_week: placement.days_per_week || 5,
      agoria_index_client: placement.agoria_index_client || '',
      agoria_index_consultant: placement.agoria_index_consultant || '',
      notice_period_client: placement.notice_period_client || '',
      notice_period_consultant: placement.notice_period_consultant || '',
      reference_instructions: placement.reference_instructions || '',
      notes: placement.notes || '',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      current_date: fmtDate(new Date().toISOString()),
    };

    // Fill DOCX placeholders
    const zip = new PizZip(fileBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    const output = doc.getZip().generate({ type: 'uint8array' });

    // Upload generated file and return URL
    const blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const formData = new FormData();
    const safeConsultant = consultantName.replace(/\s+/g, '_');
    const fileName = `${safeConsultant}_${contract_type}_${language}.docx`;
    formData.append('file', blob, fileName);

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });

    return Response.json({ file_url, file_name: fileName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});