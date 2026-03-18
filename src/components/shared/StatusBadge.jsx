import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ended: 'bg-slate-100 text-slate-600 border-slate-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  signed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  expired: 'bg-red-100 text-red-600 border-red-200',
  requested: 'bg-amber-100 text-amber-700 border-amber-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-100 text-red-600 border-red-200',
};

const statusLabels = {
  active: 'Actief',
  ended: 'Beëindigd',
  on_hold: 'On hold',
  draft: 'Concept',
  sent: 'Verstuurd',
  signed: 'Getekend',
  expired: 'Verlopen',
  requested: 'Aangevraagd',
  submitted: 'Ingediend',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  paid: 'Betaald',
  overdue: 'Achterstallig',
  client_invoice: 'Klant',
  consultant_invoice: 'Consultant',
  client: 'Klant',
  consultant: 'Consultant',
};

export default function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn('font-medium', statusStyles[status] || 'bg-slate-100 text-slate-600')}>
      {statusLabels[status] || status}
    </Badge>
  );
}