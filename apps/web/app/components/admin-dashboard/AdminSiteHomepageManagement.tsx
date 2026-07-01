'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Check, ExternalLink, Filter, Home, Loader2, Search, X } from 'lucide-react';
import {
  adminSiteHomepageApi,
  getApiErrorMessage,
  type HomepageOption,
  type SiteHomepageSetting,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';

const isSame = (current: SiteHomepageSetting, option: HomepageOption): boolean =>
  current.target_type === option.type && current.target_id === option.id;

// Preview URL for an option's own public landing (not the homepage `/`).
const previewHref = (option: HomepageOption): string => `/funnels/${option.slug}`;

export function AdminSiteHomepageManagement() {
  const [current, setCurrent] = useState<SiteHomepageSetting | null>(null);
  const [funnels, setFunnels] = useState<HomepageOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null); // option id being set
  const [clearing, setClearing] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let mounted = true;
    Promise.all([adminSiteHomepageApi.get(), adminSiteHomepageApi.listOptions()])
      .then(([setting, options]) => {
        if (!mounted) return;
        setCurrent(setting);
        setFunnels(options.funnels);
      })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load homepage settings')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filteredFunnels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return funnels;
    return funnels.filter((o) => o.title.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
  }, [funnels, query]);
  const hasNoOptions = !isLoading && funnels.length === 0;

  async function handleSet(option: HomepageOption) {
    if (current && isSame(current, option)) return;
    setPendingId(option.id);
    try {
      const updated = await adminSiteHomepageApi.setTarget({ target_type: option.type, target_id: option.id });
      setCurrent(updated);
      success(`Homepage set to “${option.title}”`);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to set homepage'));
    } finally {
      setPendingId(null);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      const updated = await adminSiteHomepageApi.clear();
      setCurrent(updated);
      success('Homepage reset to the default page');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to clear homepage'));
    } finally {
      setClearing(false);
    }
  }

  const activeType = current?.target_type;

  return (
    <section className="space-y-6">
      {/* Current homepage card — the single source of truth, prominent at the top. */}
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
          <Home className="h-4 w-4" />
          Site Homepage
        </div>
        {isLoading ? (
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
            Loading...
          </div>
        ) : activeType ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                  Funnel landing
                </span>
                <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">Served at <code>/</code></span>
              </div>
              <h2 className="truncate text-xl font-semibold text-[var(--coachio-admin-dashboard-text)]">{current?.title}</h2>
              <p className="truncate font-mono text-xs text-[var(--coachio-admin-dashboard-text-muted)]">/{current?.slug}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-muted)]"
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </a>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                className="inline-flex h-11 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-danger-border)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)] transition hover:bg-[var(--coachio-admin-dashboard-danger-bg)] disabled:opacity-60"
              >
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Reset to default
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-[var(--coachio-admin-dashboard-text)]">Default homepage</h2>
            <p className="mt-1 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
              No custom homepage is set. Pick a published funnel landing below to serve it at <code>/</code>.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hasNoOptions ? (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-dashed border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-10 text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          No published funnel landings yet. Publish one first, then set it as the homepage.
        </div>
      ) : !isLoading && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--coachio-admin-dashboard-text-soft)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search funnels by title or slug..."
              className="h-11 w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] pl-10 pr-4 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
            />
          </div>

          <OptionGroup
            label="Funnel landings"
            icon={<Filter className="h-4 w-4" />}
            options={filteredFunnels}
            current={current}
            pendingId={pendingId}
            onSet={handleSet}
          />
        </div>
      )}
    </section>
  );
}

interface OptionGroupProps {
  label: string;
  icon: ReactNode;
  options: HomepageOption[];
  current: SiteHomepageSetting | null;
  pendingId: string | null;
  onSet: (option: HomepageOption) => void;
}

function OptionGroup({ label, icon, options, current, pendingId, onSet }: OptionGroupProps) {
  if (options.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
        {icon}
        {label}
        <span className="text-[var(--coachio-admin-dashboard-text-soft)]">({options.length})</span>
      </div>
      <ul className="space-y-2">
        {options.map((option) => {
          const active = !!current && isSame(current, option);
          const pending = pendingId === option.id;
          return (
            <li
              key={`${option.type}-${option.id}`}
              className={`flex items-center justify-between gap-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] border px-4 py-3 transition ${active ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft)]' : 'border-[var(--coachio-admin-dashboard-border)] hover:bg-[var(--coachio-admin-dashboard-surface-muted)]'}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{option.title}</p>
                <p className="truncate font-mono text-xs text-[var(--coachio-admin-dashboard-text-muted)]">/{option.slug}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={previewHref(option)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface)]"
                  aria-label={`Preview ${option.title}`}
                  title="Preview this landing"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {active ? (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]">
                    <Check className="h-4 w-4" />
                    Current
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSet(option)}
                    disabled={pending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-accent)] transition hover:bg-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-60"
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Home className="h-4 w-4" />}
                    Set as homepage
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
