import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const timesheets = await base44.asServiceRole.entities.Timesheet.list();
    const invoices = await base44.asServiceRole.entities.Invoice.list();

    let updated = 0;
    let skipped = 0;

    for (const ts of timesheets) {
      const clientRevenue = ts.client_revenue || 0;
      const consultantRevenue = ts.consultant_revenue || 0;

      if (clientRevenue === 0 && consultantRevenue === 0) { skipped++; continue; }

      const linked = invoices.filter(inv => inv.timesheet_id === ts.id);

      for (const inv of linked) {
        let amount;
        if (inv.invoice_type === 'client_invoice') {
          amount = clientRevenue;
        } else {
          amount = consultantRevenue;
        }

        const vatAmount = Math.round(amount * 0.21 * 100) / 100;
        const totalAmount = Math.round((amount + vatAmount) * 100) / 100;

        await base44.asServiceRole.entities.Invoice.update(inv.id, {
          amount,
          vat_amount: vatAmount,
          total_amount: totalAmount,
        });
        updated++;
      }
    }

    return Response.json({ success: true, updated, skipped });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});