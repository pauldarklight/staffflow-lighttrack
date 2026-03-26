import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function MissedInvoices({ invoices }) {
  const [open, setOpen] = useState(false);
  const now = new Date();

  const overdue = invoices.filter(i => {
    if (i.status === 'paid') return false;
    if (!i.due_date) return i.status === 'sent';
    return new Date(i.due_date) < now && i.status !== 'paid';
  }).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

  const totalAmount = overdue.reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);

  return (
    <Card className={`cursor-pointer transition-all ${overdue.length > 0 ? 'border-red-300 bg-red-50/40' : 'border-border'}`}
      onClick={() => overdue.length > 0 && setOpen(v => !v)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className={`w-5 h-5 ${overdue.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            <CardTitle className="text-sm font-semibold">Gemiste Facturen</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{overdue.length}</span>
            {overdue.length > 0 && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{overdue.length > 0 ? `Totaal: ${formatCurrency(totalAmount)}` : 'Geen achterstallige facturen'}</p>
      </CardHeader>
      {open && overdue.length > 0 && (
        <CardContent className="pt-0">
          <div className="border-t pt-3 space-y-2">
            {overdue.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{i.client_company || i.consultant_name || '—'}</span>
                  {i.invoice_number && <span className="text-muted-foreground text-xs ml-2">#{i.invoice_number}</span>}
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">{formatCurrency(i.total_amount || i.amount || 0)}</div>
                  {i.due_date && <div className="text-xs text-muted-foreground">Vervallen: {formatDate(i.due_date)}</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}