'use client';

/**
 * Two-step modal for picking and configuring a thank-you page template.
 * Step 1 (gallery): grid of 5 template cards.
 * Step 2 (config): primary color picker + kind-specific variable form + live preview.
 * On apply: passes raw (token) HTML + scaffold variables + optional zaloLink to parent.
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { THANK_YOU_TEMPLATES } from './thank-you-template-catalog';
import {
  buildScaffoldVariables,
  renderCatalogPreview,
  resolvePrimaryColor,
  DEFAULT_PRIMARY_COLOR,
} from './thank-you-template-types';
import type { ThankYouTemplate, ThankYouTemplateVar } from './thank-you-template-types';
import { SuccessPreview } from '../../shared/success/SuccessPreview';
import { DateTimeField } from '../../shared/variables/DateTimeField';
import { useConfirm } from '../../landing-shared/admin-confirm-modal';

// ---------------------------------------------------------------------------
// Swatches
// ---------------------------------------------------------------------------

const COLOR_SWATCHES = [
  '#6d5efc', // indigo (default)
  '#7c3aed', // violet
  '#0ea5e9', // sky
  '#16a34a', // green
  '#ea580c', // orange
  '#e11d48', // rose
  '#0f172a', // dark
  '#f59e0b', // amber
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThankYouTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  /** Whether the workspace already has custom HTML (triggers overwrite confirm). */
  currentHasHtml: boolean;
  onApply: (p: { html: string; variables: Record<string, string>; zaloLink?: string }) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = 'gallery' | 'config';

