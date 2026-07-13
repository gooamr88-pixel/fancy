'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../_lib/adminApi';
import { T, card } from '../../_components/theme';
import { Button } from '../../_components/Modal';
import { useAlert } from '../../_components/AlertContext';
import { Field } from '../../_components/Field';
import { PageLoading } from '../../_components/Spinner';
import { ErrorState } from '../../_components/ErrorState';
import Icon from '../../../components/icons/Icon';

// ── Toggle Switch component ──
function Toggle({ checked, onChange, disabled }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', padding: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: checked ? T.primary : T.border,
        display: 'flex', alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: 'background 0.2s ease',
      }}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </motion.button>
  );
}

// ── Feature Selector for a single tier ──
function FeatureSelector({ tierFeatures, registry, onChange }) {
  const [expandedCats, setExpandedCats] = useState({});
  const featureSet = useMemo(() => new Set(tierFeatures || []), [tierFeatures]);
  const totalCount = featureSet.size;

  const toggleFeature = useCallback((key) => {
    const updated = featureSet.has(key)
      ? [...featureSet].filter(k => k !== key)
      : [...featureSet, key];
    onChange(updated);
  }, [featureSet, onChange]);

  const toggleCategory = (cat) => {
    setExpandedCats(prev => ({ ...prev, [cat]: prev[cat] === false ? true : false }));
  };

  if (!registry) {
    return <p style={{ fontSize: 12, color: T.text500, fontStyle: 'italic' }}>Loading feature registry...</p>;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Plan Features</h4>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 24, height: 20, padding: '0 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
          background: totalCount > 0 ? T.primarySoft : 'transparent',
          color: totalCount > 0 ? T.primary : T.text400,
          border: totalCount > 0 ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
        }}>
          {totalCount} selected
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {registry.categories.map(cat => {
          const catFeatures = registry.features[cat] || [];
          const catSelected = catFeatures.filter(f => featureSet.has(f.key)).length;
          const isExpanded = expandedCats[cat] !== false; // default open

          return (
            <div key={cat} style={{
              border: `1px solid ${catSelected > 0 ? T.primary + '40' : T.border}`,
              borderRadius: T.radiusSm,
              background: catSelected > 0 ? T.primarySoft : T.surface,
              transition: 'all 0.2s ease',
            }}>
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: catSelected > 0 ? T.text900 : T.text700, fontSize: 12, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderLeft: `3px solid ${catSelected > 0 ? T.primary : 'transparent'}`,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: 8 }}>▶</span>
                  {cat}
                </span>
                {catSelected > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, opacity: 0.8 }}>
                    {catSelected}/{catFeatures.length} selected
                  </span>
                )}
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '4px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {catFeatures.map(feat => (
                        <div key={feat.key} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
                          borderRadius: 8,
                          background: featureSet.has(feat.key) ? 'rgba(184, 148, 79, 0.05)' : 'rgba(0,0,0,0.01)',
                          border: `1px solid ${featureSet.has(feat.key) ? 'rgba(184, 148, 79, 0.15)' : 'transparent'}`,
                          transition: 'all 0.15s',
                          opacity: feat.builtIn === false ? 0.6 : 1,
                        }}>
                          <Toggle
                            checked={featureSet.has(feat.key)}
                            onChange={() => toggleFeature(feat.key)}
                            disabled={feat.builtIn === false}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text900, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {feat.label}
                              {feat.freeDefault && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: T.successSoft, color: T.success, textTransform: 'uppercase' }}>Free</span>
                              )}
                              {feat.builtIn === false && (
                                <span title="This capability isn't built yet — toggling it here has no effect on access." style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: T.warningSoft, color: T.warning, textTransform: 'uppercase' }}>Not built yet</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: T.text500, marginTop: 1, lineHeight: 1.3 }}>{feat.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function ConfigPage() {
  const { showAlert, showConfirm } = useAlert();
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
  const [featureRegistry, setFeatureRegistry] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('pricing'); // 'pricing' | 'tiers' | 'payments' | 'stats'
  const [selectedTierIdx, setSelectedTierIdx] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    // Re-arm the loading spinner for a manual retry, not just the initial mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const [pricingRes, registryRes] = await Promise.all([
          adminApi.get('/pricing'),
          adminApi.get('/feature-registry').catch(() => null),
        ]);
        if (pricingRes.config) {
          setSmsRate(pricingRes.config.sms_rate_cents_per_credit ?? 8);
          setSmsMarkupPercentage(pricingRes.config.sms_markup_percentage ?? 40.0);
          setPlatformCommissionPct(pricingRes.config.platform_commission_pct ?? 0.0);
          setPricingTiers(pricingRes.config.pricing_tiers || []);
          setManualMethods(pricingRes.config.manual_payment_methods || []);
          setLandingStats(pricingRes.config.landing_stats || []);
        }
        if (registryRes) setFeatureRegistry(registryRes);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    })();
  }, [retryTick]);

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

  const addTier = (e) => {
    e?.preventDefault?.();
    const newTier = { name: 'New Tier', price_cents: 1900, max_guests: 100, max_events: 0, remove_watermark: false, recommended: false, is_custom: false, features: [] };
    setPricingTiers(prev => [...prev, newTier]);
    setSelectedTierIdx(pricingTiers.length);
  };

  const removeTier = async (idx) => {
    if (pricingTiers.length <= 1) return;
    const tier = pricingTiers[idx];
    const ok = await showConfirm(
      `Delete the "${tier?.name || 'this'}" tier? This takes effect once you save, and any event already on this tier keeps its previously-granted limits but the tier itself will no longer exist to select or reference.`,
      'Delete Pricing Tier',
      'danger'
    );
    if (!ok) return;
    setPricingTiers(prev => prev.filter((_, i) => i !== idx));
    setSelectedTierIdx(prev => Math.max(0, prev - 1));
  };

  // Manual payment method helpers
  const updateMethod = (idx, field, val) => {
    setManualMethods(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };

  const addMethod = (e) => {
    e?.preventDefault?.();
    setManualMethods(prev => [
      ...prev,
      { label: 'New Method', type: 'bank', details: '', instructions: '', is_active: true }
    ]);
  };

  const removeMethod = async (idx) => {
    const m = manualMethods[idx];
    const ok = await showConfirm(
      `Remove the "${m?.label || 'this'}" payment method? Organizers will no longer see it as an option at checkout once you save.`,
      'Remove Payment Method',
      'warning'
    );
    if (!ok) return;
    setManualMethods(prev => prev.filter((_, i) => i !== idx));
  };

  // Landing page stat counter helpers
  const updateStat = (idx, field, val) => {
    setLandingStats(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const addStat = (e) => {
    e?.preventDefault?.();
    setLandingStats(prev => [...prev, { label: 'New Stat', target: 0, suffix: '+', decimals: 0 }]);
  };

  const removeStat = async (idx) => {
    const s = landingStats[idx];
    const ok = await showConfirm(
      `Remove the "${s?.label || 'this'}" stat counter from the landing page once you save?`,
      'Remove Stat Counter',
      'warning'
    );
    if (!ok) return;
    setLandingStats(prev => prev.filter((_, i) => i !== idx));
  };

  const tabStyle = (tab) => ({
    padding: '12px 18px',
    background: activeTab === tab ? T.surface : 'transparent',
    border: 'none',
    borderBottom: activeTab === tab ? `2px solid ${T.primary}` : '2px solid transparent',
    color: activeTab === tab ? T.text900 : T.text500,
    fontSize: 13,
    fontWeight: activeTab === tab ? 700 : 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s ease',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  });

  if (loading) return <PageLoading label="Loading configuration…" />;
  if (error) return <ErrorState message={error} onRetry={() => setRetryTick((t) => t + 1)} />;

  const currentTier = pricingTiers[selectedTierIdx];

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', paddingBottom: 60 }}>
      {/* Premium Elegant Header */}
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>System Configuration</h1>
        <p style={{ fontSize: 13.5, color: T.text500, margin: '6px 0 0', lineHeight: 1.5 }}>
          Configure global platform pricing rules, manage license tiers, activate offline payment coordinators, and edit social-proof statistics.
        </p>
      </header>

      {/* Tabs Shell */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 24, gap: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button type="button" onClick={() => setActiveTab('pricing')} style={tabStyle('pricing')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="2" y1="12" x2="22" y2="12" /></svg>
          Global Pricing
        </button>
        <button type="button" onClick={() => setActiveTab('tiers')} style={tabStyle('tiers')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          Subscription Tiers
        </button>
        <button type="button" onClick={() => setActiveTab('payments')} style={tabStyle('payments')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          Offline Payments
        </button>
        <button type="button" onClick={() => setActiveTab('stats')} style={tabStyle('stats')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
          Landing Stats
        </button>
      </div>

      <form onSubmit={handleSaveConfig}>
        <div style={{ minHeight: 400, marginBottom: 28 }}>
          <AnimatePresence mode="wait">
            {/* TAB 1: Global Pricing */}
            {activeTab === 'pricing' && (
              <motion.div
                key="pricing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ ...card, padding: 28 }}
              >
                <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 12, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Global Core Pricing Variables</h3>
                  <p style={{ fontSize: 12, color: T.text500, margin: '4px 0 0' }}>Configure default rates and platform-wide commission structures.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                  <Field label="SMS Base Rate (cents)">
                    <input type="number" value={smsRate} onChange={e => setSmsRate(e.target.value)} style={inputStyle} />
                    <span style={{ fontSize: 11, color: T.text400, marginTop: 4, display: 'block' }}>Base cost in cents per outgoing SMS message.</span>
                  </Field>
                  <Field label="SMS Markup (%)">
                    <input type="number" step="0.1" value={smsMarkupPercentage} onChange={e => setSmsMarkupPercentage(e.target.value)} style={inputStyle} />
                    <span style={{ fontSize: 11, color: T.text400, marginTop: 4, display: 'block' }}>Percent markup added to customer sms campaigns.</span>
                  </Field>
                  <Field label="Platform Commission (%)">
                    <input type="number" step="0.1" value={platformCommissionPct} onChange={e => setPlatformCommissionPct(e.target.value)} style={inputStyle} />
                    <span style={{ fontSize: 11, color: T.text400, marginTop: 4, display: 'block' }}>Fee rate percentage taken from ticketing/sales.</span>
                  </Field>
                </div>
              </motion.div>
            )}

            {/* TAB 2: Subscription Tiers */}
            {activeTab === 'tiers' && (
              <motion.div
                key="tiers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="cfg-responsive-grid"
                style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}
              >
                {/* Tiers Sidebar List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: T.text400, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 6px' }}>Tiers List</h4>
                  {pricingTiers.map((tier, idx) => (
                    <button
                      key={tier.name + idx}
                      type="button"
                      onClick={() => setSelectedTierIdx(idx)}
                      style={{
                        padding: '12px 14px',
                        background: selectedTierIdx === idx ? T.primarySoft : T.surface,
                        border: `1px solid ${selectedTierIdx === idx ? T.primary : T.border}`,
                        borderRadius: T.radiusSm,
                        color: selectedTierIdx === idx ? T.primary : T.text700,
                        fontSize: 12.5,
                        fontWeight: 700,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>{tier.name}</span>
                      {tier.recommended && <Icon name="star" size={11} strokeWidth={1.7} />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addTier}
                    style={{
                      padding: '10px 14px',
                      background: 'transparent',
                      border: `1px dashed ${T.border}`,
                      borderRadius: T.radiusSm,
                      color: T.primary,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginTop: 8,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = T.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                  >
                    + Add New Tier
                  </button>
                </div>

                {/* Selected Tier Configuration Card */}
                {currentTier ? (
                  <div className="cfg-tier-card" style={{ ...card, padding: 28, minWidth: 0 }}>
                    <div className="cfg-tier-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, paddingBottom: 14, marginBottom: 20 }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text900, margin: 0 }}>Configure Tier: {currentTier.name}</h3>
                        <p style={{ fontSize: 12, color: T.text500, margin: '2px 0 0' }}>Plan limits, core parameters, pricing labels, and gated features registry.</p>
                      </div>
                      <Button type="button" variant="danger" disabled={pricingTiers.length <= 1} onClick={() => removeTier(selectedTierIdx)}>Delete Tier</Button>
                    </div>

                    <div className="cfg-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <Field label="Tier Name">
                        <input value={currentTier.name} onChange={e => handleTierChange(selectedTierIdx, 'name', e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label={currentTier.is_custom ? 'Price (cents - Custom)' : 'Price (cents)'}>
                        <input type="number" value={currentTier.price_cents} disabled={currentTier.is_custom} onChange={e => handleTierChange(selectedTierIdx, 'price_cents', e.target.value)} style={{ ...inputStyle, opacity: currentTier.is_custom ? 0.5 : 1 }} />
                      </Field>
                      <Field label="Max Guests (0 = unlimited)">
                        <input type="number" value={currentTier.max_guests} onChange={e => handleTierChange(selectedTierIdx, 'max_guests', e.target.value)} style={inputStyle} />
                      </Field>
                    </div>

                    <div className="cfg-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <Field label="Display Price Label (e.g. Custom)">
                        <input value={currentTier.price_label || ''} onChange={e => handleTierChange(selectedTierIdx, 'price_label', e.target.value)} placeholder="auto from price" style={inputStyle} />
                      </Field>
                      <Field label="CTA Button Label">
                        <input value={currentTier.cta_label || ''} onChange={e => handleTierChange(selectedTierIdx, 'cta_label', e.target.value)} placeholder="Get Started" style={inputStyle} />
                      </Field>
                    </div>

                    <div className="cfg-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 18 }}>
                      <Field label="Description">
                        <input value={currentTier.description || ''} onChange={e => handleTierChange(selectedTierIdx, 'description', e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Max Events (0 = unlimited)">
                        <input type="number" min="0" value={currentTier.max_events ?? ''} onChange={e => handleTierChange(selectedTierIdx, 'max_events', e.target.value)} placeholder="unlimited" style={inputStyle} />
                      </Field>
                    </div>

                    {/* Checkbox settings */}
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap', padding: '12px 16px', background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer', fontWeight: 600 }}>
                        <input type="checkbox" checked={currentTier.recommended === true} onChange={e => handleTierChange(selectedTierIdx, 'recommended', e.target.checked)} />
                        <Icon name="star" size={13} strokeWidth={1.6} /> Most Popular
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer', fontWeight: 600 }}>
                        <input type="checkbox" checked={currentTier.is_custom === true} onChange={e => handleTierChange(selectedTierIdx, 'is_custom', e.target.checked)} />
                        <Icon name="creditCard" size={13} strokeWidth={1.6} /> Contact Sales / Custom Price
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer', fontWeight: 600 }}>
                        <input type="checkbox" checked={currentTier.remove_watermark === true} onChange={e => handleTierChange(selectedTierIdx, 'remove_watermark', e.target.checked)} />
                        <Icon name="ban" size={13} strokeWidth={1.6} /> Remove Watermark
                      </label>
                    </div>

                    {/* Features checklist dropdowns */}
                    <FeatureSelector
                      tierFeatures={currentTier.features}
                      registry={featureRegistry}
                      onChange={(features) => handleTierChange(selectedTierIdx, 'features', features)}
                    />
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: T.text500, fontStyle: 'italic' }}>No tiers configured.</p>
                )}
              </motion.div>
            )}

            {/* TAB 3: Offline Payment Methods */}
            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ ...card, padding: 28 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, paddingBottom: 12, marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Offline Payment Methods</h3>
                    <p style={{ fontSize: 12, color: T.text500, margin: '4px 0 0' }}>These methods are displayed to organizers who choose the cash/manual payout options at checkout.</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={addMethod}>+ Add Method</Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <AnimatePresence mode="popLayout">
                    {manualMethods.length ? manualMethods.map((m, idx) => (
                      <motion.div
                        key={idx}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        style={{
                          padding: 20,
                          background: T.surfaceAlt,
                          border: `1px solid ${T.border}`,
                          borderRadius: T.radiusSm,
                          opacity: m.is_active === false ? 0.6 : 1,
                        }}
                      >
                        <div className="cfg-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
                          <Field label="Label (e.g. Bank Transfer — CIB)">
                            <input value={m.label} onChange={e => updateMethod(idx, 'label', e.target.value)} style={inputStyle} />
                          </Field>
                          <Field label="Type">
                            <select value={m.type} onChange={e => updateMethod(idx, 'type', e.target.value)}
                              style={{ ...inputStyle, cursor: 'pointer' }}>
                              {['bank', 'wallet', 'instapay', 'cash', 'paypal', 'other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                            </select>
                          </Field>
                          <Button type="button" variant="danger" onClick={() => removeMethod(idx)}>✕</Button>
                        </div>
                        
                        <div style={{ marginBottom: 12 }}>
                          <Field label="Account / Coordinate details">
                            <input value={m.details} onChange={e => updateMethod(idx, 'details', e.target.value)} style={inputStyle} />
                          </Field>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <Field label="Instructions to Payer">
                            <textarea value={m.instructions} onChange={e => updateMethod(idx, 'instructions', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                          </Field>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text700, cursor: 'pointer', fontWeight: 600 }}>
                          <input type="checkbox" checked={m.is_active !== false} onChange={e => updateMethod(idx, 'is_active', e.target.checked)} />
                          Active (visible to organizers during checkout)
                        </label>
                      </motion.div>
                    )) : (
                      <p style={{ fontSize: 13, color: T.text500, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No offline payment methods configured. Click Add Method to create one.</p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* TAB 4: Landing Page Stats */}
            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ ...card, padding: 28 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.border}`, paddingBottom: 12, marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text900, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Landing Page Social-Proof Statistics</h3>
                    <p style={{ fontSize: 12, color: T.text500, margin: '4px 0 0' }}>Configure the animated counter stats displayed on the public landing page.</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={addStat}>+ Add Stat</Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <AnimatePresence mode="popLayout">
                    {landingStats.length ? landingStats.map((s, idx) => (
                      <motion.div
                        key={idx}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        style={{
                          padding: 18,
                          background: T.surfaceAlt,
                          border: `1px solid ${T.border}`,
                          borderRadius: T.radiusSm,
                        }}
                      >
                        <div className="cfg-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.7fr 0.7fr auto', gap: 12, alignItems: 'end' }}>
                          <Field label="Label">
                            <input value={s.label} onChange={e => updateStat(idx, 'label', e.target.value)} style={inputStyle} />
                          </Field>
                          <Field label="Value">
                            <input type="number" step="any" value={s.target} onChange={e => updateStat(idx, 'target', e.target.value)} style={inputStyle} />
                          </Field>
                          <Field label="Suffix (e.g. + or %)">
                            <input value={s.suffix} onChange={e => updateStat(idx, 'suffix', e.target.value)} style={inputStyle} />
                          </Field>
                          <Field label="Decimal places">
                            <input type="number" min="0" max="2" value={s.decimals} onChange={e => updateStat(idx, 'decimals', e.target.value)} style={inputStyle} />
                          </Field>
                          <Button type="button" variant="danger" onClick={() => removeStat(idx)}>✕</Button>
                        </div>
                      </motion.div>
                    )) : (
                      <p style={{ fontSize: 13, color: T.text500, fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>No stat counters configured. Click Add Stat to create one.</p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Save Controls Container */}
        <div style={{
          position: 'sticky',
          // MOB-9: matches the site's established bottom-safe-area convention
          // (globals.css .floating-cta/.guest-sticky-footer) so this sticky
          // bar doesn't sit flush against the iOS home-indicator.
          bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 12px))',
          background: 'var(--admin-surface, #FFFFFF)',
          border: `1px solid var(--admin-border, #E8E2D6)`,
          borderRadius: '16px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)',
          padding: '14px 24px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 40,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text-900, #191B1E)', fontFamily: 'var(--font-sans)' }}>
              System Configuration
            </span>
            <span style={{ fontSize: 11, color: 'var(--admin-text-500, #77736A)', fontFamily: 'var(--font-sans)' }}>
              Click save to apply modifications platform-wide.
            </span>
          </div>
          <Button type="submit" variant="primary" disabled={saving} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, borderRadius: '8px' }}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>

        {/* `global` is load-bearing, not cosmetic: the OUTER tiers grid
            (200px list + 1fr editor) lives on a <motion.div>, and styled-jsx does
            not reliably stamp its scoping class onto custom components — only onto
            plain DOM elements. Scoped, the rule silently missed that one grid, so
            the tiers editor kept its 200px sidebar on a phone and the actual
            editing column collapsed to ~120px. A global rule applies regardless of
            element type; the cfg- prefix keeps it from colliding with anything. */}
        <style jsx global>{`
          /* MOB-9: every fixed multi-column field grid on this page (tiers
             split, tier fields, offline-payment rows, landing-stat rows —
             the last one 5 columns wide) had no breakpoint at all, making the
             pricing/tiers editor genuinely unusable below ~600px. */
          @media (max-width: 640px) {
            .cfg-responsive-grid { grid-template-columns: 1fr !important; }
            /* Title + "Delete Tier" was a no-wrap space-between row. */
            .cfg-tier-head { flex-wrap: wrap; gap: 12px; }
            .cfg-tier-card { padding: 18px !important; }
          }
        `}</style>
      </form>
    </div>
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
  transition: 'border-color 0.2s',
};
