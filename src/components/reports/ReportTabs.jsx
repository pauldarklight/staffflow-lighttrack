import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { BarChart2, List } from 'lucide-react';
import { formatCurrency, getMonthName } from '@/lib/formatters';

function ChartToggle({ view, setView }) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      <button onClick={() => setView('table')} className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${view === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
        <List className="w-3.5 h-3.5" /> Tabel
      </button>
      <button onClick={() => setView('chart')} className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${view === 'chart' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
        <BarChart2 className="w-3.5 h-3.5" /> Grafiek
      </button>
    </div>
  );
}

export function MonthlyTab({ monthlyData, year }) {
  const [view, setView] = useState('chart');
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Maandelijks Overzicht {year}</CardTitle>
        <ChartToggle view={view} setView={setView} />
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" />
              <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
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

export function ClientsTab({ clientTable }) {
  const [view, setView] = useState('table');
  const chartData = clientTable.slice(0, 10).map(([name, d]) => ({ name: name.length > 14 ? name.slice(0,13)+'…' : name, omzet: d.omzet, marge: d.marge }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Omzet & Marge per Klant</CardTitle>
        <ChartToggle view={view} setView={setView} />
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[0,4,4,0]} />
              <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
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

export function ConsultantsTab({ consultantTable }) {
  const [view, setView] = useState('table');
  const chartData = consultantTable.slice(0, 10).map(([name, d]) => ({ name: name.split(' ').slice(0,2).join(' '), omzet: d.omzet, marge: d.marge, kost: d.kost }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Marge per Consultant</CardTitle>
        <ChartToggle view={view} setView={setView} />
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'chart' ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[0,4,4,0]} />
              <Bar dataKey="kost" fill="hsl(0, 84%, 60%)" name="Kost" radius={[0,4,4,0]} />
              <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
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

export function SalesTab({ salesTable }) {
  const [view, setView] = useState('table');
  const chartData = salesTable.map(([name, d]) => ({ name, omzet: d.omzet, marge: d.marge }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Overzicht per Commerciële Consultant</CardTitle>
        <ChartToggle view={view} setView={setView} />
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'chart' ? (
          salesTable.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">Geen sales contributors gekoppeld aan placements</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" name="Omzet" radius={[4,4,0,0]} />
                <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" name="Marge" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
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

export function CommissionTab({ commissionTable }) {
  const [view, setView] = useState('table');
  const chartData = commissionTable.map(row => ({ name: `${row.name} ${row.quarter}`, marge: row.marge, commissie: row.marge * 0.1 }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Commissie per Kwartaal</CardTitle>
        <ChartToggle view={view} setView={setView} />
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : ''}>
        {view === 'chart' ? (
          commissionTable.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">Geen commissiedata beschikbaar</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="marge" fill="hsl(221, 83%, 53%)" name="Toegew. Marge" radius={[4,4,0,0]} />
                <Bar dataKey="commissie" fill="hsl(142, 72%, 29%)" name="Commissie (10%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

export function MargeopbouwTab({ data, year }) {
  const [view, setView] = useState('chart');
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Margeopbouw {year} — maandelijks & cumulatief</CardTitle>
        <ChartToggle view={view} setView={setView} />
      </CardHeader>
      <CardContent className={view === 'table' ? 'p-0' : 'space-y-6'}>
        {view === 'chart' ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Maandelijkse marge per maand</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="omzet" fill="hsl(221, 83%, 53%)" radius={[4,4,0,0]} name="Omzet" />
                  <Bar dataKey="kost" fill="hsl(0, 84%, 60%)" radius={[4,4,0,0]} name="Kost" />
                  <Bar dataKey="marge" fill="hsl(142, 72%, 29%)" radius={[4,4,0,0]} name="Marge" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Cumulatieve marge (opbouw)</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Line type="monotone" dataKey="cumulatieve_marge" stroke="hsl(142, 72%, 29%)" strokeWidth={2.5} name="Cumulatieve marge" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
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