import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, XCircle, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * VatLookupInput — BTW-nummer input met VIES verificatie
 * props:
 *   value, onChange: controlled input
 *   onFill: ({ company_name, address_lines }) => void  — callback to apply suggestion
 */
export default function VatLookupInput({ value, onChange, onFill, placeholder = 'BE0123.456.789' }) {
  const [status, setStatus] = useState(null); // null | 'loading' | 'valid' | 'invalid' | 'error'
  const [result, setResult] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);

  const lookup = async () => {
    if (!value?.trim()) return;
    setStatus('loading');
    setResult(null);
    setShowSuggestion(false);
    const res = await base44.functions.invoke('lookupVat', { vat_number: value });
    const data = res.data;
    if (data.error && !data.valid) {
      setStatus('error');
      setResult({ message: data.error || 'Onbekende fout' });
      return;
    }
    if (!data.valid) {
      setStatus('invalid');
      setResult({ message: data.message || 'Ongeldig BTW-nummer' });
      return;
    }
    setStatus('valid');
    setResult(data);
    setShowSuggestion(true);
  };

  const apply = () => {
    if (onFill && result) onFill(result);
    setShowSuggestion(false);
  };

  const statusIcon = {
    loading: <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />,
    valid: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    invalid: <XCircle className="w-4 h-4 text-destructive" />,
    error: <XCircle className="w-4 h-4 text-amber-500" />,
  }[status];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Input
            value={value || ''}
            onChange={e => { onChange(e.target.value); setStatus(null); setResult(null); }}
            placeholder={placeholder}
            className={
              status === 'valid' ? 'border-emerald-400 pr-8' :
              status === 'invalid' ? 'border-destructive pr-8' : 'pr-8'
            }
          />
          {statusIcon && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">{statusIcon}</span>
          )}
        </div>
        <button
          type="button"
          onClick={lookup}
          disabled={status === 'loading' || !value?.trim()}
          className="flex items-center gap-1.5 px-3 h-9 rounded-md border border-border bg-muted text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          <Search className="w-3.5 h-3.5" />
          Verifieer
        </button>
      </div>

      {/* Validation message */}
      {status === 'invalid' && (
        <p className="text-xs text-destructive">{result?.message}</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-amber-600">{result?.message}</p>
      )}

      {/* Suggestion banner */}
      {status === 'valid' && result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Geldig BTW-nummer gevonden
            </span>
            <button type="button" onClick={() => setShowSuggestion(v => !v)} className="text-emerald-600 hover:text-emerald-800">
              {showSuggestion ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {showSuggestion && (
            <>
              <div className="text-emerald-900">
                <div className="font-medium">{result.company_name}</div>
                {result.address_lines?.map((l, i) => <div key={i} className="text-emerald-700">{l}</div>)}
              </div>
              {onFill && (
                <button
                  type="button"
                  onClick={apply}
                  className="mt-1 px-3 py-1 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors"
                >
                  Gegevens overnemen
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}