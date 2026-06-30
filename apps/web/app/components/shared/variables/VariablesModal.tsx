'use client';

import { useMemo } from 'react';
import { InsertVariableModal } from './insert-variable-modal';
import type { InsertVariable, InsertVariableGroupMeta } from './insert-variable-modal';

export interface VariableRow {
  token: string;
  label: string;
  /** Value to copy/insert — defaults to token if omitted. */
  copyValue?: string;
}

/** Minimal custom-variable metadata (name/description) used to enrich labels. */
export interface CustomVariableMeta {
  name?: string | null;
  description?: string | null;
}

interface VariablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemVariables: VariableRow[];
  /** Course/funnel custom variables map (key → value). */
  customVariables: Record<string, string> | null | undefined;
  ctaAttributes: VariableRow[];
  /** Optional metadata (name/description) for custom variables, keyed by key. */
  customVariablesMeta?: Record<string, CustomVariableMeta> | null;
  /** When provided, the modal inserts at the cursor; otherwise it is copy-only. */
  onInsert?: (token: string) => void;
}

const GROUP_META: Record<string, InsertVariableGroupMeta> = {
  system: { title: 'System', hint: 'Filled with real data at render time', order: 0 },
  custom: { title: 'Custom', hint: 'Your own variables', order: 1, alwaysShow: true },
  cta: { title: 'CTA', hint: 'Interactive attributes for buttons/links', order: 2 },
};

/**
 * Owner-agnostic variables & CTA-attributes reference modal.
 * Thin adapter over the shared InsertVariableModal so every editor (funnel/course
 * landing, success, email, SEO…) shares one consistent UI. Copy-only by default;
 * pass `onInsert` to enable insert-at-cursor.
 */
export function VariablesModal({
  isOpen,
  onClose,
  systemVariables,
  customVariables,
  ctaAttributes,
  customVariablesMeta,
  onInsert,
}: VariablesModalProps) {
  const variables = useMemo<InsertVariable[]>(() => {
    const system: InsertVariable[] = systemVariables.map((r) => ({
      key: r.token,
      label: r.label,
      group: 'system',
      token: r.copyValue ?? r.token,
    }));
    const custom: InsertVariable[] = Object.entries(customVariables ?? {}).map(([key, value]) => {
      const meta = customVariablesMeta?.[key];
      const description = meta?.description?.trim() || (value ? `Value: ${value}` : null);
      return {
        key,
        label: meta?.name?.trim() || key,
        group: 'custom',
        token: `{{${key}}}`,
        description,
      };
    });
    const cta: InsertVariable[] = ctaAttributes.map((r) => ({
      key: r.token,
      label: r.label,
      group: 'cta',
      token: r.copyValue ?? r.token,
    }));
    return [...system, ...custom, ...cta];
  }, [systemVariables, customVariables, ctaAttributes, customVariablesMeta]);

  return (
    <InsertVariableModal
      open={isOpen}
      onClose={onClose}
      variables={variables}
      onInsert={onInsert}
      groupMeta={GROUP_META}
      title="Variables & attributes"
    />
  );
}
