import React from 'react';
import { Card } from '@/components/ui/card';

export default function EmptyState({ icon: Icon, title, description, children }) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="p-4 rounded-2xl bg-muted mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>}
      {children}
    </Card>
  );
}