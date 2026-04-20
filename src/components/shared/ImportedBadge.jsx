import { PackageCheck } from 'lucide-react';

/**
 * Small badge shown when a record was imported from an external source.
 * Usage: <ImportedBadge />
 */
export default function ImportedBadge() {
  return (
    <span
      title="Geïmporteerd vanuit Actuals Excel"
      className="inline-flex items-center gap-1 text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 whitespace-nowrap"
    >
      <PackageCheck className="w-3 h-3" />
      Import
    </span>
  );
}