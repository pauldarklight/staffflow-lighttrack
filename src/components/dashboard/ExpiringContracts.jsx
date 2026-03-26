import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

function effectiveEndDate(p) {
  if (p.extensions && p.extensions.length > 0) {
    const sorted = [...p.extensions].sort((a, b) => new Date(b.new_end_date) - new Date(a.new_end_date));
    if (sorted[0].new_end_date) return sorted[0].new_end_date;
  }
  return p.end_date || null;
}

export default function ExpiringContracts({ placements }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const in8weeks = new Date(now.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);

  const expiring = placements
    .filter(p => {
      if (p.status !== 'active') return false;
      if (p.placement_type === 'perm') return false;
      const end = effectiveEndDate(p);
      if (!end) return false;
      const endDate = new Date(end);
      return endDate >= now && endDate <= in8weeks;
    })
    .sort((a, b) => new Date(effectiveEndDate(a)) - new Date(effectiveEndDate(b)));

  const urgent = expiring.filter(p => {
    const end = new Date(effectiveEndDate(p));
    const diff = (end - now) / (1000 * 60 * 60 * 24);
    return diff <= 14;
  });

  return (
    <Card className={`cursor-pointer transition-all ${urgent.length > 0 ? 'border-red-300 bg-red-50/40' : expiring.length > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-border'}`}
      onClick={() => expiring.length > 0 && setOpen(v => !v)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${urgent.length > 0 ? 'text-red-500' : expiring.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            <CardTitle className="text-sm font-semibold">Aflopende Contracten</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${urgent.length > 0 ? 'text-red-500' : expiring.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{expiring.length}</span>
            {expiring.length > 0 && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Binnen 8 weken aflopend</p>
      </CardHeader>
      {open && expiring.length > 0 && (
        <CardContent className="pt-0">
          <div className="border-t pt-3 space-y-2">
            {expiring.map(p => {
              const end = effectiveEndDate(p);
              const daysLeft = Math.ceil((new Date(end) - now) / (1000 * 60 * 60 * 24));
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{p.consultant_first_name} {p.consultant_last_name}</span>
                    <span className="text-muted-foreground text-xs ml-2">{p.client_company_name}</span>
                  </div>
                  <span className={`text-xs font-semibold ${daysLeft <= 14 ? 'text-red-600' : 'text-amber-600'}`}>
                    {formatDate(end)} ({daysLeft}d)
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}