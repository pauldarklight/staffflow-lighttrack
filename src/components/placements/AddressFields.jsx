import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Reusable address fields component
 * values: { street, number, bus, postal_code, city, country }
 * onChange: (field, value) => void
 */
export default function AddressFields({ values = {}, onChange, disabled = false }) {
  const field = (name) => ({
    value: values[name] || '',
    onChange: (e) => onChange(name, e.target.value),
    disabled,
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs text-muted-foreground">Straat</Label>
          <Input placeholder="Dorpstraat" {...field('street')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nr.</Label>
          <Input placeholder="10" {...field('number')} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bus / App.</Label>
          <Input placeholder="bus 2" {...field('bus')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Postcode</Label>
          <Input placeholder="2000" {...field('postal_code')} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Gemeente</Label>
          <Input placeholder="Antwerpen" {...field('city')} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Land</Label>
        <Input placeholder="België" {...field('country')} />
      </div>
    </div>
  );
}

/** Compose address parts into a single string for template compatibility */
export function composeAddress({ street, number, bus, postal_code, city, country } = {}) {
  const line1 = [street, number, bus ? `bus ${bus}` : ''].filter(Boolean).join(' ');
  const line2 = [postal_code, city].filter(Boolean).join(' ');
  return [line1, line2, country].filter(Boolean).join(', ');
}