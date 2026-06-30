'use client';

import { useState } from 'react';
import { Check, ChevronDown, Clipboard, Copy, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../toast';
import type { VariableRow } from './VariablesModal';
import { VariableFormModal } from './VariableFormModal';
import { formatRawForDisplay } from './DateTimeField';
import type { VariableMeta, VariableType } from '@coachio/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemVariable {
  key: string;
  description?: string;
}

interface AdminVariablesWorkspaceProps {
  initialVariables: Record<string, string> | null | undefined;
  initialVariablesMeta?: Record<string, VariableMeta> | null;
  reservedKeys: string[];
  systemVariables: SystemVariable[];
  ctaAttributes?: VariableRow[];
  onSave: (vars: Record<string, string>, meta: Record<string, VariableMeta>) => Promise<void>;
}

// ─── Type pill ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<VariableType, string> = {
  text: 'text-[#475569]',
  number: 'text-[#0e7490]',
  date: 'text-[#b45309]',
  time: 'text-[#7c3aed]',
  datetime: 'text-[#be185d]',
};

function TypePill({ type }: { type: VariableType }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-2 py-0.5 text-[11px] font-semibold ${TYPE_COLORS[type]}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {type}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminVariablesWorkspace({
  initialVariables,
  initialVariablesMeta,
  reservedKeys,
  systemVariables,
  ctaAttributes,
  onSave,
}: AdminVariablesWorkspaceProps) {
  const [variables, setVariables] = useState<Record<string, string>>({ ...(initialVariables ?? {}) });
  const [variablesMeta, setVariablesMeta] = useState<Record<string, VariableMeta>>({ ...(initialVariablesMeta ?? {}) });
  // System variables collapsed by default — admins expand only when they need the reference.
  const [systemOpen, setSystemOpen] = useState(false);

  // Modal state: null = closed, '__add__' = add mode, key string = edit mode
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copiedCta, setCopiedCta] = useState<string | null>(null);

  const { success, error: toastError } = useToast();

  function copyToken(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`).catch(() => {/* clipboard unavailable */});
    setCopied(key);
    setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 2000);
  }

  /** Persist variables + meta together; update local state on success. */
  async function persist(
    nextVars: Record<string, string>,
    nextMeta: Record<string, VariableMeta>,
    okMsg: string,
  ): Promise<boolean> {
    try {
      await onSave(nextVars, nextMeta);
      setVariables({ ...nextVars });
      setVariablesMeta({ ...nextMeta });
      success(okMsg);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save variable';
      toastError(msg);
      return false;
    }
  }

  async function handleModalSave(key: string, rawValue: string, meta: VariableMeta) {
    const isEdit = modalKey !== '__add__';
    setBusyKey(key);
    const nextVars = { ...variables, [key]: rawValue };
    const nextMeta = { ...variablesMeta, [key]: meta };
    const ok = await persist(nextVars, nextMeta, isEdit ? 'Variable saved' : 'Variable added');
    setBusyKey(null);
    if (ok) setModalKey(null);
  }

  async function handleRemove(key: string) {
    if (!confirm(`Delete variable "${key}"?`)) return;
    const nextVars = { ...variables };
    const nextMeta = { ...variablesMeta };
    delete nextVars[key];
    delete nextMeta[key];
    setBusyKey(key);
    await persist(nextVars, nextMeta, 'Variable deleted');
    setBusyKey(null);
  }

  const customKeys = Object.keys(variables);
  const isModalOpen = modalKey !== null;

  // Values pre-filled when editing an existing row
  function editInitialValues(key: string) {
    const meta = variablesMeta[key];
    return {
      key,
      name: meta?.name ?? '',
      description: meta?.description ?? '',
      type: (meta?.type ?? 'text') as VariableType,
      rawValue: variables[key] ?? '',
    };
  }

  return (
    <div className="space-y-6">
      {/* System variables (read-only) */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <button
          type="button"
          onClick={() => setSystemOpen((v) => !v)}
          aria-expanded={systemOpen}
          className="flex w-full items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--coachio-admin-dashboard-text-muted)] transition-transform ${systemOpen ? '' : '-rotate-90'}`}
          />
          <span className="flex-1">
            <span className="text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">System variables (read-only)</span>
            <span className="ml-2 rounded-full bg-[var(--coachio-admin-dashboard-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
              {systemVariables.length}
            </span>
          </span>
        </button>

        {systemOpen && (
          <>
            <p className="mb-3 mt-2 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">Filled automatically by the system and cannot be overridden. Click the copy button to grab a token.</p>
            <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)]">
              {systemVariables.map(({ key, description }, idx) => (
            <div
              key={key}
              className="flex items-start gap-3 px-3 py-2.5"
              style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--coachio-admin-dashboard-border-subtle)' }}
            >
              <code className="mt-0.5 w-52 shrink-0 truncate rounded-[6px] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                {`{{${key}}}`}
              </code>
              <span className="flex-1 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                {description ?? <span className="italic opacity-60">No description</span>}
              </span>
              <button
                type="button"
                title="Copy token"
                onClick={() => copyToken(key)}
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
              >
                {copied === key ? (
                  <Check className="h-3.5 w-3.5 text-[var(--coachio-admin-dashboard-success-text,#16a34a)]" />
                ) : (
                  <Clipboard className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Custom variables */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <h3 className="mb-1 text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">
          Custom variables
          <span className="ml-2 inline-block rounded-full border border-[#e4dcfb] bg-[var(--coachio-admin-dashboard-accent-soft,#f3effd)] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--coachio-admin-dashboard-accent)]">
            name · description · type
          </span>
        </h3>
        <p className="mb-4 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
          Each variable can have a label, description and data type. The value substituted for{' '}
          <code className="font-mono">{`{{key}}`}</code> is always the raw string shown below.
        </p>

        {/* Variables table */}
        {customKeys.length > 0 && (
          <div className="mb-5 overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--coachio-admin-dashboard-border)]">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--coachio-admin-dashboard-text-muted)]" style={{ width: 190 }}>Token</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--coachio-admin-dashboard-text-muted)]">Name / Description</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--coachio-admin-dashboard-text-muted)]" style={{ width: 110 }}>Type</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--coachio-admin-dashboard-text-muted)]" style={{ width: 170 }}>Value</th>
                  <th style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {customKeys.map((key, idx) => {
                  const meta = variablesMeta[key];
                  const varType: VariableType = meta?.type ?? 'text';
                  const isBusy = busyKey === key;
                  return (
                    <tr
                      key={key}
                      className="transition hover:bg-[var(--coachio-admin-dashboard-surface-muted)]"
                      style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--coachio-admin-dashboard-border-subtle)' }}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <code className="rounded-[6px] bg-[var(--coachio-admin-dashboard-accent-soft,#f3effd)] px-2 py-1 font-mono text-xs text-[var(--coachio-admin-dashboard-accent)]">
                          {`{{${key}}}`}
                        </code>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {meta?.name
                          ? <p className="font-semibold text-[var(--coachio-admin-dashboard-text)]">{meta.name}</p>
                          : <p className="italic text-[var(--coachio-admin-dashboard-text-muted)]">(no name)</p>
                        }
                        {meta?.description && (
                          <p className="mt-0.5 text-[11.5px] text-[var(--coachio-admin-dashboard-text-muted)]">{meta.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <TypePill type={varType} />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {variables[key] ? (
                          <>
                            <span className="text-sm font-medium text-[var(--coachio-admin-dashboard-text)]">
                              {formatRawForDisplay(varType, variables[key])}
                            </span>
                            {/* Show the raw stored string when it differs from the formatted label. */}
                            {formatRawForDisplay(varType, variables[key]) !== variables[key] && (
                              <span className="mt-0.5 block font-mono text-[10.5px] text-[var(--coachio-admin-dashboard-text-muted)]">
                                {variables[key]}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm italic opacity-60">(empty)</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => copyToken(key)}
                          title="Copy token"
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
                        >
                          {copied === key ? <Check className="h-3.5 w-3.5 text-[var(--coachio-admin-dashboard-success-text,#16a34a)]" /> : <Clipboard className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalKey(key)}
                          disabled={isBusy}
                          title="Edit"
                          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] disabled:opacity-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleRemove(key); }}
                          disabled={isBusy}
                          title="Delete"
                          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--coachio-admin-dashboard-danger-border)] text-[var(--coachio-admin-dashboard-danger-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {customKeys.length === 0 && (
          <p className="mb-4 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">No custom variables yet.</p>
        )}

        {/* Open-modal CTA */}
        <button
          type="button"
          onClick={() => setModalKey('__add__')}
          className="inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" />
          Add variable
        </button>
        <p className="mt-2 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
          The add/edit form opens in a modal — changing Type switches the value widget; the Raw value line is the actual string that gets substituted.
        </p>
      </div>

      {/* CTA behaviours (read-only) */}
      {ctaAttributes && ctaAttributes.length > 0 && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <h3 className="mb-1 text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">CTA behaviours (read-only)</h3>
          <p className="mb-3 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            Add these to a <code className="font-mono">{'<button>'}</code> or <code className="font-mono">{'<a>'}</code> tag in your HTML to wire up app behavior.
          </p>
          <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)]">
            {ctaAttributes.map((row, idx) => {
              const copyVal = row.copyValue ?? row.token;
              return (
                <div
                  key={row.token}
                  className="flex items-start gap-3 px-3 py-2.5"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--coachio-admin-dashboard-border-subtle)' }}
                >
                  <code className="mt-0.5 shrink-0 rounded-[6px] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                    {row.token}
                  </code>
                  <span className="flex-1 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">{row.label}</span>
                  <button
                    type="button"
                    title="Copy"
                    onClick={() => {
                      navigator.clipboard.writeText(copyVal).then(() => {
                        setCopiedCta(copyVal);
                        setTimeout(() => setCopiedCta((cur) => (cur === copyVal ? null : cur)), 1500);
                      }).catch(() => {/* clipboard not available */});
                    }}
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
                  >
                    {copiedCta === copyVal ? (
                      <Check className="h-3.5 w-3.5 text-[var(--coachio-admin-dashboard-success-text,#16a34a)]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {isModalOpen && (
        <VariableFormModal
          editingKey={modalKey === '__add__' ? null : modalKey}
          initialValues={modalKey !== '__add__' && modalKey !== null ? editInitialValues(modalKey) : undefined}
          reservedKeys={reservedKeys}
          existingKeys={customKeys}
          onSave={(key, rawValue, meta) => { void handleModalSave(key, rawValue, meta); }}
          onClose={() => setModalKey(null)}
        />
      )}
    </div>
  );
}
