'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Link2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  adminUrlRedirectsApi,
  getApiErrorMessage,
  type NotFoundConfig,
  type RedirectCreateInput,
  type RedirectRule,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { NotFoundFallbackCard } from './NotFoundFallbackCard';
import { RedirectRuleForm } from './RedirectRuleForm';

const emptyForm = (): RedirectCreateInput => ({
  source_path: '',
  target_url: '',
  match_type: 'exact',
  status_code: 301,
  is_active: true,
});

export function AdminUrlRedirectsManagement() {
  const [rules, setRules] = useState<RedirectRule[]>([]);
  const [notFound, setNotFound] = useState<NotFoundConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RedirectCreateInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let mounted = true;
    Promise.all([adminUrlRedirectsApi.list(), adminUrlRedirectsApi.getNotFoundConfig()])
      .then(([list, cfg]) => {
        if (!mounted) return;
        setRules(list.items);
        setNotFound(cfg);
      })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load redirects')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(rule: RedirectRule) {
    setForm({
      source_path: rule.source_path,
      target_url: rule.target_url,
      match_type: rule.match_type,
      status_code: rule.status_code,
      is_active: rule.is_active,
    });
    setEditingId(rule.id);
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.source_path.trim() || !form.target_url.trim()) {
      setFormError('Old path and new URL are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await adminUrlRedirectsApi.update(editingId, form);
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await adminUrlRedirectsApi.create(form);
        setRules((prev) => [created, ...prev]);
      }
      setShowForm(false);
      success(editingId ? 'Redirect updated' : 'Redirect created');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save redirect');
      setFormError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: RedirectRule) {
    try {
      const updated = await adminUrlRedirectsApi.update(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      success(updated.is_active ? 'Redirect enabled' : 'Redirect disabled');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to update status'));
    }
  }

  async function handleDelete(ruleId: string) {
    if (!confirm('Delete this redirect?')) return;
    try {
      await adminUrlRedirectsApi.remove(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      success('Redirect deleted');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to delete redirect'));
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
            <Link2 className="h-4 w-4" />
            URL Redirects
          </div>
          <h2 className="text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">URL Redirects</h2>
          <p className="mt-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
            Configure redirects from old paths to new URLs within the system.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)]"
        >
          <Plus className="h-5 w-5" />
          Add redirect
        </button>
      </div>

      {notFound && <NotFoundFallbackCard initialConfig={notFound} />}

      {isLoading && (
        <div className="flex items-center gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
          Loading...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <RedirectRuleForm
          form={form}
          editing={!!editingId}
          saving={saving}
          formError={formError}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {!isLoading && rules.length === 0 && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-dashed border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-10 text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          No redirects yet. Click “Add redirect” to create one.
        </div>
      )}

      {rules.length > 0 && (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--coachio-admin-dashboard-border)] text-xs uppercase text-[var(--coachio-admin-dashboard-text-soft)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Redirect</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-[var(--coachio-admin-dashboard-border)] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-mono text-xs text-[var(--coachio-admin-dashboard-text)]">
                      <span>{rule.source_path}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--coachio-admin-dashboard-text-soft)]" />
                      <span className="text-[var(--coachio-admin-dashboard-accent)]">{rule.target_url}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[var(--coachio-admin-dashboard-surface-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
                      {rule.match_type === 'wildcard' ? 'Wildcard' : 'Exact'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">{rule.status_code}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggle(rule)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rule.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {rule.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(rule)} className="rounded p-1.5 text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-muted)]" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(rule.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
