import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import StatusBadge from '@/components/shared/StatusBadge';
import VergelijkingDrillDown from '@/components/reports/VergelijkingDrillDown';

const PIE_COLORS = [
  'hsl(221, 83%, 53%)', 'hsl(142, 72%, 29%)', 'hsl(43, 74%, 55%)',
  'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)', 'hsl(200, 80%, 50%)',
  'hsl(30, 90%, 55%)', 'hsl(160, 60%, 40%)', 'hsl(330, 70%, 55%)', 'hsl(80, 60%, 40%)',
];

function ChartToggle({ view, setView, types = ['table', 'bar', 'line'] }) {
  const labels = { table: '📋', bar: '📊', line: '📈', pie: '🥧', area: '🏔️' };
  const fullLabels = { table: 'Tabel', bar: 'Staaf', line: 'Lijn', pie: 'Cirkel', area: 'Gebied' };
  return (
    <div className="flex rounded-md border border-border overflow-hidden flex-shrink-0">
      {types.map(t => (
        <button key={t} onClick={() => setView(t)}
          title={fullLabels[t]}
          className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${view === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
          {labels[t]} {fullLabels[t]}
        </button>
      ))}
    </div>
  );
}

function MetricSelect({ value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-36 text-xs border-dashed">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function PieChartView({ data, dataKey, nameKey = 'name', height = 300 }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const total = data.reduce((s, d) => s + (d[dataKey] || 0), 0);
  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%"
            outerRadius={110} innerRadius={50} paddingAngle={2}
            onMouseEnter={(_, idx) => setActiveIdx(idx)} onMouseLeave={() => setActiveIdx(null)}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]}
                opacity={activeIdx === null || activeIdx === idx ? 1 : 0.5} stroke="white" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip formatter={(v, name) => [formatCurrency(v), name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {activeIdx !== null && data[activeIdx] && (
        <div className="text-sm bg-muted/50 rounded-lg p-3 min-w-[160px] border border-border">
          <div className="font-semibold">{data[activeIdx][nameKey]}</div>
          <div className="text-primary font-bold mt-1">{formatCurrency(data[activeIdx][dataKey])}</div>
          <div className="text-muted-foreground text-xs mt-0.5">{total > 0 ? ((data[activeIdx][dataKey] / total) * 100).toFixed(1) : 0}% van totaal</div>
        </div>
      )}
    </div>
  );
}

// ─── MONTHLY TAB ───────────────────────────────────────────────────────────────
export function MonthlyTab({ monthlyData, year }) {
  const [view, setView] = useState('bar');
  const [metric, setMetric] = useState('omzet_marge'); // omzet_marge | omzet_kost_marge | marge_perc | omzet_only

  const metricOptions = [
    { value: 'omzet_marge', label: 'Omzet & Marge' },
    { value: 'omzet_kost_marge', label: 'Omzet, Kost & Marge' },
    { value: 'omzet_only', label: 'Alleen Omzet' },
    { value: 'marge_perc', label: 'Marge %' },
  ];

  const pieData = monthlyData.filter(r => r.omzet > 0).map(r => ({ name: r.name, omzet: r.omzet }));
  const margePercData = monthlyData.map(r => ({ ...r, margePerc: r.omzet > 0 ? parseFloat(((r.marge / r.omzet) * 100).toFixed(1)) : 0 }));

  const renderBarsOrLines = (type) => {
    if (metric === 'marge_perc') {
      return type === 'bar'
        ? <Bar dataKey="margePerc" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge %" />
        : <Line type="monotone" dataKey="margePerc" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Marge %" dot={{ r: 4 }} />;
    }
    if (metric === 'omzet_only') {
      return type === 'bar'
        ? <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" />
        : <Line type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Omzet" dot={{ r: 4 }} />;
    }
    if (metric === 'omzet_kost_marge') {
      return type === 'bar' ? <>
        <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" />
        <Bar dataKey="kost" fill="hsl(0, 84%, 60%)" radius={[4,4,0,0]} name="Kost" />
        <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" />
      </> : <>
        <Line type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Omzet" dot={{ r: 3 }} />
        <Line type="monotone" dataKey="kost" stroke="hsl(0, 84%, 60%)" strokeWidth={2} name="Kost" dot={{ r: 3 }} />
        <Line type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Marge" dot={{ r: 4 }} />
      </>;
    }
    // default: omzet_marge
    return type === 'bar' ? <>
      <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" />
      <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" />
    </> : <>
      <Line type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Omzet" dot={{ r: 4 }} />
      <Line type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Marge" dot={{ r: 4 }} />
    </>;
  };

  const chartData = metric === 'marge_perc' ? margePercData : monthlyData;
  const yFormatter = metric === 'marge_perc' ? v => `${v}%` : v => `€${(v/1000).toFixed(0)}k`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Maandelijks Overzicht {year}</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {view !== 'table' && view !== 'pie' && <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'line', 'area', 'pie']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'bar' && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={yFormatter} />
              <Tooltip formatter={metric === 'marge_perc' ? v => `${v}%` : v => formatCurrency(v)} />
              <Legend />
              {renderBarsOrLines('bar')}
            </BarChart>
          </ResponsiveContainer>
        )}
        {view === 'line' && (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={yFormatter} />
              <Tooltip formatter={metric === 'marge_perc' ? v => `${v}%` : v => formatCurrency(v)} />
              <Legend />
              {renderBarsOrLines('line')}
            </LineChart>
          </ResponsiveContainer>
        )}
        {view === 'area' && (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gradOmzet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradMarge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" fill="url(#gradOmzet)" strokeWidth={2} name="Omzet" />
              <Area type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" fill="url(#gradMarge)" strokeWidth={2} name="Marge" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {view === 'pie' && <PieChartView data={pieData} dataKey="omzet" height={320} />}
        {view === 'table' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Maand</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
            </tr></thead>
            <tbody>
              {monthlyData.map(row => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(row.omzet)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.kost)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(row.marge)}</td>
                  <td className="py-3 px-4 text-right">{row.omzet > 0 ? ((row.marge/row.omzet)*100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CLIENTS TAB ───────────────────────────────────────────────────────────────
export function ClientsTab({ clientTable }) {
  const [view, setView] = useState('bar');
  const [metric, setMetric] = useState('omzet_marge'); // omzet_marge | omzet | marge | marge_perc
  const [topN, setTopN] = useState('top10');

  const metricOptions = [
    { value: 'omzet_marge', label: 'Omzet & Marge' },
    { value: 'omzet', label: 'Alleen Omzet' },
    { value: 'marge', label: 'Alleen Marge' },
    { value: 'marge_perc', label: 'Marge %' },
  ];
  const topNOptions = [
    { value: 'top5', label: 'Top 5' },
    { value: 'top10', label: 'Top 10' },
    { value: 'top20', label: 'Top 20' },
    { value: 'all', label: 'Alle' },
    { value: 'bottom2', label: 'Slechtste 2' },
    { value: 'bottom5', label: 'Slechtste 5' },
    { value: 'bottom10', label: 'Slechtste 10' },
  ];

  const getSliced = () => {
    if (topN === 'all') return clientTable;
    if (topN.startsWith('bottom')) {
      const n = parseInt(topN.replace('bottom', ''));
      return [...clientTable].reverse().slice(0, n);
    }
    return clientTable.slice(0, parseInt(topN.replace('top', '')));
  };
  const sliced = getSliced();
  const chartData = sliced.map(([name, d]) => ({
    name: name.length > 14 ? name.slice(0,13)+'…' : name,
    omzet: d.omzet, marge: d.marge,
    margePerc: d.omzet > 0 ? parseFloat(((d.marge/d.omzet)*100).toFixed(1)) : 0,
  }));
  const pieData = sliced.map(([name, d]) => ({
    name: name.length > 14 ? name.slice(0,13)+'…' : name,
    value: metric === 'marge' ? d.marge : metric === 'marge_perc' ? (d.omzet > 0 ? d.marge/d.omzet*100 : 0) : d.omzet,
  }));

  const barKeys = () => {
    if (metric === 'omzet_marge') return <><Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[0,4,4,0]} /><Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} /></>;
    if (metric === 'omzet') return <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[0,4,4,0]} />;
    if (metric === 'marge') return <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} />;
    return <Bar dataKey="margePerc" fill="hsl(262, 83%, 58%)" name="Marge %" radius={[0,4,4,0]} />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Omzet & Marge per Klant</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {view !== 'table' && <>
            <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />
            <MetricSelect value={topN} onChange={setTopN} options={topNOptions} />
          </>}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'pie']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'bar' && (
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 38)}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={metric === 'marge_perc' ? v => `${v}%` : v => `€${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={metric === 'marge_perc' ? v => `${v}%` : v => formatCurrency(v)} />
              <Legend />
              {barKeys()}
            </BarChart>
          </ResponsiveContainer>
        )}
        {view === 'pie' && <PieChartView data={pieData} dataKey="value" height={320} />}
        {view === 'table' && (
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
                  <td className="py-3 px-4 text-right">{data.omzet > 0 ? ((data.marge/data.omzet)*100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CONSULTANTS TAB ───────────────────────────────────────────────────────────
export function ConsultantsTab({ consultantTable }) {
  const [view, setView] = useState('bar');
  const [metric, setMetric] = useState('alle'); // alle | omzet | marge | kost | marge_perc
  const [sortBy, setSortBy] = useState('marge'); // marge | omzet | kost | margeperc
  const [search, setSearch] = useState('');

  const metricOptions = [
    { value: 'alle', label: 'Omzet, Kost & Marge' },
    { value: 'omzet_marge', label: 'Omzet & Marge' },
    { value: 'marge', label: 'Alleen Marge' },
    { value: 'marge_perc', label: 'Marge %' },
  ];
  const sortOptions = [
    { value: 'marge', label: 'Sorteer: Marge' },
    { value: 'omzet', label: 'Sorteer: Omzet' },
    { value: 'kost', label: 'Sorteer: Kost' },
  ];

  const sorted = [...consultantTable]
    .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
    .sort(([, a], [, b]) => (b[sortBy] || 0) - (a[sortBy] || 0));
  const chartData = sorted.slice(0, 10).map(([name, d]) => ({
    name: name.split(' ').slice(0,2).join(' '),
    omzet: d.omzet, marge: d.marge, kost: d.kost,
    margePerc: d.omzet > 0 ? parseFloat(((d.marge/d.omzet)*100).toFixed(1)) : 0,
  }));
  const pieData = sorted.slice(0, 10).map(([name, d]) => ({
    name: name.split(' ').slice(0,2).join(' '),
    value: metric === 'marge_perc' ? (d.omzet > 0 ? d.marge/d.omzet*100 : 0) : (d[metric] || d.marge),
  }));

  const barKeys = () => {
    if (metric === 'alle') return <><Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[0,4,4,0]} /><Bar dataKey="kost" fill="hsl(0, 84%, 60%)" name="Kost" radius={[0,4,4,0]} /><Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} /></>;
    if (metric === 'omzet_marge') return <><Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[0,4,4,0]} /><Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} /></>;
    if (metric === 'marge') return <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} />;
    return <Bar dataKey="margePerc" fill="hsl(262, 83%, 58%)" name="Marge %" radius={[0,4,4,0]} />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Marge per Consultant</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Zoek consultant..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 px-2 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring w-40"
          />
          {view !== 'table' && <>
            <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />
            <MetricSelect value={sortBy} onChange={setSortBy} options={sortOptions} />
          </>}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'pie']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'bar' && (
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 38)}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={metric === 'marge_perc' ? v => `${v}%` : v => `€${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={metric === 'marge_perc' ? v => `${v}%` : v => formatCurrency(v)} />
              <Legend />
              {barKeys()}
            </BarChart>
          </ResponsiveContainer>
        )}
        {view === 'pie' && <PieChartView data={pieData} dataKey="value" height={320} />}
        {view === 'table' && (
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
                  <td className="py-3 px-4 text-right">{data.omzet > 0 ? ((data.marge/data.omzet)*100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── SALES TAB ─────────────────────────────────────────────────────────────────
export function SalesTab({ salesTable }) {
  const [view, setView] = useState('bar');
  const [metric, setMetric] = useState('omzet_marge'); // omzet_marge | omzet | marge

  const metricOptions = [
    { value: 'omzet_marge', label: 'Omzet & Marge' },
    { value: 'omzet', label: 'Alleen Omzet' },
    { value: 'marge', label: 'Alleen Marge' },
  ];

  const chartData = salesTable.map(([name, d]) => ({ name, omzet: d.omzet, marge: d.marge }));
  const pieData = salesTable.map(([name, d]) => ({ name, value: metric === 'omzet' ? d.omzet : d.marge }));

  const barKeys = () => {
    if (metric === 'omzet_marge') return <><Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[4,4,0,0]} /><Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[4,4,0,0]} /></>;
    if (metric === 'omzet') return <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[4,4,0,0]} />;
    return <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[4,4,0,0]} />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Overzicht per Commerciële Consultant</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {view !== 'table' && salesTable.length > 0 && <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'pie']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'bar' && (
          salesTable.length === 0
            ? <p className="py-8 text-center text-muted-foreground text-sm">Geen sales contributors gekoppeld aan placements</p>
            : <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  {barKeys()}
                </BarChart>
              </ResponsiveContainer>
        )}
        {view === 'pie' && (
          salesTable.length === 0
            ? <p className="py-8 text-center text-muted-foreground text-sm">Geen data</p>
            : <PieChartView data={pieData} dataKey="value" height={280} />
        )}
        {view === 'table' && (
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── COMMISSION TAB ────────────────────────────────────────────────────────────
export function CommissionTab({ commissionTable, years, currentYear }) {
  const [view, setView] = useState('bar');
  const [filterQuarter, setFilterQuarter] = useState('all');
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [metric, setMetric] = useState('marge_commissie'); // marge_commissie | commissie | marge

  const metricOptions = [
    { value: 'marge_commissie', label: 'Marge & Commissie' },
    { value: 'commissie', label: 'Alleen Commissie' },
    { value: 'marge', label: 'Alleen Marge' },
  ];

  const filtered = commissionTable.filter(row => {
    const quarterMatch = filterQuarter === 'all' || row.quarter === filterQuarter;
    const yearMatch = filterYear === 'all' || String(row.year) === filterYear;
    return quarterMatch && yearMatch;
  });

  const chartData = filtered.map(row => ({ name: `${row.name} ${row.quarter}`, marge: row.marge, commissie: row.marge * 0.1 }));
  const pieData = filtered.map(row => ({
    name: `${row.name} ${row.quarter}`,
    value: metric === 'marge' ? row.marge : row.marge * 0.1,
  }));

  const barKeys = (type) => {
    if (metric === 'marge_commissie') return type === 'bar' ? <>
      <Bar dataKey="marge" fill="hsl(221, 83%, 53%)" name="Toegew. Marge" radius={[4,4,0,0]} />
      <Bar dataKey="commissie" fill="hsl(142, 72%, 29%)" name="Commissie (10%)" radius={[4,4,0,0]} />
    </> : <>
      <Line type="monotone" dataKey="marge" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Toegew. Marge" dot={{ r: 4 }} />
      <Line type="monotone" dataKey="commissie" stroke="hsl(142, 72%, 29%)" strokeWidth={2} name="Commissie (10%)" dot={{ r: 4 }} />
    </>;
    if (metric === 'commissie') return type === 'bar'
      ? <Bar dataKey="commissie" fill="hsl(142, 72%, 29%)" name="Commissie (10%)" radius={[4,4,0,0]} />
      : <Line type="monotone" dataKey="commissie" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Commissie (10%)" dot={{ r: 4 }} />;
    return type === 'bar'
      ? <Bar dataKey="marge" fill="hsl(221, 83%, 53%)" name="Toegew. Marge" radius={[4,4,0,0]} />
      : <Line type="monotone" dataKey="marge" stroke="hsl(221, 83%, 53%)" strokeWidth={2.5} name="Toegew. Marge" dot={{ r: 4 }} />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Commissie per Kwartaal</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle jaren</SelectItem>
              {(years || []).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-border overflow-hidden">
            {[['all','Alle'], ['Q1','Q1'], ['Q2','Q2'], ['Q3','Q3'], ['Q4','Q4']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterQuarter(val)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${filterQuarter === val ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                {label}
              </button>
            ))}
          </div>
          {view !== 'table' && filtered.length > 0 && <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'line', 'pie']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {(view === 'bar' || view === 'line') && (
          filtered.length === 0
            ? <p className="py-8 text-center text-muted-foreground text-sm">Geen commissiedata beschikbaar</p>
            : <ResponsiveContainer width="100%" height={280}>
                {view === 'bar'
                  ? <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} /><Tooltip formatter={v => formatCurrency(v)} /><Legend />{barKeys('bar')}</BarChart>
                  : <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} /><Tooltip formatter={v => formatCurrency(v)} /><Legend />{barKeys('line')}</LineChart>
                }
              </ResponsiveContainer>
        )}
        {view === 'pie' && (
          filtered.length === 0
            ? <p className="py-8 text-center text-muted-foreground text-sm">Geen data</p>
            : <PieChartView data={pieData} dataKey="value" height={280} />
        )}
        {view === 'table' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sales</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Kwartaal</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Toeg. Marge</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Commissie (schatting)</th>
            </tr></thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4">{row.quarter}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(row.marge)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">{formatCurrency(row.marge * 0.1)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Geen commissiedata beschikbaar</td></tr>
              )}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── FACTURATIE TAB ────────────────────────────────────────────────────────────
export function FacturatieTab({ invoicedClients, invoicedConsultants }) {
  const [view, setView] = useState('table');
  const [focus, setFocus] = useState('beiden'); // beiden | klanten | consultants

  const focusOptions = [
    { value: 'beiden', label: 'Klanten & Consultants' },
    { value: 'klanten', label: 'Alleen Klanten' },
    { value: 'consultants', label: 'Alleen Consultants' },
  ];

  const clientChartData = Object.values(
    invoicedClients.reduce((acc, i) => {
      const key = i.client_company || '—';
      if (!acc[key]) acc[key] = { name: key.length > 14 ? key.slice(0,13)+'…' : key, betaald: 0, openstaand: 0 };
      if (i.status === 'paid') acc[key].betaald += i.total_amount || i.amount || 0;
      else acc[key].openstaand += i.total_amount || i.amount || 0;
      return acc;
    }, {})
  ).sort((a, b) => (b.betaald + b.openstaand) - (a.betaald + a.openstaand)).slice(0, 10);

  const consultantChartData = Object.values(
    invoicedConsultants.reduce((acc, i) => {
      const key = i.consultant_name || '—';
      if (!acc[key]) acc[key] = { name: key.split(' ').slice(0,2).join(' '), betaald: 0 };
      acc[key].betaald += i.total_amount || i.amount || 0;
      return acc;
    }, {})
  ).sort((a, b) => b.betaald - a.betaald).slice(0, 10);

  const showClients = focus !== 'consultants';
  const showConsultants = focus !== 'klanten';

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <MetricSelect value={focus} onChange={setFocus} options={focusOptions} />
        <ChartToggle view={view} setView={setView} />
      </div>
      {view === 'table' ? (
        <div className={`grid gap-6 ${focus === 'beiden' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {showClients && (
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
                        <td className="py-3 px-4">{i.client_company || '—'}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(i.total_amount || i.amount)}</td>
                        <td className="py-3 px-4"><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}
                    {invoicedClients.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Geen klantfacturen</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          {showConsultants && (
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
                        <td className="py-3 px-4">{i.consultant_name || '—'}</td>
                        <td className="py-3 px-4 text-right font-medium">{formatCurrency(i.total_amount || i.amount)}</td>
                        <td className="py-3 px-4"><StatusBadge status={i.status} /></td>
                      </tr>
                    ))}
                    {invoicedConsultants.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">Geen consultantfacturen</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className={`grid gap-6 ${focus === 'beiden' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {showClients && (
            <Card>
              <CardHeader><CardTitle className="text-base">Klantfacturen — Betaald vs Openstaand</CardTitle></CardHeader>
              <CardContent>
                {clientChartData.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">Geen data</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={clientChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip formatter={v => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="betaald" fill="hsl(142, 72%, 29%)" name="Betaald" radius={[0,4,4,0]} />
                      <Bar dataKey="openstaand" fill="hsl(43, 74%, 55%)" name="Openstaand" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
          {showConsultants && (
            <Card>
              <CardHeader><CardTitle className="text-base">Consultantfacturen — Bedrag per Consultant</CardTitle></CardHeader>
              <CardContent>
                {consultantChartData.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">Geen data</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={consultantChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip formatter={v => formatCurrency(v)} />
                      <Bar dataKey="betaald" fill="hsl(221, 83%, 53%)" name="Betaald" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VERGELIJKING TAB ──────────────────────────────────────────────────────────
export function VergelijkingTab({ vergelijkingData, placements, timesheets, year, ytd, expandedMonth, setExpandedMonth }) {
  const [view, setView] = useState('bar');
  const [metric, setMetric] = useState('verwacht_werkelijk'); // verwacht_werkelijk | afwijking | pct

  const metricOptions = [
    { value: 'verwacht_werkelijk', label: 'Verwacht vs Werkelijk' },
    { value: 'afwijking', label: 'Afwijking (€)' },
    { value: 'pct', label: 'Afwijking (%)' },
  ];

  const chartData = vergelijkingData.map(r => ({
    name: r.name,
    verwacht: r.verwacht,
    werkelijk: r.werkelijk,
    afwijking: r.afwijking,
    pct: r.pct,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2 flex-wrap">
        <div>
          <CardTitle className="text-base">Verwachte vs Werkelijke Omzet {ytd ? `YTD ${year}` : year}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Verwacht = actieve freelancers × werkdagen × tarief. Klik op een maand voor breakdown.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {view !== 'table' && <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'line']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {(view === 'bar' || view === 'line') && (
          <ResponsiveContainer width="100%" height={320}>
            {view === 'bar'
              ? <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={metric === 'pct' ? v => `${v.toFixed(0)}%` : v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={metric === 'pct' ? v => `${v.toFixed(1)}%` : v => formatCurrency(v)} />
                  <Legend />
                  {metric === 'verwacht_werkelijk' && <>
                    <Bar dataKey="verwacht" fill="hsl(221, 83%, 53%)" name="Verwacht" radius={[4,4,0,0]} opacity={0.6} />
                    <Bar dataKey="werkelijk" fill="hsl(142, 72%, 29%)" name="Werkelijk" radius={[4,4,0,0]} />
                  </>}
                  {metric === 'afwijking' && <Bar dataKey="afwijking" name="Afwijking" radius={[4,4,0,0]}
                    fill="hsl(43, 74%, 55%)"
                    label={false}
                  />}
                  {metric === 'pct' && <Bar dataKey="pct" name="Afwijking %" radius={[4,4,0,0]} fill="hsl(262, 83%, 58%)" />}
                </BarChart>
              : <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={metric === 'pct' ? v => `${v.toFixed(0)}%` : v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={metric === 'pct' ? v => `${v.toFixed(1)}%` : v => formatCurrency(v)} />
                  <Legend />
                  {metric === 'verwacht_werkelijk' && <>
                    <Line type="monotone" dataKey="verwacht" stroke="hsl(221, 83%, 53%)" strokeWidth={2} strokeDasharray="5 3" name="Verwacht" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="werkelijk" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Werkelijk" dot={{ r: 4 }} />
                  </>}
                  {metric === 'afwijking' && <Line type="monotone" dataKey="afwijking" stroke="hsl(43, 74%, 55%)" strokeWidth={2} name="Afwijking" dot={{ r: 4 }} />}
                  {metric === 'pct' && <Line type="monotone" dataKey="pct" stroke="hsl(262, 83%, 58%)" strokeWidth={2} name="Afwijking %" dot={{ r: 4 }} />}
                </LineChart>
            }
          </ResponsiveContainer>
        )}
        {view === 'table' && (<>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Maand</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Verwacht</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Werkelijk</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Afwijking</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">%</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {vergelijkingData.map(row => {
                const hasData = row.werkelijk > 0;
                const isOk = Math.abs(row.pct) <= 5;
                const isWarn = Math.abs(row.pct) > 5 && Math.abs(row.pct) <= 15;
                const isDanger = Math.abs(row.pct) > 15;
                const isExpanded = expandedMonth === row.m;
                return (
                  <React.Fragment key={row.m}>
                    <tr className={`border-b border-border/50 cursor-pointer select-none ${!hasData ? 'hover:bg-muted/20' : isDanger ? 'bg-red-50/40 hover:bg-red-50/60' : isWarn ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'bg-emerald-50/20 hover:bg-emerald-50/40'} ${isExpanded ? 'border-b-0' : ''}`}
                      onClick={() => setExpandedMonth(isExpanded ? null : row.m)}>
                      <td className="py-3 px-4 font-medium text-foreground flex items-center gap-2">
                        <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>{row.name}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.verwacht)}</td>
                      <td className="py-3 px-4 text-right font-semibold">{hasData ? formatCurrency(row.werkelijk) : <span className="text-muted-foreground text-xs">Geen TS</span>}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${!hasData ? 'text-muted-foreground' : row.afwijking >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {hasData ? (row.afwijking >= 0 ? '+' : '') + formatCurrency(row.afwijking) : '—'}
                      </td>
                      <td className={`py-3 px-4 text-right font-semibold ${!hasData ? 'text-muted-foreground' : isOk ? 'text-emerald-600' : isWarn ? 'text-amber-600' : 'text-red-600'}`}>
                        {hasData ? (row.pct >= 0 ? '+' : '') + row.pct.toFixed(1) + '%' : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {!hasData ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">Geen data</span>
                          : isOk ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">✓ OK</span>
                          : isWarn ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">⚠ Kleine afwijking</span>
                          : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">✗ Grote afwijking</span>}
                      </td>
                    </tr>
                    {isExpanded && <VergelijkingDrillDown placements={placements} timesheets={timesheets} month={row.m} year={year} workingDays={row.workDays} />}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="py-3 px-4">Totaal</td>
                <td className="py-3 px-4 text-right">{formatCurrency(vergelijkingData.reduce((s, r) => s + r.verwacht, 0))}</td>
                <td className="py-3 px-4 text-right">{formatCurrency(vergelijkingData.reduce((s, r) => s + r.werkelijk, 0))}</td>
                <td className={`py-3 px-4 text-right ${vergelijkingData.reduce((s, r) => s + r.afwijking, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {(() => { const t = vergelijkingData.reduce((s, r) => s + r.afwijking, 0); return (t >= 0 ? '+' : '') + formatCurrency(t); })()}
                </td>
                <td className="py-3 px-4 text-right">
                  {(() => { const tv = vergelijkingData.reduce((s, r) => s + r.verwacht, 0); const tw = vergelijkingData.reduce((s, r) => s + r.werkelijk, 0); const p = tv > 0 ? ((tw-tv)/tv*100) : 0; return <span className={p >= 0 ? 'text-emerald-600' : 'text-red-600'}>{(p>=0?'+':'')+p.toFixed(1)}%</span>; })()}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </>)}
      </CardContent>
    </Card>
  );
}

// ─── MARGEOPBOUW TAB ───────────────────────────────────────────────────────────
export function MargeopbouwTab({ data, year }) {
  const [view, setView] = useState('bar');
  const [metric, setMetric] = useState('alle'); // alle | marge | cumulatief | marge_perc

  const metricOptions = [
    { value: 'alle', label: 'Omzet, Kost & Marge' },
    { value: 'marge', label: 'Alleen Marge' },
    { value: 'cumulatief', label: 'Cumulatieve Marge' },
    { value: 'marge_perc', label: 'Marge %' },
  ];

  const pieData = data.filter(r => r.marge > 0).map(r => ({ name: r.name, marge: r.marge }));
  const margePercData = data.map(r => ({ ...r, margePerc: r.omzet > 0 ? parseFloat(((r.marge/r.omzet)*100).toFixed(1)) : 0 }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
        <CardTitle className="text-base">Margeopbouw {year} — maandelijks & cumulatief</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {view !== 'table' && view !== 'pie' && <MetricSelect value={metric} onChange={setMetric} options={metricOptions} />}
          <ChartToggle view={view} setView={setView} types={['table', 'bar', 'line', 'area', 'pie']} />
        </div>
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : 'space-y-4'}>
        {view === 'bar' && (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={metric === 'marge_perc' ? margePercData : data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={metric === 'marge_perc' ? v => `${v}%` : v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={metric === 'marge_perc' ? v => `${v}%` : v => formatCurrency(v)} />
              <Legend />
              {metric === 'alle' && <><Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" /><Bar dataKey="kost" fill="hsl(0, 84%, 60%)" radius={[4,4,0,0]} name="Kost" /><Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" /></>}
              {metric === 'marge' && <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" />}
              {metric === 'cumulatief' && <Bar dataKey="cumulatieve_marge" fill="hsl(262, 83%, 58%)" radius={[4,4,0,0]} name="Cumulatieve Marge" />}
              {metric === 'marge_perc' && <Bar dataKey="margePerc" fill="hsl(43, 74%, 55%)" radius={[4,4,0,0]} name="Marge %" />}
            </BarChart>
          </ResponsiveContainer>
        )}
        {view === 'line' && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metric === 'marge_perc' ? margePercData : data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={metric === 'marge_perc' ? v => `${v}%` : v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={metric === 'marge_perc' ? v => `${v}%` : v => formatCurrency(v)} />
              <Legend />
              {metric === 'alle' && <><Line type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Omzet" dot={{ r: 3 }} /><Line type="monotone" dataKey="kost" stroke="hsl(0, 84%, 60%)" strokeWidth={2} name="Kost" dot={{ r: 3 }} /><Line type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Marge" dot={{ r: 4 }} /></>}
              {metric === 'marge' && <Line type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Marge" dot={{ r: 4 }} />}
              {metric === 'cumulatief' && <><Line type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2} name="Marge" dot={{ r: 3 }} /><Line type="monotone" dataKey="cumulatieve_marge" stroke="hsl(262, 83%, 58%)" strokeWidth={2.5} strokeDasharray="5 3" name="Cumulatief" dot={{ r: 4 }} /></>}
              {metric === 'marge_perc' && <Line type="monotone" dataKey="margePerc" stroke="hsl(43, 74%, 55%)" strokeWidth={2.5} name="Marge %" dot={{ r: 4 }} />}
            </LineChart>
          </ResponsiveContainer>
        )}
        {view === 'area' && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaOmzet" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.25}/><stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/></linearGradient>
                <linearGradient id="areaMarge" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(142, 72%, 29%)" stopOpacity={0}/></linearGradient>
                <linearGradient id="areaCum" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.2}/><stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="omzet" stroke="hsl(221, 83%, 53%)" fill="url(#areaOmzet)" strokeWidth={2} name="Omzet" />
              <Area type="monotone" dataKey="marge" stroke="hsl(142, 72%, 29%)" fill="url(#areaMarge)" strokeWidth={2} name="Marge" />
              <Area type="monotone" dataKey="cumulatieve_marge" stroke="hsl(262, 83%, 58%)" fill="url(#areaCum)" strokeWidth={2} strokeDasharray="4 2" name="Cumulatief" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {view === 'pie' && <PieChartView data={pieData} dataKey="marge" height={320} />}
        {view === 'table' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Maand</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Cumulatief</th>
            </tr></thead>
            <tbody>
              {data.map(row => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{row.name}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(row.omzet)}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.kost)}</td>
                  <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(row.marge)}</td>
                  <td className="py-3 px-4 text-right">{row.marge_perc}%</td>
                  <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(row.cumulatieve_marge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}