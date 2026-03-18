import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCurrency, getMonthName, getQuarter } from '@/lib/formatters';

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));

  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: placements = [] } = useQuery({ queryKey: ['placements'], queryFn: () => base44.entities.Placement.list() });

  const yearTs = timesheets.filter(t => t.year === parseInt(year));
  const yearInv = invoices.filter(i => i.year === parseInt(year));

  // Monthly overview
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mTs = yearTs.filter(t => t.month === m);
    return {
      name: getMonthName(m).slice(0, 3),
      omzet: mTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
      kost: mTs.reduce((s, t) => s + (t.consultant_revenue || 0), 0),
      marge: mTs.reduce((s, t) => s + (t.margin || 0), 0),
    };
  });

  // Revenue per client
  const clientData = {};
  yearTs.forEach(t => {
    if (t.client_company) {
      if (!clientData[t.client_company]) clientData[t.client_company] = { omzet: 0, marge: 0 };
      clientData[t.client_company].omzet += t.client_revenue || 0;
      clientData[t.client_company].marge += t.margin || 0;
    }
  });
  const clientTable = Object.entries(clientData).sort(([,a],[,b]) => b.omzet - a.omzet);

  // Margin per consultant
  const consultantData = {};
  yearTs.forEach(t => {
    if (t.consultant_name) {
      if (!consultantData[t.consultant_name]) consultantData[t.consultant_name] = { omzet: 0, kost: 0, marge: 0 };
      consultantData[t.consultant_name].omzet += t.client_revenue || 0;
      consultantData[t.consultant_name].kost += t.consultant_revenue || 0;
      consultantData[t.consultant_name].marge += t.margin || 0;
    }
  });
  const consultantTable = Object.entries(consultantData).sort(([,a],[,b]) => b.marge - a.marge);

  // Sales contributors overview
  const salesData = {};
  placements.forEach(p => {
    const pTs = yearTs.filter(t => t.placement_id === p.id);
    const totalMargin = pTs.reduce((s, t) => s + (t.margin || 0), 0);
    const totalRevenue = pTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
    (p.sales_contributors || []).forEach(sc => {
      if (sc.name) {
        if (!salesData[sc.name]) salesData[sc.name] = { omzet: 0, marge: 0 };
        const pct = (sc.percentage || 0) / 100;
        salesData[sc.name].omzet += totalRevenue * pct;
        salesData[sc.name].marge += totalMargin * pct;
      }
    });
  });
  const salesTable = Object.entries(salesData).sort(([,a],[,b]) => b.marge - a.marge);

  // Commission per quarter for sales
  const quarterCommission = {};
  placements.forEach(p => {
    const pTs = yearTs.filter(t => t.placement_id === p.id);
    (p.sales_contributors || []).forEach(sc => {
      if (sc.name) {
        pTs.forEach(t => {
          const q = getQuarter(t.month);
          const key = `${sc.name}-${q}`;
          if (!quarterCommission[key]) quarterCommission[key] = { name: sc.name, quarter: q, marge: 0 };
          quarterCommission[key].marge += (t.margin || 0) * ((sc.percentage || 0) / 100);
        });
      }
    });
  });
  const commissionTable = Object.values(quarterCommission).sort((a, b) => {
    const qOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    return qOrder[a.quarter] - qOrder[b.quarter] || a.name.localeCompare(b.name);
  });

  // Cash planning
  const cashData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mTs = yearTs.filter(t => t.month === m);
    const weeklyMargin = mTs.reduce((s, t) => s + (t.margin || 0), 0) / 4;
    const clientInv = yearInv.filter(inv => inv.month === m && inv.invoice_type === 'client_invoice');
    const avgTerms = clientInv.length > 0 ? clientInv.reduce((s, inv) => s + (inv.payment_terms_days || 30), 0) / clientInv.length : 30;
    return {
      name: getMonthName(m).slice(0, 3),
      weekelijkse_marge: Math.round(weeklyMargin),
      gem_betalingstermijn: Math.round(avgTerms),
      verwachte_inkomsten: mTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
    };
  });

  // Invoiced status
  const invoicedConsultants = yearInv.filter(i => i.invoice_type === 'consultant_invoice' && i.status === 'paid');
  const invoicedClients = yearInv.filter(i => i.invoice_type === 'client_invoice');

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  return (
    <div>
      <PageHeader title="Rapportering" subtitle="Overzichten en analyses">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs defaultValue="monthly" className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="monthly">Maandoverzicht</TabsTrigger>
          <TabsTrigger value="clients">Per Klant</TabsTrigger>
          <TabsTrigger value="consultants">Per Consultant</TabsTrigger>
          <TabsTrigger value="sales">Per Sales</TabsTrigger>
          <TabsTrigger value="commission">Commissie</TabsTrigger>
          <TabsTrigger value="cash">Cashplanning</TabsTrigger>
          <TabsTrigger value="invoiced">Facturatiestatus</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader><CardTitle className="text-base">Maandelijks Overzicht {year}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} name="Omzet" />
                  <Bar dataKey="marge" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} name="Marge" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader><CardTitle className="text-base">Omzet & Marge per Klant</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Klant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
                </tr></thead>
                <tbody>
                  {clientTable.map(([name, data]) => (
                    <tr key={name} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{name}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(data.omzet)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(data.marge)}</td>
                      <td className="py-3 px-4 text-right">{data.omzet > 0 ? ((data.marge / data.omzet) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultants">
          <Card>
            <CardHeader><CardTitle className="text-base">Marge per Consultant</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultant</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
                </tr></thead>
                <tbody>
                  {consultantTable.map(([name, data]) => (
                    <tr key={name} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{name}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(data.omzet)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(data.kost)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(data.marge)}</td>
                      <td className="py-3 px-4 text-right">{data.omzet > 0 ? ((data.marge / data.omzet) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card>
            <CardHeader><CardTitle className="text-base">Overzicht per Commerciële Consultant</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sales</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Toeg. Omzet</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Toeg. Marge</th>
                </tr></thead>
                <tbody>
                  {salesTable.map(([name, data]) => (
                    <tr key={name} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{name}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(data.omzet)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(data.marge)}</td>
                    </tr>
                  ))}
                  {salesTable.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Geen sales contributors gekoppeld aan placements</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commission">
          <Card>
            <CardHeader><CardTitle className="text-base">Commissie per Kwartaal</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sales</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kwartaal</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Toeg. Marge</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Commissie (schatting)</th>
                </tr></thead>
                <tbody>
                  {commissionTable.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{row.name}</td>
                      <td className="py-3 px-4">{row.quarter}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(row.marge)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-primary">{formatCurrency(row.marge * 0.1)}</td>
                    </tr>
                  ))}
                  {commissionTable.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Geen commissiedata beschikbaar</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card>
            <CardHeader><CardTitle className="text-base">Cashplanning {year}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={cashData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="verwachte_inkomsten" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Verwachte inkomsten" />
                  <Line type="monotone" dataKey="weekelijkse_marge" stroke="hsl(262, 83%, 58%)" strokeWidth={2} name="Wekelijkse marge" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoiced">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Klantfacturen</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Klant</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Bedrag</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {invoicedClients.map(i => (
                      <tr key={i.id} className="border-b border-border/50">
                        <td className="py-3 px-4">{i.client_company || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(i.total_amount || i.amount)}</td>
                        <td className="py-3 px-4"><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}
                    {invoicedClients.length === 0 && (
                      <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Geen klantfacturen</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Ontvangen Consultantfacturen</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Consultant</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Bedrag</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr></thead>
                  <tbody>
                    {invoicedConsultants.map(i => (
                      <tr key={i.id} className="border-b border-border/50">
                        <td className="py-3 px-4">{i.consultant_name || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(i.total_amount || i.amount)}</td>
                        <td className="py-3 px-4"><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}
                    {invoicedConsultants.length === 0 && (
                      <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Geen consultantfacturen</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}