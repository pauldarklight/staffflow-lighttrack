import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Search, ChevronDown } from 'lucide-react';

const DEFAULT_EMPLOYEES = ['Yunes', 'Paul', 'Thomas', 'Marloes', 'Adnane', 'Maxim'];

function NameDropdown({ value, onChange, usedNames }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [customList, setCustomList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sales_employee_names') || '[]'); } catch { return []; }
  });
  const wrapperRef = useRef(null);

  const allNames = [...new Set([...DEFAULT_EMPLOYEES, ...customList])];
  const filtered = allNames.filter(n => n.toLowerCase().includes(query.toLowerCase()) && !usedNames.includes(n));
  const canAddNew = query.trim() && !allNames.some(n => n.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (name) => {
    onChange(name);
    setQuery('');
    setOpen(false);
  };

  const addNew = () => {
    const name = query.trim();
    const updated = [...new Set([...customList, name])];
    setCustomList(updated);
    localStorage.setItem('sales_employee_names', JSON.stringify(updated));
    select(name);
  };

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm hover:bg-muted/40 transition-colors"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || 'Selecteer naam...'}</span>
        <ChevronDown className="w-4 h-4 opacity-50" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-background shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Zoeken of nieuwe naam..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => select(name)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                {name}
              </button>
            ))}
            {canAddNew && (
              <button
                type="button"
                onClick={addNew}
                className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/5 flex items-center gap-2 border-t"
              >
                <Plus className="w-3.5 h-3.5" />
                "{query.trim()}" toevoegen als nieuw
              </button>
            )}
            {filtered.length === 0 && !canAddNew && (
              <p className="text-xs text-muted-foreground px-3 py-2">Geen resultaten</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SalesContributorField
 * contributors: [{ name, percentage }]
 * onChange: (contributors) => void
 */
export default function SalesContributorField({ contributors = [], onChange }) {
  const totalPct = contributors.reduce((sum, c) => sum + (parseFloat(c.percentage) || 0), 0);
  const remaining = 100 - totalPct;
  const overLimit = totalPct > 100;

  const add = () => onChange([...contributors, { name: '', percentage: remaining > 0 ? remaining : 0 }]);
  const remove = (idx) => onChange(contributors.filter((_, i) => i !== idx));
  const update = (idx, field, value) => {
    const updated = [...contributors];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {contributors.map((c, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <NameDropdown
            value={c.name}
            onChange={(name) => update(idx, 'name', name)}
            usedNames={contributors.filter((_, i) => i !== idx).map(x => x.name).filter(Boolean)}
          />
          <div className="relative w-24 shrink-0">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              placeholder="%"
              value={c.percentage}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                const otherSum = contributors.reduce((s, x, i) => s + (i !== idx ? parseFloat(x.percentage) || 0 : 0), 0);
                if (otherSum + val <= 100) update(idx, 'percentage', e.target.value);
              }}
              className="pr-6"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}

      {/* Progress bar */}
      {contributors.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className={overLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}>
              Totaal: {totalPct.toFixed(1)}%
            </span>
            <span className={remaining > 0 ? 'text-muted-foreground' : remaining === 0 ? 'text-emerald-600 font-medium' : 'text-destructive'}>
              {remaining > 0 ? `${remaining.toFixed(1)}% vrij` : remaining === 0 ? '✓ Volledig verdeeld' : 'Overschreden!'}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${overLimit ? 'bg-destructive' : totalPct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${Math.min(totalPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={totalPct >= 100}
      >
        <Plus className="w-4 h-4 mr-1" /> Toevoegen
      </Button>
      {overLimit && <p className="text-xs text-destructive">Totaal mag niet boven 100% uitkomen.</p>}
    </div>
  );
}