import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function MissingTimesheets({ placements, timesheets }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const activeFree = placements.filter(p => p.status === 'active' && (!p.placement_type || p.placement_type === 'freelancer'));
  const submitted = new Set(timesheets.filter(t => t.month === month && t.year === year).map(t => t.placement_id));
  const missing = activeFree.filter(p => !submitted.has(p.id));

  return (
    <Card className={`cursor-pointer transition-all ${missing.length > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/30'}`}
      onClick={() => missing.length > 0 && setOpen(v => !v)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${missing.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
            <CardTitle className="text-sm font-semibold">Ontbrekende Timesheets</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${missing.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{missing.length}</span>
            {missing.length > 0 && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Deze maand nog niet ingediend</p>
      </CardHeader>
      {open && missing.length > 0 && (
        <CardContent className="pt-0">
          <div className="border-t pt-3 space-y-2">
            {missing.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.consultant_first_name} {p.consultant_last_name}</span>
                <span className="text-muted-foreground text-xs">{p.client_company_name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}