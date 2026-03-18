import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp }) {
  return (
    <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn("text-xs font-medium", trendUp ? "text-emerald-600" : "text-red-500")}>
              {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Card>
  );
}