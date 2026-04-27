import React, { useState, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Award, Users, Target, Zap, PieChart, Download } from 'lucide-react';
import { exportToExcel } from '@/lib/exportReport';
import { useQuery } from '@tanstack/react-query';
import PersoneelslidTab from '@/components/reports/PersoneelslidTab';
import TargetTab from '@/components/reports/TargetTab';
import TargetVsActualTab from '@/components/reports/TargetVsActualTab';
import { MonthlyTab, ClientsTab, ConsultantsTab, SalesTab, CommissionTab, MargeopbouwTab, FacturatieTab, VergelijkingTab } from '@/components/reports/ReportTabs';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PageHeader from '@/components/shared/PageHeader';
import { formatCurrency, getMonthName, getQuarter } from '@/lib/formatters';

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [ytd, setYtd] = useState(false);
  const [viewMode, setViewMode] = useState('jaar'); // 'jaar' | 'kwartaal' | 'maand'
  const [filterQuarter, setFilterQuarter] = useState(String(Math.ceil((now.getMonth() + 1) / 3)));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));
  const currentMonth = now.getMonth() + 1; // 1-12

  const quarterMonths = { '1': [1,2,3], '2': [4,5,6], '3': [7,8,9], '4': [10,11,12] };

  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: () => base44.entities.Timesheet.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => base44.entities.Invoice.list() });
  const { data: placements = [] } = useQuery({ queryKey: ['placements'], queryFn: () => base44.entities.Placement.list() });

  const yearTs = timesheets.filter(t => {
    if (t.year !== parseInt(year)) return false;
    if (viewMode === 'maand') return t.month === parseInt(filterMonth);
    if (viewMode === 'kwartaal') return quarterMonths[filterQuarter]?.includes(t.month);
    return !ytd || t.month <= currentMonth;
  });
  const yearInv = invoices.filter(i => {
    if (i.year !== parseInt(year)) return false;
    if (viewMode === 'maand') return i.month === parseInt(filterMonth);
    if (viewMode === 'kwartaal') return quarterMonths[filterQuarter]?.includes(i.month);
    return !ytd || i.month <= currentMonth;
  });

  // Monthly overview
  const monthCount = viewMode === 'maand' ? 1
    : viewMode === 'kwartaal' ? 3
    : ytd ? currentMonth : 12;
  const monthOffset = viewMode === 'maand' ? parseInt(filterMonth) - 1
    : viewMode === 'kwartaal' ? (parseInt(filterQuarter) - 1) * 3
    : 0;
  const monthlyData = Array.from({ length: monthCount }, (_, i) => {
    const m = monthOffset + i + 1;
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
    let totalRevenue, totalMargin;
    if (p.placement_type === 'perm') {
      // PERM: one-time fee, only count in the year of start_date to avoid duplication
      const startYear = p.start_date ? new Date(p.start_date).getFullYear() : null;
      if (startYear !== parseInt(year)) return;
      const fee = p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100));
      totalRevenue = fee;
      totalMargin = fee; // full fee is margin for PERM
    } else {
      const pTs = yearTs.filter(t => t.placement_id === p.id);
      totalRevenue = pTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
      totalMargin = pTs.reduce((s, t) => s + (t.margin || 0), 0);
    }
    (p.sales_contributors || []).forEach(sc => {
      if (sc.name) {
        if (!salesData[sc.name]) salesData[sc.name] = { omzet: 0, marge: 0, deals: 0 };
        const pct = (sc.percentage || 0) / 100;
        salesData[sc.name].omzet += totalRevenue * pct;
        salesData[sc.name].marge += totalMargin * pct;
        salesData[sc.name].deals += 1;
      }
    });
  });
  const salesTable = Object.entries(salesData).sort(([,a],[,b]) => b.marge - a.marge);

  // Commission per quarter for sales
  const quarterCommission = {};
  placements.forEach(p => {
    (p.sales_contributors || []).forEach(sc => {
      if (!sc.name) return;
      const pct = (sc.percentage || 0) / 100;
      if (p.placement_type === 'perm') {
        // PERM: one-time fee in Q of start_date, only in correct year
        const startDate = p.start_date ? new Date(p.start_date) : null;
        if (!startDate || startDate.getFullYear() !== parseInt(year)) return;
        const q = getQuarter(startDate.getMonth() + 1);
        const key = `${sc.name}-${q}-${startDate.getFullYear()}`;
        const fee = p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100));
        if (!quarterCommission[key]) quarterCommission[key] = { name: sc.name, quarter: q, year: startDate.getFullYear(), marge: 0 };
        quarterCommission[key].marge += fee * pct;
      } else {
        const pTs = yearTs.filter(t => t.placement_id === p.id);
        pTs.forEach(t => {
          const q = getQuarter(t.month);
          const key = `${sc.name}-${q}-${t.year}`;
          if (!quarterCommission[key]) quarterCommission[key] = { name: sc.name, quarter: q, year: t.year, marge: 0 };
          quarterCommission[key].marge += (t.margin || 0) * pct;
        });
      }
    });
  });
  const VASTE_WERKNEMERS = ['adnane', 'maxim', 'paul', 'thomas', 'yunes', 'marloes', 'arthur'];
  const commissionTable = Object.values(quarterCommission).filter(row =>
    VASTE_WERKNEMERS.some(n => row.name.toLowerCase().includes(n))
  ).sort((a, b) => {
    const qOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    return qOrder[a.quarter] - qOrder[b.quarter] || a.name.localeCompare(b.name);
  });

  // Margeopbouw: cumulatieve marge per maand
  const margeopbouwData = useMemo(() => {
    let cumMarge = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mTs = timesheets.filter(t => t.year === parseInt(year) && t.month === m);
      const marge = mTs.reduce((s, t) => s + (t.margin || 0), 0);
      const omzet = mTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
      const kost = mTs.reduce((s, t) => s + (t.consultant_revenue || 0), 0);
      cumMarge += marge;
      return {
        name: getMonthName(m).slice(0, 3),
        marge,
        omzet,
        kost,
        cumulatieve_marge: cumMarge,
        marge_perc: omzet > 0 ? Math.round((marge / omzet) * 100) : 0,
      };
    });
  }, [timesheets, year]);

  // Invoiced status
  const invoicedConsultants = yearInv.filter(i => i.invoice_type === 'consultant_invoice' && i.status === 'paid');
  const invoicedClients = yearInv.filter(i => i.invoice_type === 'client_invoice');

  const years = [];
  for (let y = 2024; y <= 2027; y++) years.push(y);

  // Working days per month helper
  function getWorkingDays(y, m) {
    let count = 0;
    const date = new Date(y, m - 1, 1);
    while (date.getMonth() === m - 1) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  }

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [activeTab, setActiveTab] = useState('inzichten');

  // ── Inzichten berekeningen ──
  const totalOmzet = yearTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
  const totalMarge = yearTs.reduce((s, t) => s + (t.margin || 0), 0);
  const margePerc = totalOmzet > 0 ? (totalMarge / totalOmzet) * 100 : 0;
  const activePlacements = placements.filter(p => p.status === 'active');

  // Revenue concentratie: top 3 klanten
  const top3Revenue = clientTable.slice(0, 3).reduce((s, [, d]) => s + d.omzet, 0);
  const concentratiePerc = totalOmzet > 0 ? (top3Revenue / totalOmzet) * 100 : 0;

  // Best performing month
  const bestMonth = monthlyData.reduce((best, m) => m.marge > (best?.marge || 0) ? m : best, null);

  // MoM groei (vergelijk laatste 2 maanden met data)
  const monthsWithData = monthlyData.filter(m => m.omzet > 0);
  const momGrowth = monthsWithData.length >= 2
    ? ((monthsWithData[monthsWithData.length - 1].omzet - monthsWithData[monthsWithData.length - 2].omzet) / monthsWithData[monthsWithData.length - 2].omzet) * 100
    : null;

  // Placements die binnenkort verlopen (60 dagen)
  const now60 = new Date(); now60.setDate(now60.getDate() + 60);
  const expiringSoon = activePlacements.filter(p => {
    const eff = p.extensions?.length > 0 ? p.extensions[p.extensions.length - 1].new_end_date : p.end_date;
    if (!eff) return false;
    const end = new Date(eff);
    return end <= now60 && end >= new Date();
  });

  // Hoogste margin consultant
  const topConsultant = consultantTable[0] || null;
  // Beste klant qua marge %
  const bestMarginClient = clientTable.length > 0 ? clientTable.reduce((best, curr) => {
    const pct = curr[1].omzet > 0 ? curr[1].marge / curr[1].omzet : 0;
    const bpct = best[1].omzet > 0 ? best[1].marge / best[1].omzet : 0;
    return pct > bpct ? curr : best;
  }) : null;

  // Gemiddelde marge per dag (alle approved timesheets)
  const totalDays = yearTs.reduce((s, t) => s + (t.days_worked || 0), 0);
  const avgMargePerDay = totalDays > 0 ? totalMarge / totalDays : 0;

  // Vergelijking: verwacht vs werkelijk per maand
  const vergelijkingData = useMemo(() => {
    const yr = parseInt(year);
    const activePlacements = placements.filter(p => !p.placement_type || p.placement_type === 'freelancer');
    return Array.from({ length: monthCount }, (_, i) => {
      const m = i + 1;
      const workDays = getWorkingDays(yr, m);
      const verwacht = activePlacements.reduce((sum, p) => {
        const fraction = (p.days_per_week || 5) / 5;
        return sum + (workDays * fraction * (p.client_rate || 0));
      }, 0);
      const werkelijk = yearTs.filter(t => t.month === m).reduce((s, t) => s + (t.client_revenue || 0), 0);
      const afwijking = werkelijk - verwacht;
      const pct = verwacht > 0 ? (afwijking / verwacht) * 100 : 0;
      return { name: getMonthName(m).slice(0, 3), m, verwacht, werkelijk, afwijking, pct, workDays };
    });
  }, [placements, yearTs, year, monthCount]);

  const handleExport = useCallback(() => {
    exportToExcel({
      activeTab,
      year,
      data: {
        monthlyData,
        clientTable,
        consultantTable,
        salesTable,
        commissionTable,
        margeopbouwData,
        vergelijkingData,
        // targetRows are computed inside TargetVsActualTab; pass a simplified version
        targetRows: ['Q1','Q2','Q3','Q4'].map(q => ({ q,
          brutomarge: { target: 0, actual: 0 },
          perm: { target: 0, actual: 0 },
          consultants: { target: 0, actual: 0 },
          new_deals: { target: 0, actual: 0 },
        })),
      },
    });
  }, [activeTab, year, monthlyData, clientTable, consultantTable, salesTable, commissionTable, margeopbouwData, vergelijkingData]);

  return (
    <div>
      <PageHeader title="Rapportering" subtitle="Overzichten en analyses">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {[['jaar','Jaar'],['kwartaal','Kwartaal'],['maand','Maand']].map(([mode,label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                }`}>{label}</button>
            ))}
          </div>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {viewMode === 'kwartaal' && (
            <Select value={filterQuarter} onValueChange={setFilterQuarter}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1','2','3','4'].map(q => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {viewMode === 'maand' && (
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({length:12},(_,i) => <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {viewMode === 'jaar' && (
            <button onClick={() => setYtd(v => !v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                ytd ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
              }`}>YTD</button>
          )}
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
            <Download className="w-3.5 h-3.5" />Exporteren
          </button>
        </div>
      </PageHeader>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Totale Omzet', value: formatCurrency(totalOmzet), sub: `${yearTs.length} timesheets`, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Totale Marge', value: formatCurrency(totalMarge), sub: `${margePerc.toFixed(1)}% marge`, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Actieve Placements', value: activePlacements.length, sub: `${placements.length} totaal`, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
          { label: 'Gem. Marge/Dag', value: formatCurrency(avgMargePerDay), sub: `${totalDays} dagen`, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
          { label: 'Verlengt < 60d', value: expiringSoon.length, sub: expiringSoon.length > 0 ? 'actie vereist' : 'alles OK', color: expiringSoon.length > 0 ? 'text-red-600' : 'text-emerald-600', bg: expiringSoon.length > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <div className="text-xs text-muted-foreground font-medium mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="inzichten" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="bg-muted flex-wrap">
          <TabsTrigger value="inzichten">✨ Inzichten</TabsTrigger>
          <TabsTrigger value="monthly">Maandoverzicht</TabsTrigger>
          <TabsTrigger value="clients">Per Klant</TabsTrigger>
          <TabsTrigger value="consultants">Per Consultant</TabsTrigger>
          <TabsTrigger value="sales">Per Sales</TabsTrigger>
          <TabsTrigger value="commission">Commissie</TabsTrigger>
          <TabsTrigger value="margeopbouw">Margeopbouw</TabsTrigger>
          <TabsTrigger value="invoiced">Facturatiestatus</TabsTrigger>
          <TabsTrigger value="personeelslid">Per Personeelslid</TabsTrigger>
          <TabsTrigger value="vergelijking">Verwacht vs Werkelijk</TabsTrigger>
          <TabsTrigger value="targets">🎯 Targets</TabsTrigger>
          <TabsTrigger value="targets_vs_actual">📊 Target vs Werkelijk</TabsTrigger>
        </TabsList>

        <TabsContent value="inzichten">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

            {/* MoM Groei */}
            <Card className={momGrowth !== null && momGrowth >= 0 ? 'border-emerald-200' : 'border-red-200'}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {momGrowth !== null && momGrowth >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                  <CardTitle className="text-sm">Maand-op-maand groei</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {momGrowth !== null ? (
                  <>
                    <div className={`text-3xl font-bold ${momGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {momGrowth >= 0 ? '+' : ''}{momGrowth.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Omzetverschil tussen de laatste 2 maanden met data ({monthsWithData[monthsWithData.length-2]?.name} → {monthsWithData[monthsWithData.length-1]?.name})
                    </p>
                  </>
                ) : <p className="text-sm text-muted-foreground">Onvoldoende data voor vergelijking</p>}
              </CardContent>
            </Card>

            {/* Revenue concentratie */}
            <Card className={concentratiePerc > 60 ? 'border-amber-300' : 'border-emerald-200'}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-violet-600" />
                  <CardTitle className="text-sm">Klantconcentratie</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${concentratiePerc > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {concentratiePerc.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Top 3 klanten vertegenwoordigen {concentratiePerc.toFixed(0)}% van de totale omzet.</p>
                {concentratiePerc > 60 && <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">⚠ Hoge concentratie — risico bij verlies van een klant.</div>}
                <div className="mt-3 space-y-1">
                  {clientTable.slice(0, 3).map(([name, d]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[150px]">{name}</span>
                      <span className="font-semibold">{totalOmzet > 0 ? ((d.omzet/totalOmzet)*100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Best performing month */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <CardTitle className="text-sm">Beste maand</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {bestMonth ? (
                  <>
                    <div className="text-3xl font-bold text-primary">{bestMonth.name}</div>
                    <div className="text-sm font-semibold mt-1">{formatCurrency(bestMonth.marge)} marge</div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(bestMonth.omzet)} omzet · marge %: {bestMonth.omzet > 0 ? ((bestMonth.marge/bestMonth.omzet)*100).toFixed(1) : 0}%</p>
                  </>
                ) : <p className="text-sm text-muted-foreground">Geen data</p>}
              </CardContent>
            </Card>

            {/* Top consultant */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-sm">Hoogste marge consultant</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {topConsultant ? (
                  <>
                    <div className="text-xl font-bold text-foreground truncate">{topConsultant[0]}</div>
                    <div className="text-lg font-semibold text-emerald-600 mt-1">{formatCurrency(topConsultant[1].marge)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(topConsultant[1].omzet)} omzet · {topConsultant[1].omzet > 0 ? ((topConsultant[1].marge/topConsultant[1].omzet)*100).toFixed(1) : 0}% marge</p>
                  </>
                ) : <p className="text-sm text-muted-foreground">Geen data</p>}
              </CardContent>
            </Card>

            {/* Beste marge % klant */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-600" />
                  <CardTitle className="text-sm">Beste marge% klant</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {bestMarginClient ? (
                  <>
                    <div className="text-xl font-bold text-foreground truncate">{bestMarginClient[0]}</div>
                    <div className="text-lg font-semibold text-violet-600 mt-1">
                      {bestMarginClient[1].omzet > 0 ? ((bestMarginClient[1].marge/bestMarginClient[1].omzet)*100).toFixed(1) : 0}% marge
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(bestMarginClient[1].marge)} op {formatCurrency(bestMarginClient[1].omzet)}</p>
                  </>
                ) : <p className="text-sm text-muted-foreground">Geen data</p>}
              </CardContent>
            </Card>

            {/* Placements die verlopen */}
            <Card className={expiringSoon.length > 0 ? 'border-red-300' : 'border-emerald-200'}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${expiringSoon.length > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                  <CardTitle className="text-sm">Contracten die verlopen</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {expiringSoon.length === 0 ? (
                  <><div className="text-3xl font-bold text-emerald-600">✓</div><p className="text-xs text-muted-foreground mt-1">Geen actieve placements verlopen binnen 60 dagen.</p></>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-red-600">{expiringSoon.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Placements verlopen binnen 60 dagen:</p>
                    <div className="mt-2 space-y-1">
                      {expiringSoon.map(p => {
                        const eff = p.extensions?.length > 0 ? p.extensions[p.extensions.length - 1].new_end_date : p.end_date;
                        const daysLeft = Math.ceil((new Date(eff) - new Date()) / (1000*60*60*24));
                        return (
                          <div key={p.id} className="flex justify-between text-xs">
                            <span className="font-medium">{p.consultant_first_name} {p.consultant_last_name}</span>
                            <span className={`font-bold ${daysLeft <= 14 ? 'text-red-600' : 'text-amber-600'}`}>{daysLeft}d</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Marge doelstelling */}
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-sm">Maandtrend: Omzet vs Marge</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" />
                    <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyTab monthlyData={monthlyData} year={year} />
        </TabsContent>

        <TabsContent value="clients">
          <ClientsTab clientTable={clientTable} />
        </TabsContent>

        <TabsContent value="consultants">
          <ConsultantsTab consultantTable={consultantTable} />
        </TabsContent>

        <TabsContent value="sales">
          <SalesTab salesTable={salesTable} />
        </TabsContent>

        <TabsContent value="commission">
          <CommissionTab commissionTable={commissionTable} years={years} currentYear={parseInt(year)} />
        </TabsContent>

        <TabsContent value="margeopbouw">
          <MargeopbouwTab data={margeopbouwData} year={year} />
        </TabsContent>

        <TabsContent value="invoiced">
          <FacturatieTab invoicedClients={invoicedClients} invoicedConsultants={invoicedConsultants} />
        </TabsContent>

        <TabsContent value="personeelslid">
          <PersoneelslidTab timesheets={timesheets} year={year} years={years} />
        </TabsContent>

        <TabsContent value="targets">
          <TargetTab timesheets={timesheets} placements={placements} year={year} />
        </TabsContent>

        <TabsContent value="targets_vs_actual">
          <TargetVsActualTab timesheets={timesheets} placements={placements} year={year} />
        </TabsContent>

        <TabsContent value="vergelijking">
          <VergelijkingTab
            vergelijkingData={vergelijkingData}
            placements={placements}
            timesheets={timesheets}
            year={year}
            ytd={ytd}
            expandedMonth={expandedMonth}
            setExpandedMonth={setExpandedMonth}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}