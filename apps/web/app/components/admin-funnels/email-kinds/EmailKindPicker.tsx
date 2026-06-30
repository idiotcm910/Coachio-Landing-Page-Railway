'use client';

/**
 * EmailKindPicker — modal gallery to pick one of 5 email kind templates + brand color.
 * Renders a simple iframe preview of buildEmail(selected, 'receipt', color).
 * On confirm → calls onApply({ kind, color }).
 *
 * Props:
 *   open          — controls visibility
 *   onClose       — ESC or backdrop click
 *   emailTypes    — list of { key, label } the workspace manages (for count display)
 *   onApply       — called with { kind: EmailKind, color: string }
 */

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { EMAIL_KINDS } from './email-kind-catalog';
import { buildEmail, DEFAULT_EMAIL_COLOR, resolveEmailColor } from './email-kind-types';
import type { EmailKind, EmailKindTemplate } from './email-kind-types';

// Brand color swatches
const COLOR_SWATCHES = [
  '#6d5efc', // Coachio violet (default)
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#059669', // Green
  '#1d4ed8', // Dark blue
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface EmailKindPickerProps {
  open: boolean;
  onClose: () => void;
  emailTypes: { key: string; label: string }[];
  onApply: (p: { kind: EmailKind; color: string }) => void | Promise<void>;
}

export function EmailKindPicker({ open, onClose, emailTypes, onApply }: EmailKindPickerProps) {
  const [selected, setSelected] = useState<EmailKindTemplate>(EMAIL_KINDS[0]);
  const [color, setColor] = useState(DEFAULT_EMAIL_COLOR);
  const [hexInput, setHexInput] = useState(DEFAULT_EMAIL_COLOR);
  const [isApplying, setIsApplying] = useState(false);
  // Which email type is shown in the preview (user can switch between all emails in the bundle).
  const [previewType, setPreviewType] = useState<string>('receipt');

  // Derive a valid active type so the preview never breaks when emailTypes change.
  const activeType = emailTypes.some((t) => t.key === previewType)
    ? previewType
    : emailTypes[0]?.key ?? 'receipt';
  const activeLabel = emailTypes.find((t) => t.key === activeType)?.label ?? 'Email';

  // Build preview HTML from selected kind + color for the active email type.
  const previewHtml = buildEmail(selected, activeType, resolveEmailColor(color)).html;

  // Sync hex input when swatch is clicked
  function handleSwatchClick(c: string) {
    setColor(c);
    setHexInput(c);
  }

  // Validate hex on input blur or enter
  function handleHexCommit(raw: string) {
    const trimmed = raw.trim();
    if (HEX_RE.test(trimmed)) {
      setColor(trimmed);
      setHexInput(trimmed);
    } else {
      // Revert to current valid color
      setHexInput(color);
    }
  }

  // ESC closes
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  async function handleApply() {
    setIsApplying(true);
    try {
      await onApply({ kind: selected.kind, color: resolveEmailColor(color) });
    } finally {
      setIsApplying(false);
    }
  }

  const validColor = resolveEmailColor(color);
  const emailCount = emailTypes.length;

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose an email template set"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div
        style={{
          background: 'var(--coachio-admin-dashboard-surface)',
          borderRadius: 'var(--coachio-admin-dashboard-radius-lg)',
          boxShadow: 'var(--coachio-admin-dashboard-shadow-lg, 0 20px 60px rgba(0,0,0,0.3))',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--coachio-admin-dashboard-border)',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--coachio-admin-dashboard-text)' }}>
              Choose an email template set
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--coachio-admin-dashboard-text-muted)' }}>
              Apply the shell + sample content to {emailCount} emails. You can still edit them afterwards.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--coachio-admin-dashboard-text-muted)',
              padding: '4px',
              borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Body: left (gallery + color) | right (preview) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left panel */}
          <div
            style={{
              width: '280px',
              flexShrink: 0,
              borderRight: '1px solid var(--coachio-admin-dashboard-border)',
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Kind gallery */}
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--coachio-admin-dashboard-text-soft)' }}>
              Product type
            </p>
            {EMAIL_KINDS.map((k) => {
              const isSelected = k.kind === selected.kind;
              return (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setSelected(k)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: 'var(--coachio-admin-dashboard-radius-md)',
                    border: isSelected
                      ? `2px solid ${validColor}`
                      : '2px solid var(--coachio-admin-dashboard-border)',
                    background: isSelected
                      ? 'var(--coachio-admin-dashboard-accent-soft)'
                      : 'var(--coachio-admin-dashboard-surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'border-color 0.15s, background 0.15s',
                    position: 'relative',
                  }}
                >
                  {/* Mini email mockup (no emoji) — accent header band tinted with
                      the chosen brand color, over two text lines. */}
                  <div
                    aria-hidden="true"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '7px',
                      overflow: 'hidden',
                      background: '#ffffff',
                      border: '1px solid var(--coachio-admin-dashboard-border)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ height: '11px', background: validColor }} />
                    <div style={{ padding: '5px 5px 0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ height: '3px', width: '80%', borderRadius: '2px', background: '#e2e5ea' }} />
                      <div style={{ height: '3px', width: '55%', borderRadius: '2px', background: '#e2e5ea' }} />
                      <div style={{ marginTop: '2px', height: '6px', width: '45%', borderRadius: '2px', background: validColor, opacity: 0.85 }} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--coachio-admin-dashboard-text)' }}>
                      {k.label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--coachio-admin-dashboard-text-muted)', lineHeight: '1.5' }}>
                      {k.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check
                      style={{
                        width: '14px',
                        height: '14px',
                        color: validColor,
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              );
            })}

            {/* Color picker */}
            <p style={{ margin: '8px 0 0', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--coachio-admin-dashboard-text-soft)' }}>
              Brand color
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Choose color ${c}`}
                  onClick={() => handleSwatchClick(c)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '3px solid var(--coachio-admin-dashboard-text)' : '2px solid var(--coachio-admin-dashboard-border)',
                    cursor: 'pointer',
                    transition: 'border 0.1s',
                    padding: 0,
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
                  background: validColor,
                  border: '1px solid var(--coachio-admin-dashboard-border)',
                  flexShrink: 0,
                }}
              />
              <input
                type="text"
                value={hexInput}
                aria-label="Hex color code"
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={(e) => handleHexCommit(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleHexCommit(hexInput); }}
                placeholder="#6d5efc"
                style={{
                  flex: 1,
                  height: '32px',
                  padding: '0 10px',
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

          {/* Right panel: iframe preview */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--coachio-admin-dashboard-surface-muted)',
            }}
          >
            <div
              style={{
                borderBottom: '1px solid var(--coachio-admin-dashboard-border)',
                background: 'var(--coachio-admin-dashboard-surface)',
              }}
            >
              <div style={{ padding: '8px 14px 6px', fontSize: '11px', color: 'var(--coachio-admin-dashboard-text-muted)' }}>
                Preview · <span style={{ color: 'var(--coachio-admin-dashboard-text)' }}>{activeLabel}</span>
              </div>
              {/* Email-type tabs — preview any email in the bundle */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 14px 10px' }}>
                {emailTypes.map((t) => {
                  const isActive = t.key === activeType;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setPreviewType(t.key)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '100px',
                        border: isActive
                          ? `1px solid ${validColor}`
                          : '1px solid var(--coachio-admin-dashboard-border)',
                        background: isActive ? validColor : 'var(--coachio-admin-dashboard-surface)',
                        color: isActive ? '#fff' : 'var(--coachio-admin-dashboard-text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              <iframe
                title="Email template preview"
                srcDoc={previewHtml}
                sandbox="allow-popups"
                style={{
                  width: '100%',
                  minHeight: '480px',
                  border: '1px solid var(--coachio-admin-dashboard-border)',
                  borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
                  background: '#fff',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--coachio-admin-dashboard-border)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--coachio-admin-dashboard-surface)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
              border: '1px solid var(--coachio-admin-dashboard-border)',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--coachio-admin-dashboard-text-muted)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            style={{
              height: '36px',
              padding: '0 20px',
              borderRadius: 'var(--coachio-admin-dashboard-radius-sm)',
              border: 'none',
              background: validColor,
              cursor: isApplying ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              opacity: isApplying ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isApplying ? 'Applying…' : `Apply to ${emailCount} emails`}
          </button>
        </div>
      </div>
    </div>
  );
}
