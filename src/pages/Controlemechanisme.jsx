import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import VerificationTab from '@/components/reports/VerificationTab';
import PageHeader from '@/components/shared/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Controlemechanisme() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
  });

  const { data: placements = [] } = useQuery({
    queryKey: ['placements'],
    queryFn: () => base44.entities.Placement.list(),
  });

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  return (
    <div>
      <PageHeader title="Controlemechanisme" subtitle="Factuurbedragen vergelijken met timesheet-berekeningen">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <VerificationTab timesheets={timesheets} invoices={invoices} placements={placements} year={year} />
    </div>
  );
}