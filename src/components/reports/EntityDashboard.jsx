import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, getMonthName } from '@/lib/formatters';
import { Search, X } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

const QUARTERS = { '1': [1,2,3], '2': [4,5,6], '3': [7,8,9], '4': [10,11,12] };

function KpiCard({ label, value, color, bg }) {
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="text-xs text-muted-foreground font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

// Searchable multi-select dropdown
function EntitySearchSelect({ allNames, selected, onToggle, onClear, placeholder }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = allNames.filter(n => n.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center gap-1 h-8 min-w-[220px] max-w-[340px] border border-input rounded-md bg-background px-2 cursor-pointer text-xs"
        onClick={() => setOpen(o => !o)}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {selected.length === 0 ? (
          <span className="text-muted-foreground flex-1">{placeholder}</span>
        ) : (
          <div className="flex gap-1 flex-wrap flex-1 py-0.5 overflow-hidden">
            {selected.slice(0, 2).map(name => (
              <span key={name} className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-medium flex items-center gap-1">
                {name.split(' ')[0]}
                <button onClick={e => { e.stopPropagation(); onToggle(name); }} className="hover:text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {selected.length > 2 && (
              <span className="text-muted-foreground text-xs">+{selected.length - 2}</span>
            )}
          </div>
        )}
        {selected.length > 0 && (
          <button onClick={e => { e.stopPropagation(); onClear(); }} className="ml-auto text-muted-foreground hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-popover border border-border rounded-md shadow-lg">
          <div className="p-2 border-b">
            <input
              autoFocus
              type="text"
              placeholder="Zoeken..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Geen resultaten</div>
            ) : filtered.map(name => (
              <div
                key={name}
                onClick={() => onToggle(name)}
                className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted transition-colors ${selected.includes(name) ? 'bg-primary/5 font-semibold text-primary' : ''}`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selected.includes(name) ? 'bg-primary border-primary' : 'border-input'}`}>
                  {selected.includes(name) && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                </div>
                {name}
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="p-2 border-t">
              <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive w-full text-left">
                Selectie wissen ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EntityDashboard({ timesheets, placements, years }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [viewMode, setViewMode] = useState('jaar');
  const [filterQuarter, setFilterQuarter] = useState(String(Math.ceil((now.getMonth() + 1) / 3)));
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));
  const [activeEntity, setActiveEntity] = useState('consultants');
  const [selectedNames, setSelectedNames] = useState([]); // selected filter

  const yr = parseInt(year);

  const scopedTs = useMemo(() => {
    return timesheets.filter(t => {
      if (t.year !== yr) return false;
      if (viewMode === 'maand') return t.month === parseInt(filterMonth);
      if (viewMode === 'kwartaal') return (QUARTERS[filterQuarter] || []).includes(t.month);
      return true;
    });
  }, [timesheets, yr, viewMode, filterQuarter, filterMonth]);

  const scopeMonths = useMemo(() => {
    if (viewMode === 'maand') return [parseInt(filterMonth)];
    if (viewMode === 'kwartaal') return QUARTERS[filterQuarter] || [];
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, [viewMode, filterQuarter, filterMonth]);

  // ── Build all rows (unfiltered) ──
  const consultantRows = useMemo(() => {
    const map = {};
    scopedTs.forEach(t => {
      const name = t.consultant_name; if (!name) return;
      if (!map[name]) map[name] = { name, omzet: 0, kost: 0, marge: 0, dagen: 0 };
      map[name].omzet += t.client_revenue || 0;
      map[name].kost += t.consultant_revenue || 0;
      map[name].marge += t.margin || 0;
      map[name].dagen += t.days_worked || 0;
    });
    return Object.values(map).sort((a, b) => b.marge - a.marge);
  }, [scopedTs]);

  const clientRows = useMemo(() => {
    const map = {};
    scopedTs.forEach(t => {
      const name = t.client_company; if (!name) return;
      if (!map[name]) map[name] = { name, omzet: 0, kost: 0, marge: 0, dagen: 0 };
      map[name].omzet += t.client_revenue || 0;
      map[name].kost += t.consultant_revenue || 0;
      map[name].marge += t.margin || 0;
      map[name].dagen += t.days_worked || 0;
    });
    return Object.values(map).sort((a, b) => b.omzet - a.omzet);
  }, [scopedTs]);

  const salesRows = useMemo(() => {
    const map = {};
    placements.forEach(p => {
      let totalRevenue = 0, totalMargin = 0;
      if (p.placement_type === 'perm') {
        const startYear = p.start_date ? new Date(p.start_date).getFullYear() : null;
        if (startYear !== yr) return;
        const fee = p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100));
        totalRevenue = fee; totalMargin = fee;
      } else {
        const pTs = scopedTs.filter(t => t.placement_id === p.id);
        totalRevenue = pTs.reduce((s, t) => s + (t.client_revenue || 0), 0);
        totalMargin = pTs.reduce((s, t) => s + (t.margin || 0), 0);
      }
      (p.sales_contributors || []).forEach(sc => {
        if (!sc.name) return;
        if (!map[sc.name]) map[sc.name] = { name: sc.name, omzet: 0, marge: 0, deals: 0 };
        const pct = (sc.percentage || 0) / 100;
        map[sc.name].omzet += totalRevenue * pct;
        map[sc.name].marge += totalMargin * pct;
        map[sc.name].deals += 1;
      });
    });
    return Object.values(map).sort((a, b) => b.marge - a.marge);
  }, [placements, scopedTs, yr]);

  const allRows = activeEntity === 'consultants' ? consultantRows
    : activeEntity === 'clients' ? clientRows
    : salesRows;

  const allNames = allRows.map(r => r.name);

  // Apply selection filter
  const rows = selectedNames.length > 0
    ? allRows.filter(r => selectedNames.includes(r.name))
    : allRows;

  // Chart: filtered by selection
  const chartData = useMemo(() => {
    return scopeMonths.map(m => {
      let mTs = timesheets.filter(t => t.year === yr && t.month === m);
      if (selectedNames.length > 0) {
        if (activeEntity === 'consultants') mTs = mTs.filter(t => selectedNames.includes(t.consultant_name));
        else if (activeEntity === 'clients') mTs = mTs.filter(t => selectedNames.includes(t.client_company));
        // for sales: approximate by filtering placements linked to selected sales
        else {
          const selectedPlacements = placements.filter(p =>
            (p.sales_contributors || []).some(sc => selectedNames.includes(sc.name))
          ).map(p => p.id);
          mTs = mTs.filter(t => selectedPlacements.includes(t.placement_id));
        }
      }
      return {
        name: getMonthName(m).slice(0, 3),
        omzet: mTs.reduce((s, t) => s + (t.client_revenue || 0), 0),
        marge: mTs.reduce((s, t) => s + (t.margin || 0), 0),
      };
    });
  }, [timesheets, yr, scopeMonths, selectedNames, activeEntity, placements]);

  const totalOmzet = rows.reduce((s, r) => s + r.omzet, 0);
  const totalMarge = rows.reduce((s, r) => s + r.marge, 0);
  const totalDagen = rows.reduce((s, r) => s + (r.dagen || 0), 0);
  const margePerc = totalOmzet > 0 ? (totalMarge / totalOmzet) * 100 : 0;

  const entityLabel = activeEntity === 'consultants' ? 'Consultant'
    : activeEntity === 'clients' ? 'Klant'
    : 'Sales Werknemer';

  const periodLabel = viewMode === 'jaar' ? `Jaar ${year}`
    : viewMode === 'kwartaal' ? `Q${filterQuarter} ${year}`
    : `${getMonthName(parseInt(filterMonth))} ${year}`;

  const placeholder = activeEntity === 'consultants' ? 'Zoek consultant...'
    : activeEntity === 'clients' ? 'Zoek klant...'
    : 'Zoek sales werknemer...';

  const toggleName = (name) => {
    setSelectedNames(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // Reset selection when switching entity type
  const handleEntitySwitch = (key) => {
    setActiveEntity(key);
    setSelectedNames([]);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border border-border overflow-hidden">
          {[['jaar','Jaar'],['kwartaal','Kwartaal'],['maand','Maand']].map(([mode,label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === mode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}>{label}</button>
          ))}
        </div>

        {viewMode === 'kwartaal' && (
          <Select value={filterQuarter} onValueChange={setFilterQuarter}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['1','2','3','4'].map(q => <SelectItem key={q} value={q}>Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {viewMode === 'maand' && (
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({length:12},(_,i) => <SelectItem key={i+1} value={String(i+1)}>{getMonthName(i+1)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Entity type toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {[['consultants','Per Consultant'],['clients','Per Klant'],['sales','Per Sales']].map(([key,label]) => (
            <button key={key} onClick={() => handleEntitySwitch(key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeEntity === key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}>{label}</button>
          ))}
        </div>

        {/* Search/filter */}
        <EntitySearchSelect
          allNames={allNames}
          selected={selectedNames}
          onToggle={toggleName}
          onClear={() => setSelectedNames([])}
          placeholder={placeholder}
        />

        {selectedNames.length > 0 && (
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-1">
            {selectedNames.length} geselecteerd
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Totale Omzet" value={formatCurrency(totalOmzet)} color="text-blue-600" bg="bg-blue-50 border-blue-200" />
        <KpiCard label="Totale Marge" value={formatCurrency(totalMarge)} color="text-emerald-600" bg="bg-emerald-50 border-emerald-200" />
        <KpiCard label="Gem. Marge %" value={`${margePerc.toFixed(1)}%`} color="text-violet-600" bg="bg-violet-50 border-violet-200" />
        {activeEntity === 'sales'
          ? <KpiCard label="Totaal Deals" value={`${rows.reduce((s,r) => s+(r.deals||0),0)}`} color="text-orange-600" bg="bg-orange-50 border-orange-200" />
          : <KpiCard label="Totaal Dagen" value={`${totalDagen.toFixed(0)}d`} color="text-orange-600" bg="bg-orange-50 border-orange-200" />
        }
      </div>

      {/* Evolution chart */}
      {scopeMonths.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Evolutie Omzet & Marge — {periodLabel}
              {selectedNames.length > 0 && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedNames.join(', ')})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="omzet" stroke="hsl(221,83%,53%)" strokeWidth={2} name="Omzet" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="marge" stroke="hsl(142,72%,29%)" strokeWidth={2} name="Marge" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Bar chart top 10 */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top {Math.min(rows.length, 10)} {entityLabel}s — {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(240, Math.min(rows.length, 10) * 36)}>
              <BarChart data={rows.slice(0,10).map(r => ({
                name: r.name.length > 18 ? r.name.slice(0,17)+'…' : r.name,
                omzet: r.omzet, marge: r.marge,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="omzet" fill="hsl(221,83%,53%)" name="Omzet" radius={[0,4,4,0]} />
                <Bar dataKey="marge" fill="hsl(142,72%,29%)" name="Marge" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detail table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Omzet & Marge per {entityLabel} — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{entityLabel}</th>
                {activeEntity !== 'sales' && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Dagen</th>}
                {activeEntity === 'sales' && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Deals</th>}
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Omzet</th>
                {activeEntity !== 'sales' && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Kost</th>}
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Marge %</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Geen data voor deze periode</td></tr>
              ) : rows.map(row => {
                const mp = row.omzet > 0 ? (row.marge / row.omzet) * 100 : 0;
                const isSelected = selectedNames.includes(row.name);
                return (
                  <tr key={row.name}
                    onClick={() => toggleName(row.name)}
                    className={`border-b border-border/50 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}`}>
                    <td className="py-3 px-4 font-medium flex items-center gap-2">
                      <div className={`w-3 h-3 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                        {isSelected && <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                      </div>
                      {row.name}
                    </td>
                    {activeEntity !== 'sales' && (
                      <td className={`py-3 px-4 text-right ${row.dagen < 10 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                        {row.dagen.toFixed(0)}
                      </td>
                    )}
                    {activeEntity === 'sales' && (
                      <td className="py-3 px-4 text-right text-violet-600 font-semibold">{row.deals || 0}</td>
                    )}
                    <td className="py-3 px-4 text-right">{formatCurrency(row.omzet)}</td>
                    {activeEntity !== 'sales' && (
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(row.kost)}</td>
                    )}
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(row.marge)}</td>
                    <td className="py-3 px-4 text-right">{mp.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="py-3 px-4">Totaal {selectedNames.length > 0 ? `(${selectedNames.length} geselecteerd)` : ''}</td>
                  {activeEntity !== 'sales' && <td className="py-3 px-4 text-right">{totalDagen.toFixed(0)}</td>}
                  {activeEntity === 'sales' && <td className="py-3 px-4 text-right">{rows.reduce((s,r) => s+(r.deals||0),0)}</td>}
                  <td className="py-3 px-4 text-right">{formatCurrency(totalOmzet)}</td>
                  {activeEntity !== 'sales' && <td className="py-3 px-4 text-right text-muted-foreground">{formatCurrency(rows.reduce((s,r) => s+r.kost,0))}</td>}
                  <td className="py-3 px-4 text-right text-emerald-600">{formatCurrency(totalMarge)}</td>
                  <td className="py-3 px-4 text-right">{margePerc.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}