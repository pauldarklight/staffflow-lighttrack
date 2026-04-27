import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { Pencil, Check, X, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTHS = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12] };

function getQuarterFromMonth(m) {
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

function ProgressRing({ pct, color, size = 80 }) {
  const radius = (size - 10) / 2;
  const circ = 2 * Math.PI * radius;
  const filled = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(220,13%,91%)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  );
}

function KpiCard({ label, target, actual, unit = '€', isCount = false, color }) {
  const pct = target > 0 ? (actual / target) * 100 : 0;
  const fmt = isCount ? v => v.toFixed(0) : v => formatCurrency(v);
  const colorStr = pct >= 100 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-xl border bg-card relative">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
        <ProgressRing pct={pct} color={colorStr} size={80} />
        <div className="absolute text-xs font-bold" style={{ color: colorStr }}>{Math.round(pct)}%</div>
      </div>
      <div className="text-sm font-bold text-foreground mt-1">{fmt(actual)}</div>
      <div className="text-xs text-muted-foreground">van {fmt(target)}</div>
      <div className={`text-xs font-semibold mt-1 flex items-center gap-0.5 ${pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
        {pct >= 100 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {pct >= 100 ? `+${fmt(actual - target)} boven doel` : `${fmt(target - actual)} te gaan`}
      </div>
    </div>
  );
}

function EditRow({ quarter, year, existing, onSave, onCancel }) {
  const [form, setForm] = useState({
    target_brutomarge: existing?.target_brutomarge || '',
    target_perm: existing?.target_perm || '',
    target_consultants: existing?.target_consultants || '',
    target_new_deals: existing?.target_new_deals || '',
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-xl border border-primary/20">
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1 block">Brutomarge (€)</label>
        <Input type="number" value={form.target_brutomarge} onChange={e => setForm(f => ({ ...f, target_brutomarge: e.target.value }))} placeholder="0" className="h-8 text-sm" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1 block">PERM fees (€)</label>
        <Input type="number" value={form.target_perm} onChange={e => setForm(f => ({ ...f, target_perm: e.target.value }))} placeholder="0" className="h-8 text-sm" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1 block">Actieve Consultants (#)</label>
        <Input type="number" value={form.target_consultants} onChange={e => setForm(f => ({ ...f, target_consultants: e.target.value }))} placeholder="0" className="h-8 text-sm" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1 block">New Deals (#)</label>
        <Input type="number" value={form.target_new_deals} onChange={e => setForm(f => ({ ...f, target_new_deals: e.target.value }))} placeholder="0" className="h-8 text-sm" />
      </div>
      <div className="col-span-2 md:col-span-4 flex gap-2 justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5 mr-1" />Annuleer</Button>
        <Button size="sm" onClick={() => onSave({ ...form, year, quarter,
          target_brutomarge: parseFloat(form.target_brutomarge) || 0,
          target_perm: parseFloat(form.target_perm) || 0,
          target_consultants: parseFloat(form.target_consultants) || 0,
          target_new_deals: parseFloat(form.target_new_deals) || 0,
        })}><Check className="w-3.5 h-3.5 mr-1" />Opslaan</Button>
      </div>
    </div>
  );
}

export default function TargetTab({ timesheets, placements, year }) {
  const [editingQ, setEditingQ] = useState(null);
  const queryClient = useQueryClient();

  const { data: targets = [] } = useQuery({
    queryKey: ['targets'],
    queryFn: () => base44.entities.Target.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = targets.find(t => t.year === data.year && t.quarter === data.quarter);
      if (existing) return base44.entities.Target.update(existing.id, data);
      return base44.entities.Target.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setEditingQ(null);
    },
  });

  const yr = parseInt(year);

  // Actuals per quarter
  const actuals = useMemo(() => {
    const result = {};
    QUARTERS.forEach(q => {
      const months = QUARTER_MONTHS[q];
      const qTs = timesheets.filter(t => t.year === yr && months.includes(t.month));
      const brutomarge = qTs.reduce((s, t) => s + (t.margin || 0), 0);

      // PERM: sum fee for placements starting in this quarter/year
      const permFee = placements.filter(p => {
        if (p.placement_type !== 'perm' || !p.start_date) return false;
        const d = new Date(p.start_date);
        return d.getFullYear() === yr && months.includes(d.getMonth() + 1);
      }).reduce((s, p) => s + (p.perm_fee_amount || ((p.perm_annual_salary || 0) * ((p.perm_fee_percentage || 20) / 100))), 0);

      // Active consultants: unique consultant names with approved timesheets in period
      const activeConsultants = new Set(qTs.filter(t => t.days_worked > 0).map(t => t.consultant_name)).size;

      // New deals: new placements starting in this quarter
      const newDeals = placements.filter(p => {
        if (!p.start_date) return false;
        const d = new Date(p.start_date);
        return d.getFullYear() === yr && months.includes(d.getMonth() + 1);
      }).length;

      result[q] = { brutomarge, perm: permFee, consultants: activeConsultants, new_deals: newDeals };
    });
    return result;
  }, [timesheets, placements, yr]);

  const getTarget = (q) => targets.find(t => t.year === yr && t.quarter === q) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Targets vs Werkelijkheid — {year}</span>
        <span className="text-xs text-muted-foreground ml-2">Klik op "Bewerk" per kwartaal om targets in te stellen</span>
      </div>

      {QUARTERS.map(q => {
        const t = getTarget(q);
        const a = actuals[q] || {};
        const isEditing = editingQ === q;
        const hasTarget = t.target_brutomarge || t.target_perm || t.target_consultants || t.target_new_deals;

        return (
          <Card key={q} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-5">
              <CardTitle className="text-base font-bold">{q} {year}</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingQ(isEditing ? null : q)}>
                <Pencil className="w-3 h-3 mr-1" />{isEditing ? 'Annuleer' : 'Bewerk targets'}
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {isEditing && (
                <EditRow quarter={q} year={yr} existing={t}
                  onSave={(data) => saveMutation.mutate(data)}
                  onCancel={() => setEditingQ(null)} />
              )}
              {!hasTarget && !isEditing && (
                <p className="text-xs text-muted-foreground italic">Nog geen targets ingesteld voor {q}. Klik op "Bewerk targets" om te starten.</p>
              )}
              {hasTarget && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Brutomarge" target={t.target_brutomarge || 0} actual={a.brutomarge || 0} />
                  <KpiCard label="PERM Fees" target={t.target_perm || 0} actual={a.perm || 0} />
                  <KpiCard label="Actieve Consultants" target={t.target_consultants || 0} actual={a.consultants || 0} isCount />
                  <KpiCard label="New Deals" target={t.target_new_deals || 0} actual={a.new_deals || 0} isCount />
                </div>
              )}
              {/* Raw actuals always visible */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {[
                  { label: 'Brutomarge', value: formatCurrency(a.brutomarge || 0), color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                  { label: 'PERM Fees', value: formatCurrency(a.perm || 0), color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
                  { label: 'Actieve Consultants', value: `${a.consultants || 0}`, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100' },
                  { label: 'New Deals', value: `${a.new_deals || 0}`, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
                ].map(k => (
                  <div key={k.label} className={`rounded-lg border px-3 py-2 ${k.bg}`}>
                    <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
                    <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
                    <div className="text-xs text-muted-foreground">werkelijk</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}