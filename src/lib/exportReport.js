import * as XLSX from 'xlsx';

function fmt(v) {
  return typeof v === 'number' ? Math.round(v * 100) / 100 : v ?? '';
}

export function exportToExcel({ activeTab, year, data }) {
  const wb = XLSX.utils.book_new();

  const tabConfigs = {
    monthly: {
      title: `Maandoverzicht ${year}`,
      headers: ['Maand', 'Omzet (€)', 'Kost (€)', 'Marge (€)', 'Marge %'],
      rows: (data.monthlyData || []).map(r => [
        r.name,
        fmt(r.omzet),
        fmt(r.kost),
        fmt(r.marge),
        r.omzet > 0 ? fmt((r.marge / r.omzet) * 100) : 0,
      ]),
    },
    clients: {
      title: `Per Klant ${year}`,
      headers: ['Klant', 'Omzet (€)', 'Marge (€)', 'Marge %'],
      rows: (data.clientTable || []).map(([name, d]) => [
        name,
        fmt(d.omzet),
        fmt(d.marge),
        d.omzet > 0 ? fmt((d.marge / d.omzet) * 100) : 0,
      ]),
    },
    consultants: {
      title: `Per Consultant ${year}`,
      headers: ['Consultant', 'Omzet (€)', 'Kost (€)', 'Marge (€)', 'Marge %'],
      rows: (data.consultantTable || []).map(([name, d]) => [
        name,
        fmt(d.omzet),
        fmt(d.kost),
        fmt(d.marge),
        d.omzet > 0 ? fmt((d.marge / d.omzet) * 100) : 0,
      ]),
    },
    sales: {
      title: `Per Sales ${year}`,
      headers: ['Sales', 'Toeg. Omzet (€)', 'Toeg. Marge (€)'],
      rows: (data.salesTable || []).map(([name, d]) => [name, fmt(d.omzet), fmt(d.marge)]),
    },
    commission: {
      title: `Commissie ${year}`,
      headers: ['Sales', 'Kwartaal', 'Toeg. Marge (€)', 'Commissie (€)'],
      rows: (data.commissionTable || []).map(r => [
        r.name, r.quarter, fmt(r.marge), fmt(r.marge * 0.1),
      ]),
    },
    margeopbouw: {
      title: `Margeopbouw ${year}`,
      headers: ['Maand', 'Omzet (€)', 'Kost (€)', 'Marge (€)', 'Marge %', 'Cumulatieve Marge (€)'],
      rows: (data.margeopbouwData || []).map(r => [
        r.name, fmt(r.omzet), fmt(r.kost), fmt(r.marge), r.marge_perc, fmt(r.cumulatieve_marge),
      ]),
    },
    vergelijking: {
      title: `Verwacht vs Werkelijk ${year}`,
      headers: ['Maand', 'Verwacht (€)', 'Werkelijk (€)', 'Afwijking (€)', 'Afwijking %'],
      rows: (data.vergelijkingData || []).map(r => [
        r.name, fmt(r.verwacht), fmt(r.werkelijk), fmt(r.afwijking), fmt(r.pct),
      ]),
    },
    targets_vs_actual: {
      title: `Target vs Werkelijk ${year}`,
      headers: ['KPI', 'Kwartaal', 'Target', 'Werkelijk', '% Behaald'],
      rows: (data.targetRows || []).flatMap(r => [
        ['Brutomarge', r.q, fmt(r.brutomarge?.target), fmt(r.brutomarge?.actual),
          r.brutomarge?.target > 0 ? fmt((r.brutomarge.actual / r.brutomarge.target) * 100) : '—'],
        ['PERM Fees', r.q, fmt(r.perm?.target), fmt(r.perm?.actual),
          r.perm?.target > 0 ? fmt((r.perm.actual / r.perm.target) * 100) : '—'],
        ['Actieve Consultants', r.q, fmt(r.consultants?.target), fmt(r.consultants?.actual),
          r.consultants?.target > 0 ? fmt((r.consultants.actual / r.consultants.target) * 100) : '—'],
        ['New Deals', r.q, fmt(r.new_deals?.target), fmt(r.new_deals?.actual),
          r.new_deals?.target > 0 ? fmt((r.new_deals.actual / r.new_deals.target) * 100) : '—'],
      ]),
    },
    targets: {
      title: `Targets ${year}`,
      headers: ['Kwartaal', 'Target Brutomarge (€)', 'Target PERM (€)', 'Target Consultants', 'Target New Deals'],
      rows: (data.targetRows || []).map(r => [
        r.q,
        fmt(r.brutomarge?.target),
        fmt(r.perm?.target),
        fmt(r.consultants?.target),
        fmt(r.new_deals?.target),
      ]),
    },
  };

  const config = tabConfigs[activeTab];
  if (!config || config.rows.length === 0) {
    // Fallback: export all available sheets
    Object.entries(tabConfigs).forEach(([key, cfg]) => {
      if (cfg.rows.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet([cfg.headers, ...cfg.rows]);
        XLSX.utils.book_append_sheet(wb, ws, cfg.title.slice(0, 31));
      }
    });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([config.headers, ...config.rows]);
    // Style header row bold (basic column widths)
    const colWidths = config.headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 31));
  }

  const filename = `Rapport_${activeTab}_${year}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}