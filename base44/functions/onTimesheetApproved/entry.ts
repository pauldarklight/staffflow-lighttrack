import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();

  const { event, data } = body;

  // Only process update events where status changed to 'approved'
  if (event?.type !== 'update' || data?.status !== 'approved') {
    return Response.json({ skipped: true, reason: 'not an approval event' });
  }

  const timesheet = data;
  const placementId = timesheet.placement_id;

  if (!placementId) {
    return Response.json({ skipped: true, reason: 'no placement_id' });
  }

  // Fetch placement for rates and client info
  const placements = await base44.asServiceRole.entities.Placement.filter({ id: placementId });
  const placement = placements[0];
  if (!placement) {
    return Response.json({ error: 'Placement not found' }, { status: 404 });
  }

  const days = timesheet.days_worked || 0;
  const clientRate = placement.client_rate || 0;
  const consultantRate = placement.consultant_rate || 0;
  const clientAmount = days * clientRate;
  const consultantAmount = days * consultantRate;
  const vatRate = 0.21;
  const today = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Check if invoices already exist for this timesheet
  const existing = await base44.asServiceRole.entities.Invoice.filter({ timesheet_id: timesheet.id });
  const hasClientInvoice = existing.some(i => i.invoice_type === 'client_invoice');
  const hasConsultantInvoice = existing.some(i => i.invoice_type === 'consultant_invoice');

  const created = [];

  if (!hasClientInvoice && clientAmount > 0) {
    const inv = await base44.asServiceRole.entities.Invoice.create({
      timesheet_id: timesheet.id,
      placement_id: placementId,
      invoice_type: 'client_invoice',
      amount: clientAmount,
      vat_amount: clientAmount * vatRate,
      total_amount: clientAmount * (1 + vatRate),
      status: 'draft',
      issue_date: today,
      due_date: dueDate,
      month: timesheet.month,
      year: timesheet.year,
      consultant_name: timesheet.consultant_name || '',
      client_company: timesheet.client_company || placement.client_company_name || '',
      payment_terms_days: 30,
    });
    created.push({ type: 'client_invoice', id: inv.id });
  }

  if (!hasConsultantInvoice && consultantAmount > 0) {
    const inv = await base44.asServiceRole.entities.Invoice.create({
      timesheet_id: timesheet.id,
      placement_id: placementId,
      invoice_type: 'consultant_invoice',
      amount: consultantAmount,
      vat_amount: consultantAmount * vatRate,
      total_amount: consultantAmount * (1 + vatRate),
      status: 'draft',
      issue_date: today,
      due_date: dueDate,
      month: timesheet.month,
      year: timesheet.year,
      consultant_name: timesheet.consultant_name || '',
      client_company: timesheet.client_company || placement.client_company_name || '',
      payment_terms_days: 30,
    });
    created.push({ type: 'consultant_invoice', id: inv.id });
  }

  return Response.json({
    success: true,
    invoices_created: created.length,
    invoices: created,
  });
});