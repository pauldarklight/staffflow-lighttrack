import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

// Nominatim autocomplete for a full address query
function useNominatim(query) {
  const [results, setResults] = useState([]);
  const timerRef = useRef(null);
  useEffect(() => {
    if (!query || query.length < 5) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=be,nl,fr,lu,de`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'nl' } });
      const data = await res.json();
      setResults(data);
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [query]);
  return results;
}

function parseNominatimAddress(item) {
  const a = item.address || {};
  return {
    street: a.road || a.pedestrian || a.footway || '',
    number: a.house_number || '',
    bus: '',
    postal_code: a.postcode || '',
    city: a.city || a.town || a.village || a.municipality || '',
    country: a.country || '',
  };
}

/**
 * Reusable address fields component
 * values: { street, number, bus, postal_code, city, country }
 * onChange: (field, value) => void
 */
export default function AddressFields({ values = {}, onChange, disabled = false }) {
  const [streetQuery, setStreetQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Build query from current street + number + city
  const nominatimQuery = [values.street, values.number, values.postal_code, values.city].filter(Boolean).join(' ');
  const suggestions = useNominatim(showSuggestions ? nominatimQuery : '');

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applySuggestion = (item) => {
    const parsed = parseNominatimAddress(item);
    Object.entries(parsed).forEach(([k, v]) => onChange(k, v));
    setShowSuggestions(false);
  };

  const field = (name) => ({
    value: values[name] || '',
    onChange: (e) => onChange(name, e.target.value),
    disabled,
  });

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {/* Map search button */}
      <button
        type="button"
        onClick={() => setShowSuggestions(v => !v)}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
          showSuggestions
            ? 'bg-primary/10 text-primary border-primary/30'
            : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
        }`}
      >
        <MapPin className="w-3 h-3" />
        {showSuggestions ? 'Suggesties verbergen' : '📍 Adres opzoeken via kaart'}
      </button>

      {/* Nominatim suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-background shadow-md z-10 max-h-52 overflow-y-auto">
          {suggestions.map((item) => (
            <button
              key={item.place_id}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b last:border-b-0"
              onClick={() => applySuggestion(item)}
            >
              <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
              <span>{item.display_name}</span>
            </button>
          ))}
        </div>
      )}
      {showSuggestions && nominatimQuery.length >= 5 && suggestions.length === 0 && (
        <p className="text-xs text-muted-foreground">Geen suggesties gevonden. Vul meer velden in.</p>
      )}

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