export function ThankYouTemplatePicker({ open, onClose, currentHasHtml, onApply }: ThankYouTemplatePickerProps) {
  const [step, setStep] = useState<Step>('gallery');
  const [selected, setSelected] = useState<ThankYouTemplate | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [colorInput, setColorInput] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [values, setValues] = useState<Record<string, string>>({});
  const [zaloLink, setZaloLink] = useState('');
  const [applying, setApplying] = useState(false);
  const { confirm, modal: confirmModal } = useConfirm();

  // A11y: Escape + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('gallery');
      setSelected(null);
      setColor(DEFAULT_PRIMARY_COLOR);
      setColorInput(DEFAULT_PRIMARY_COLOR);
      setValues({});
      setZaloLink('');
      setApplying(false);
    }
  }, [open]);

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Gallery step handlers
  // ---------------------------------------------------------------------------

  function handleSelectTemplate(tpl: ThankYouTemplate) {
    // Init values from sample
    const initValues: Record<string, string> = {};
    for (const v of tpl.defaultVars) {
      initValues[v.key] = v.sample;
    }
    setSelected(tpl);
    setValues(initValues);
    setZaloLink('');
    setStep('config');
  }

  // ---------------------------------------------------------------------------
  // Config step handlers
  // ---------------------------------------------------------------------------

  function handleColorSwatch(hex: string) {
    setColor(hex);
    setColorInput(hex);
  }

  function handleColorInput(raw: string) {
    setColorInput(raw);
    const resolved = resolvePrimaryColor(raw);
    if (resolved !== DEFAULT_PRIMARY_COLOR || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw.trim())) {
      setColor(raw.trim());
    }
    // If invalid, color stays at last valid; input shows what the user typed
  }

  function handleColorInputBlur() {
    const resolved = resolvePrimaryColor(colorInput);
    setColor(resolved);
    setColorInput(resolved);
  }

  function handleVarChange(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleApply() {
    if (!selected) return;
    if (currentHasHtml) {
      const ok = await confirm({
        title: 'Replace thank-you page?',
        message:
          'The current thank-you page already has custom HTML. Applying this template will overwrite it.',
        confirmLabel: 'Apply template',
        cancelLabel: 'Cancel',
        variant: 'danger',
      });
      if (!ok) return;
    }
    setApplying(true);
    try {
      const resolvedColor = resolvePrimaryColor(colorInput);
      const allValues = { primary_color: resolvedColor, ...values };
      const variables = buildScaffoldVariables(selected, allValues);
      await onApply({
        html: selected.html, // raw tokens — NOT rendered
        variables,
        zaloLink: zaloLink.trim() || undefined,
      });
      onClose();
    } finally {
      setApplying(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Preview HTML (rendered for display only)
  // ---------------------------------------------------------------------------

  const resolvedColor = resolvePrimaryColor(colorInput);
  const previewHtml = selected
    ? renderCatalogPreview(selected.html, {
        primary_color: resolvedColor,
        zalo_link: zaloLink || 'https://zalo.me/example',
        ...values,
      })
    : '';

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  // Abstract page-mockup thumbnail rendered with the template's accent color.
  // Reads as a real "thank-you page preview" — far more professional than an emoji.
  const renderThumbnail = (accent: string) => (
    <div
      aria-hidden="true"
      style={{
        height: '104px',
        background: 'var(--coachio-admin-dashboard-surface-muted)',
        display: 'grid',
        placeItems: 'center',
        padding: '14px',
        borderBottom: '1px solid var(--coachio-admin-dashboard-border)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '150px',
          background: '#ffffff',
          borderRadius: '8px',
          padding: '12px 14px 14px',
          boxShadow: '0 1px 4px rgba(15,23,42,0.10)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {/* success badge */}
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: accent }} />
        {/* title bar */}
        <div style={{ width: '64%', height: '7px', borderRadius: '4px', background: '#1f2430' }} />
        {/* text lines */}
        <div style={{ width: '84%', height: '4px', borderRadius: '3px', background: '#e2e5ea' }} />
        <div style={{ width: '70%', height: '4px', borderRadius: '3px', background: '#e2e5ea' }} />
        {/* CTA */}
        <div style={{ marginTop: '4px', width: '58%', height: '13px', borderRadius: '6px', background: accent }} />
      </div>
    </div>
  );

  const renderVarInput = (v: ThankYouTemplateVar) => {
    // Date/time/datetime → polished shared DateTimeField (react-datepicker).
    // Canonical raw values match what we store in `variables`:
    // date `YYYY-MM-DD`, time `HH:mm`, datetime `YYYY-MM-DDTHH:mm`.
    if (v.type === 'date' || v.type === 'time' || v.type === 'datetime') {
      return (
        <DateTimeField
          kind={v.type}
          value={values[v.key] ?? ''}
          onChange={(val) => handleVarChange(v.key, val)}
        />
      );
    }

    // Everything else (text/number/color/…) → native input.
    return (
      <input
        id={`tpl-var-${v.key}`}
        type={v.type === 'color' ? 'text' : v.type}
        value={values[v.key] ?? ''}
        onChange={(e) => handleVarChange(v.key, e.target.value)}
        placeholder={v.placeholder ?? ''}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
          border: '1px solid var(--coachio-admin-dashboard-border)',
          background: 'var(--coachio-admin-dashboard-surface-muted)',
          color: 'var(--coachio-admin-dashboard-text)',
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Styles (inline — consistent with VariablesModal pattern: no SCSS module)
  // ---------------------------------------------------------------------------

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  };

  const backdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
  };

  const dialogStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: step === 'config' ? '960px' : '760px',
    maxHeight: '90vh',
    borderRadius: 'var(--coachio-admin-dashboard-radius-lg)',
    background: 'var(--coachio-admin-dashboard-surface)',
    boxShadow: 'var(--coachio-admin-dashboard-shadow-modal)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--coachio-admin-dashboard-border)',
    flexShrink: 0,
  };

  const btnIconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    flexShrink: 0,
    borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
    border: '1px solid var(--coachio-admin-dashboard-border)',
    background: 'transparent',
    color: 'var(--coachio-admin-dashboard-text-muted)',
    cursor: 'pointer',
  };

  const bodyStyle: React.CSSProperties = {
    overflow: 'auto',
    flex: 1,
    padding: '20px',
  };

  // ---------------------------------------------------------------------------
  // Gallery
  // ---------------------------------------------------------------------------

  const renderGallery = () => (
    <>
      <div style={headerStyle}>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--coachio-admin-dashboard-text)', margin: 0 }}>
            Choose a thank-you template
          </p>
          <p style={{ fontSize: '12px', color: 'var(--coachio-admin-dashboard-text-muted)', margin: '2px 0 0' }}>
            5 templates by product type — pick one to get started quickly.
          </p>
        </div>
        <button type="button" style={btnIconStyle} onClick={onClose} title="Close">
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <div style={bodyStyle}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {THANK_YOU_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelectTemplate(tpl)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                background: 'var(--coachio-admin-dashboard-surface)',
                border: '1px solid var(--coachio-admin-dashboard-border)',
                borderRadius: 'var(--coachio-admin-dashboard-radius-lg)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--coachio-admin-dashboard-accent)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--coachio-admin-dashboard-shadow-sm)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--coachio-admin-dashboard-border)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {/* Mini page-mockup thumbnail (no emoji) — abstract wireframe of the
                  thank-you page tinted with the template's accent color. */}
              {renderThumbnail(tpl.thumbnailGradient[0])}

              {/* Card body */}
              <div style={{ padding: '12px', flex: 1 }}>
                <p
                  style={{
                    margin: '0 0 4px',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: 'var(--coachio-admin-dashboard-text)',
                  }}
                >
                  {tpl.label}
                </p>
                <p
                  style={{
                    margin: '0 0 10px',
                    fontSize: '12px',
                    color: 'var(--coachio-admin-dashboard-text-muted)',
                    lineHeight: 1.4,
                  }}
                >
                  {tpl.description}
                </p>
                {/* Var chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {tpl.defaultVars.slice(0, 4).map((v) => (
                    <span
                      key={v.key}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: 'var(--coachio-admin-dashboard-surface-muted)',
                        border: '1px solid var(--coachio-admin-dashboard-border)',
                        fontSize: '10px',
                        color: 'var(--coachio-admin-dashboard-text-muted)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {`{{${v.key}}}`}
                    </span>
                  ))}
                  {tpl.defaultVars.length > 4 && (
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: 'var(--coachio-admin-dashboard-surface-muted)',
                        border: '1px solid var(--coachio-admin-dashboard-border)',
                        fontSize: '10px',
                        color: 'var(--coachio-admin-dashboard-text-muted)',
                      }}
                    >
                      +{tpl.defaultVars.length - 4}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  const renderConfig = () => {
    if (!selected) return null;
    return (
      <>
        <div style={headerStyle}>
          <button type="button" style={btnIconStyle} onClick={() => setStep('gallery')} title="Back">
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--coachio-admin-dashboard-text)', margin: 0 }}>
              {selected.label}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--coachio-admin-dashboard-text-muted)', margin: '2px 0 0' }}>
              Customize the color and details — preview on the right.
            </p>
          </div>
          <button type="button" style={btnIconStyle} onClick={onClose} title="Close">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left: config form */}
          <div
            style={{
              width: '340px',
              flexShrink: 0,
              overflowY: 'auto',
              padding: '20px',
              borderRight: '1px solid var(--coachio-admin-dashboard-border)',
            }}
          >
            {/* Color picker */}
            <div style={{ marginBottom: '20px' }}>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--coachio-admin-dashboard-text-soft)',
                  margin: '0 0 8px',
                }}
              >
                Primary color
              </p>
              {/* Swatches */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => handleColorSwatch(hex)}
                    title={hex}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: hex,
                      border: color === hex ? '2px solid var(--coachio-admin-dashboard-accent)' : '2px solid transparent',
                      outline: color === hex ? '2px solid var(--coachio-admin-dashboard-accent)' : '2px solid transparent',
                      outlineOffset: '2px',
                      cursor: 'pointer',
                      transition: 'outline 0.1s',
                    }}
                  />
                ))}
              </div>
              {/* Hex input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: resolvedColor,
                    border: '1px solid var(--coachio-admin-dashboard-border)',
                    flexShrink: 0,
                  }}
                />
                <input
                  type="text"
                  value={colorInput}
                  onChange={(e) => handleColorInput(e.target.value)}
                  onBlur={handleColorInputBlur}
                  placeholder="#6d5efc"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
                    border: '1px solid var(--coachio-admin-dashboard-border)',
                    background: 'var(--coachio-admin-dashboard-surface-muted)',
                    color: 'var(--coachio-admin-dashboard-text)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Kind-specific vars */}
            {selected.defaultVars.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--coachio-admin-dashboard-text-soft)',
                    margin: '0 0 12px',
                  }}
                >
                  Template details
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selected.defaultVars.map((v) => (
                    <label key={v.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--coachio-admin-dashboard-text-soft)',
                        }}
                      >
                        {v.name}
                      </span>
                      {renderVarInput(v)}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Zalo link (if template supports it) */}
            {selected.zaloLink && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--coachio-admin-dashboard-text-soft)',
                    }}
                  >
                    Zalo link (optional)
                  </span>
                  <input
                    type="url"
                    value={zaloLink}
                    onChange={(e) => setZaloLink(e.target.value)}
                    placeholder="https://zalo.me/..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
                      border: '1px solid var(--coachio-admin-dashboard-border)',
                      background: 'var(--coachio-admin-dashboard-surface-muted)',
                      color: 'var(--coachio-admin-dashboard-text)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--coachio-admin-dashboard-text-muted)',
                    }}
                  >
                    Shows a "Join via Zalo" button on the thank-you page.
                  </span>
                </label>
              </div>
            )}

            {/* Apply button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              style={{
                width: '100%',
                height: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
                background: 'var(--coachio-admin-dashboard-accent)',
                color: 'var(--coachio-admin-dashboard-text-inverse)',
                fontWeight: 700,
                fontSize: '14px',
                border: 'none',
                cursor: applying ? 'not-allowed' : 'pointer',
                opacity: applying ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {applying ? 'Applying…' : 'Apply template'}
            </button>
          </div>

          {/* Right: live preview */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--coachio-admin-dashboard-surface-muted)' }}>
            <SuccessPreview html={previewHtml} zaloLink={zaloLink} frameId="tpl-picker-preview" />
          </div>
        </div>
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div role="dialog" aria-modal="true" aria-label="Choose a thank-you template" style={overlayStyle}>
      <div style={backdropStyle} onClick={onClose} aria-hidden="true" />
      <div style={dialogStyle}>
        {step === 'gallery' ? renderGallery() : renderConfig()}
      </div>
      {confirmModal}
    </div>
  );
}
