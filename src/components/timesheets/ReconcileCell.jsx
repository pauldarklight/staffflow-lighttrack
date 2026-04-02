import React from 'react';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function ReconcileCell({ expected, invoice, match, label }) {
  if (!invoice) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MinusCircle className="w-3.5 h-3.5" />
        <span>Geen factuur</span>
      </div>
    );
  }

  if (match) {
    return (
      <div className="flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="font-medium">{formatCurrency(invoice.amount)}</span>
      </div>
    );
  }

  return (
    <div className="text-xs">
      <div className="flex items-center gap-1 text-red-600 font-medium">
        <XCircle className="w-3.5 h-3.5" />
        <span>Afwijking</span>
      </div>
      <div className="text-muted-foreground mt-0.5">
        Verwacht: {formatCurrency(expected)}
      </div>
      <div className="text-red-500">
        Factuur: {formatCurrency(invoice.amount)}
      </div>
    </div>
  );
}