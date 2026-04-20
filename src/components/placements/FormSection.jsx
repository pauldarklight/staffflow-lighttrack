import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FormSection({ title, icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', open && 'border-border')}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          {icon && <span className="text-base">{icon}</span>}
          {title}
          {badge && (
            <span className="ml-1 text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border/60">
          {children}
        </div>
      )}
    </div>
  );
}