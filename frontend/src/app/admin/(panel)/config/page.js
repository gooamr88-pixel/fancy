'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../_lib/adminApi';
import { T, card } from '../../_components/theme';
import { Button } from '../../_components/Modal';
import { useAlert } from '../../_components/AlertContext';

export default function ConfigPage() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [smsRate, setSmsRate] = useState(8);
  const [smsMarkupPercentage, setSmsMarkupPercentage] = useState(40.0);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(0.0);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [manualMethods, setManualMethods] = useState([]);
  const [landingStats, setLandingStats] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.get('/pricing');
        if (res.config) {
          setSmsRate(res.config.sms_rate_cents_per_credit ?? 8);
          setSmsMarkupPercentage(res.config.sms_markup_percentage ?? 40.0);
          setPlatformCommissionPct(res.config.platform_commission_pct ?? 0.0);
          setPricingTiers(res.config.pricing_tiers || []);
          setManualMethods(res.config.manual_payment_methods || []);
          setLandingStats(res.config.landing_stats || []);
        }
      } catch (err) {
        setError(err.message || 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.patch('/pricing', {
        smsRateCentsPerCredit: parseFloat(smsRate),
        smsMarkupPercentage: parseFloat(smsMarkupPercentage),
        platformCommissionPct: parseFloat(platformCommissionPct),
        pricingTiers,
        manualPaymentMethods: manualMethods,
        landingStats,
      });
      await showAlert('Configuration saved successfully.', 'Success', 'success');
    } catch (err) {
      await showAlert(err.message || 'Failed to save configuration', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Pricing tier helpers
  const handleTierChange = (idx, field, val) => {
    setPricingTiers(prev => prev.map((tier, i) => i === idx ? { ...tier, [field]: val } : tier));
  };

  const handleTierFeatures = (idx, text) => {
    const list = text.split('\n');
    handleTierChange(idx, 'features', list);
  };

  const addTier = () => {
    setPricingTiers(prev => [
      ...prev,
      { name: 'New Tier', price_cents: 1900, max_guests: 100, recommended: false, is_custom: false, features: [] }
    ]);
  };

  const removeTier = (idx) => {
    setPricingTiers(prev => prev.filter((_, i) => i !== idx));
  };

  // Manual payment method helpers
  const updateMethod = (idx, field, val) => {
    setManualMethods(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };

  const addMethod = () => {
    setManualMethods(prev => [
      ...prev,
      { label: 'New Method', type: 'bank', details: '', instructions: '', is_active: true }
    ]);
  };

  const removeMethod = (idx) => {
    setManualMethods(prev => prev.filter((_, i) => i !== idx));
  };

  // Landing page stat counter helpers
  const updateStat = (idx, field, val) => {
    setLandingStats(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const addStat = () => {
    setLandingStats(prev => [...prev, { label: 'New Stat', target: 0, suffix: '+', decimals: 0 }]);
  };

  const removeStat = (idx) => {
    setLandingStats(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <p style={{ color: T.text500 }}>Loading configuration…</p>;
  if (error) return <p style={{ color: T.danger }}>{error}</p>;

  return (
    <div style={{ maxWidth: 800 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>System Configuration</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>Configure platform tiers, SMS pricing rates, commission markup, and manual payment coordinates.</p>
      </header>

      <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Core Billing Variables */}
        <div style={{ ...card, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>Global Core Pricing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <Field label="SMS Base Rate (cents)">
              <input type="number" value={smsRate} onChange={e => setSmsRate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="SMS Markup (%)">
              <input type="number" step="0.1" value={smsMarkupPercentage} onChange={e => setSmsMarkupPercentage(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Platform Commission (%)">
              <input type="number" step="0.1" value={platformCommissionPct} onChange={e => setPlatformCommissionPct(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* Pricing Tiers list */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>License Tiers</h3>
            <Button variant="ghost" onClick={addTier}>+ Add Tier</Button>
          </div>
          <p style={{ fontSize: 11.5, color: T.text500, marginBottom: 18, lineHeight: 1.5 }}>Tiers represent active commercial plan specifications shown to organizers during event setup.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pricingTiers.length ? pricingTiers.map((tier, idx) => (
              <div key={idx} style={{ padding: 18, background: T.surfaceAlt, border: `1px solid ${tier.recommended ? T.primary : T.border}`, borderRadius: T.radiusSm }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
                  <Field label="Tier Name"><input value={tier.name} onChange={e => handleTierChange(idx, 'name', e.target.value)} style={inputStyle} /></Field>
                  <Field label={tier.is_custom ? 'Price (cents - Custom)' : 'Price (cents)'}><input type="number" value={tier.price_cents} disabled={tier.is_custom} onChange={e => handleTierChange(idx, 'price_cents', e.target.value)} style={{ ...inputStyle, opacity: tier.is_custom ? 0.5 : 1 }} /></Field>
                  <Field label="Max Guests (0 = unlimited)"><input type="number" value={tier.max_guests} onChange={e => handleTierChange(idx, 'max_guests', e.target.value)} style={inputStyle} /></Field>
                  <Button variant="danger" onClick={() => removeTier(idx)}>✕</Button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <Field label="Display Price Label (e.g. Custom)"><input value={tier.price_label || ''} onChange={e => handleTierChange(idx, 'price_label', e.target.value)} placeholder="auto from price" style={inputStyle} /></Field>
                  <Field label="CTA Button Label"><input value={tier.cta_label || ''} onChange={e => handleTierChange(idx, 'cta_label', e.target.value)} placeholder="Get Started" style={inputStyle} /></Field>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Field label="Description"><input value={tier.description || ''} onChange={e => handleTierChange(idx, 'description', e.target.value)} style={inputStyle} /></Field>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={tier.recommended === true} onChange={e => handleTierChange(idx, 'recommended', e.target.checked)} /> ⭐ Most Popular
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={tier.is_custom === true} onChange={e => handleTierChange(idx, 'is_custom', e.target.checked)} /> Contact Sales / Custom Price
                  </label>
                </div>

                <Field label="Features (one per line)">
                  <textarea
                    value={(tier.features || []).join('\n')}
                    onChange={e => handleTierFeatures(idx, e.target.value)}
                    rows={3}
                    placeholder="feature description line"
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </Field>
              </div>
            )) : <p style={{ fontSize: 12, color: T.text500, fontStyle: 'italic' }}>No tiers defined.</p>}
          </div>
        </div>

        {/* Manual Payment Methods */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Offline Payment Methods</h3>
            <Button variant="ghost" onClick={addMethod}>+ Add Method</Button>
          </div>
          <p style={{ fontSize: 11.5, color: T.text500, marginBottom: 18, lineHeight: 1.5 }}>These coordinates are rendered during checkout when organizers select Cash/Manual option.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {manualMethods.length ? manualMethods.map((m, idx) => (
              <div key={idx} style={{ padding: 18, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, opacity: m.is_active === false ? 0.6 : 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
                  <Field label="Label (e.g. Bank Transfer — CIB)"><input value={m.label} onChange={e => updateMethod(idx, 'label', e.target.value)} style={inputStyle} /></Field>
                  <Field label="Type">
                    <select value={m.type} onChange={e => updateMethod(idx, 'type', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      {['bank', 'wallet', 'instapay', 'cash', 'paypal', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Button variant="danger" onClick={() => removeMethod(idx)}>✕</Button>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <Field label="Account / Coordinate details"><input value={m.details} onChange={e => updateMethod(idx, 'details', e.target.value)} style={inputStyle} /></Field>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Field label="Instructions to Payer"><textarea value={m.instructions} onChange={e => updateMethod(idx, 'instructions', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={m.is_active !== false} onChange={e => updateMethod(idx, 'is_active', e.target.checked)} /> Active (visible to organizers)
                </label>
              </div>
            )) : <p style={{ fontSize: 12, color: T.text500, fontStyle: 'italic' }}>No offline methods defined.</p>}
          </div>
        </div>

        {/* Landing Page Stats */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Landing Page Stats</h3>
            <Button variant="ghost" onClick={addStat}>+ Add Stat</Button>
          </div>
          <p style={{ fontSize: 11.5, color: T.text500, marginBottom: 18, lineHeight: 1.5 }}>The animated counters shown in the social-proof bar on the public landing page (e.g. &ldquo;10,000+ Events Created&rdquo;).</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {landingStats.length ? landingStats.map((s, idx) => (
              <div key={idx} style={{ padding: 18, background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr auto', gap: 12, alignItems: 'end' }}>
                  <Field label="Label"><input value={s.label} onChange={e => updateStat(idx, 'label', e.target.value)} style={inputStyle} /></Field>
                  <Field label="Value"><input type="number" step="any" value={s.target} onChange={e => updateStat(idx, 'target', e.target.value)} style={inputStyle} /></Field>
                  <Field label="Suffix (e.g. + or %)"><input value={s.suffix} onChange={e => updateStat(idx, 'suffix', e.target.value)} style={inputStyle} /></Field>
                  <Field label="Decimal places"><input type="number" min="0" max="2" value={s.decimals} onChange={e => updateStat(idx, 'decimals', e.target.value)} style={inputStyle} /></Field>
                  <Button variant="danger" onClick={() => removeStat(idx)}>✕</Button>
                </div>
              </div>
            )) : <p style={{ fontSize: 12, color: T.text500, fontStyle: 'italic' }}>No stats defined.</p>}
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving Config…' : 'Save Configuration'}</Button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', width: '100%' }}>
      <span style={{ display: 'block', fontSize: 11, color: T.text500, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  fontSize: 13,
  background: T.surface,
  color: T.text900,
  outline: 'none',
  boxSizing: 'border-box',
};
