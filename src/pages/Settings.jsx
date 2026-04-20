import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Save, Bell, Palette, Globe, Zap, User, Shield, KeyRound, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const SETTINGS_KEY = 'lighttrack_settings';

const defaultSettings = {
  language: 'nl',
  theme: 'light',
  notifications_email: true,
  notifications_placement: true,
  notifications_invoice_overdue: true,
  notifications_timesheet: true,
  auto_templates: true,
  default_payment_terms_client: '30',
  default_payment_terms_consultant: '30',
  default_notice_period: '30 dagen',
  default_days_per_week: '5',
  default_perm_fee: '20',
  company_name: '',
  company_vat: '',
  company_email: '',
};

function Section({ icon: SectionIcon, title, children }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <SectionIcon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch { return defaultSettings; }
  });
  const [saved, setSaved] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(SETTINGS_KEY);
  };

  return (
    <div>
      <PageHeader title="Instellingen" subtitle="Beheer uw applicatievoorkeuren en standaardwaarden">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-1" /> Standaard herstellen
        </Button>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-1" />
          {saved ? '✓ Opgeslagen!' : 'Opslaan'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Profiel */}
        <Section icon={User} title="Profiel">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">
              {user?.full_name?.[0] || '?'}
            </div>
            <div>
              <p className="font-medium text-sm">{user?.full_name || '—'}</p>
              <p className="text-xs text-muted-foreground">{user?.email || '—'}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-xs">{user?.role || 'user'}</Badge>
          </div>
          <div className="space-y-2">
            <Label>Bedrijfsnaam (eigen bedrijf)</Label>
            <Input placeholder="Lighttrack BV" value={settings.company_name} onChange={e => update('company_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>BTW nummer</Label>
              <Input placeholder="BE0123456789" value={settings.company_vat} onChange={e => update('company_vat', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Facturatie e-mail</Label>
              <Input type="email" placeholder="info@bedrijf.be" value={settings.company_email} onChange={e => update('company_email', e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Weergave */}
        <Section icon={Palette} title="Weergave & Taal">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Taal</Label>
            <Select value={settings.language} onValueChange={v => update('language', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nl">🇧🇪 Nederlands</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Thema</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'light', label: '☀️ Licht' },
                { value: 'dark', label: '🌙 Donker' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('theme', opt.value)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${settings.theme === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Meldingen */}
        <Section icon={Bell} title="Meldingen">
          <ToggleRow
            label="E-mailmeldingen"
            description="Ontvang samenvattingen per e-mail"
            value={settings.notifications_email}
            onChange={v => update('notifications_email', v)}
          />
          <Separator />
          <ToggleRow
            label="Nieuwe placements"
            description="Melding bij aanmaken nieuwe placement"
            value={settings.notifications_placement}
            onChange={v => update('notifications_placement', v)}
          />
          <ToggleRow
            label="Vervallen facturen"
            description="Melding wanneer facturen 5 dagen voor vervaldatum staan"
            value={settings.notifications_invoice_overdue}
            onChange={v => update('notifications_invoice_overdue', v)}
          />
          <ToggleRow
            label="Timesheets herinnering"
            description="Herinnering op de 25e van de maand"
            value={settings.notifications_timesheet}
            onChange={v => update('notifications_timesheet', v)}
          />
        </Section>

        {/* Standaardwaarden placements */}
        <Section icon={Zap} title="Standaardwaarden Placements">
          <ToggleRow
            label="Automatisch sjablonen tonen"
            description="Relevante sjablonen pre-selecteren bij nieuw placement"
            value={settings.auto_templates}
            onChange={v => update('auto_templates', v)}
          />
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Betalingstermijn klant (dagen)</Label>
              <Input type="number" value={settings.default_payment_terms_client} onChange={e => update('default_payment_terms_client', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Betalingstermijn consultant (dagen)</Label>
              <Input type="number" value={settings.default_payment_terms_consultant} onChange={e => update('default_payment_terms_consultant', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Standaard opzegtermijn</Label>
              <Input value={settings.default_notice_period} onChange={e => update('default_notice_period', e.target.value)} placeholder="30 dagen" />
            </div>
            <div className="space-y-2">
              <Label>Standaard dagen/week</Label>
              <Select value={settings.default_days_per_week} onValueChange={v => update('default_days_per_week', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 dagen (voltijds)</SelectItem>
                  <SelectItem value="4">4 dagen</SelectItem>
                  <SelectItem value="3">3 dagen</SelectItem>
                  <SelectItem value="2.5">2.5 dagen (halftijds)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Standaard PERM fee %</Label>
            <Input type="number" step="0.1" value={settings.default_perm_fee} onChange={e => update('default_perm_fee', e.target.value)} />
          </div>
        </Section>

        {/* Beveiliging (info) */}
        <Section icon={Shield} title="Beveiliging">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
            <KeyRound className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Wachtwoord & authenticatie</p>
              <p className="text-xs text-muted-foreground mt-1">Wachtwoordbeheer en tweefactorauthenticatie worden beheerd via het platform-dashboard.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Sessie actief</p>
              <p className="text-xs text-emerald-700 mt-1">Je bent ingelogd als <strong>{user?.email}</strong>. Alle gegevens worden veilig versleuteld opgeslagen.</p>
            </div>
          </div>
        </Section>

        {/* Snelkoppelingen */}
        <Section icon={Zap} title="⚡ Snelkoppelingen">
          <p className="text-xs text-muted-foreground">Veelgebruikte acties vanuit de instellingen</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '+ Nieuwe Placement', path: '/Placements' },
              { label: '📋 Sjablonen beheren', path: '/Templates' },
              { label: '📊 Rapporten bekijken', path: '/Reports' },
              { label: '💰 Facturatie', path: '/Billing' },
            ].map(item => (
              <a
                key={item.path}
                href={item.path}
                className="flex items-center justify-center px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/40 text-sm font-medium transition-colors text-center"
              >
                {item.label}
              </a>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}