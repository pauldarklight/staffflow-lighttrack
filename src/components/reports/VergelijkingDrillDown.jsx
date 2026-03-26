import React from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { ExternalLink, AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react';

function getOorzaak(verwacht, werkelijk, expectedDays, ts) {
  if (!ts) {
    return {
      label: 'Geen timesheet ingediend',
      icon: <Clock className="w-3 h-3 text-red-500" />,
      color: 'text-red-600',
    };
  }
  const diff = werkelijk - verwacht;
  const pct = verwacht > 0 ? (diff / verwacht) * 100 : 0;
  if (Math.abs(pct) <= 5) {
    return {
      label: 'Conform verwachting',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,
      color: 'text-emerald-600',
    };
  }
  if (diff < 0) {
    const daysWorked = ts.days_worked || 0;
    return {
      label: `Minder dagen gefactureerd (${daysWorked} vs ${expectedDays} verwacht)`,
      icon: <TrendingDown className="w-3 h-3 text-amber-500" />,
      color: 'text-amber-700',
    };
  }
  return {
    label: `Meer dagen gefactureerd (${ts.days_worked || 0} vs ${expectedDays} verwacht)`,
    icon: <TrendingUp className="w-3 h-3 text-blue-500" />,
    color: 'text-blue-700',
  };
}

export default function VergelijkingDrillDown({ placements, timesheets, month, year, workingDays }) {
  const yr = parseInt(year);

  const rows = placements
    .filter(p => (!p.placement_type || p.placement_type === 'freelancer') && p.status === 'active')
    .map(p => {
      const fraction = (p.days_per_week || 5) / 5;
      const expectedDays = parseFloat((workingDays * fraction).toFixed(1));
      const verwacht = expectedDays * (p.client_rate || 0);
      const ts = timesheets.find(t => t.placement_id === p.id && t.month === month && t.year === yr);
      const werkelijk = ts ? (ts.client_revenue || 0) : 0;
      const afwijking = werkelijk - verwacht;
      const oorzaak = getOorzaak(verwacht, werkelijk, expectedDays, ts);
      return { p, expectedDays, verwacht, werkelijk, afwijking, ts, oorzaak };
    })
    .sort((a, b) => a.afwijking - b.afwijking); // worst first

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-muted/30 border-t border-b border-border/50 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Breakdown per placement</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Consultant</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Klant</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground">Verwachte dagen</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Verwacht</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Werkelijk</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Afwijking</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Oorzaak</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Actie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, expectedDays, verwacht, werkelijk, afwijking, ts, oorzaak }) => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-muted/40">
                  <td className="py-2 px-2 font-medium text-foreground">
                    {p.consultant_first_name} {p.consultant_last_name}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{p.client_company_name}</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{expectedDays}</td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{formatCurrency(verwacht)}</td>
                  <td className="py-2 px-2 text-right font-medium">
                    {ts ? formatCurrency(werkelijk) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={`py-2 px-2 text-right font-semibold ${afwijking < -verwacht * 0.05 ? 'text-red-600' : afwijking > verwacht * 0.05 ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {ts ? (afwijking >= 0 ? '+' : '') + formatCurrency(afwijking) : '—'}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`flex items-center gap-1 ${oorzaak.color}`}>
                      {oorzaak.icon}
                      {oorzaak.label}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <Link
                      to="/Contracts"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Contract <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}