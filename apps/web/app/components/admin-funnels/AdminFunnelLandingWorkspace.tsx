'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Braces, Clipboard, Download, ExternalLink, Eye, EyeOff, GripVertical, ImageIcon, Laptop, Layers, Loader2, Monitor,
  PanelRightClose, PanelRightOpen, Plus, Save, Search, Smartphone, Tablet, Trash2,
} from 'lucide-react';
import { adminFunnelsApi, funnelsApi, getApiErrorMessage, type Funnel, type FunnelSection, type FunnelLanding, type MediaAsset } from '@coachio/api-client';
import { LandingSectionFrame } from '../landing-shared/LandingSectionFrame';
import { downloadFunnelLandingHtml } from './funnelLandingHtmlExport';
import { AdminFunnelSeoModal } from './AdminFunnelSeoModal';
import { VariablesModal } from '../shared/variables/VariablesModal';
import { FUNNEL_LANDING_SYSTEM_VARIABLE_TOKENS, FUNNEL_CTA_ATTRIBUTE_TOKENS } from './funnelVariableTokens';
import { MediaPicker, buildMediaSnippet } from '../shared/media-picker';
import { useToast } from '../shared/toast';

type PreviewSize = 'desktop' | 'laptop' | 'tablet' | 'mobile';

const PREVIEW_WIDTH: Record<PreviewSize, string> = {
  desktop: '100%',
  laptop: '1180px',
  tablet: '768px',
  mobile: '390px',
};

const PREVIEW_OPTIONS: Array<{ value: PreviewSize; label: string; icon: typeof Monitor }> = [
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'laptop', label: 'Laptop', icon: Laptop },
  { value: 'tablet', label: 'Tablet', icon: Tablet },
  { value: 'mobile', label: 'Mobile', icon: Smartphone },
];

interface AdminFunnelLandingWorkspaceProps {
  funnel: Funnel;
}

/**
 * Trình chỉnh sửa landing funnel — cùng UI/UX/layout/thao tác với trình edit landing khóa học:
 * header (preview size + actions), panel chỉnh section bên trái, preview iframe ở giữa,
 * inspector danh sách section (kéo-thả + thu gọn) nổi bên phải.
 */
export function AdminFunnelLandingWorkspace({ funnel }: AdminFunnelLandingWorkspaceProps) {
  const funnelId = funnel.id;
  const [sections, setSections] = useState<FunnelSection[]>([]);
  const [landing, setLanding] = useState<FunnelLanding | null>(null);
  const [htmlDrafts, setHtmlDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [anchorDrafts, setAnchorDrafts] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSeo, setShowSeo] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const dragRef = useRef<{ id: string; startIdx: number } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { success, error: toastError } = useToast();

  // Insert a media snippet into the active section's HTML at the cursor position.
  const insertMedia = useCallback((asset: MediaAsset) => {
    if (!activeSectionId) return;
    const snippet = buildMediaSnippet(asset);
    const el = htmlTextareaRef.current;
    setHtmlDrafts((prev) => {
      const current = prev[activeSectionId] ?? '';
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const next = current.slice(0, start) + snippet + current.slice(end);
      return { ...prev, [activeSectionId]: next };
    });
  }, [activeSectionId]);

  // Chọn section + cuộn preview tới đúng section đó (no-op nếu section đang ẩn).
  const focusSection = useCallback((id: string) => {
    setActiveSectionId(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      adminFunnelsApi.listSections(funnelId),
      adminFunnelsApi.getLanding(funnelId),
    ])
      .then(([secs, land]) => {
        if (!mounted) return;
        const sorted = [...secs].sort((a, b) => a.sort_order - b.sort_order);
        setSections(sorted);
        setLanding(land);
        const drafts: Record<string, string> = {};
        const names: Record<string, string> = {};
        const anchors: Record<string, string> = {};
        sorted.forEach((s) => {
          drafts[s.id] = s.html;
          names[s.id] = s.name;
          anchors[s.id] = s.anchor ?? '';
        });
        setHtmlDrafts(drafts);
        setNameDrafts(names);
        setAnchorDrafts(anchors);
        setActiveSectionId(sorted[0]?.id ?? null);
      })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load landing')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [funnelId]);

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeSectionId) ?? null,
    [sections, activeSectionId],
  );

  async function handleAddSection() {
    try {
      const newSection = await adminFunnelsApi.createSection(funnelId, {
        name: `Section ${sections.length + 1}`,
        html: '',
        section_type: 'custom',
        is_visible: true,
        sort_order: sections.length,
      });
      setSections((prev) => [...prev, newSection]);
      setHtmlDrafts((prev) => ({ ...prev, [newSection.id]: '' }));
      setNameDrafts((prev) => ({ ...prev, [newSection.id]: newSection.name }));
      setAnchorDrafts((prev) => ({ ...prev, [newSection.id]: '' }));
      setActiveSectionId(newSection.id);
      success('New section added');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to add section');
      setError(msg);
      toastError(msg);
    }
  }

  // Xuất landing page thành 1 file HTML standalone. Lấy bản public (đã resolve
  // biến + chỉ section hiển thị) để file khớp đúng trang khách thấy.
  async function handleExportHtml() {
    setIsExporting(true);
    setError('');
    try {
      const landingData = await funnelsApi.getPublicFunnel(funnel.slug);
      downloadFunnelLandingHtml(landingData, window.location.origin);
      success('Đã xuất file HTML landing page');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Không xuất được file HTML');
      setError(msg);
      toastError(msg);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSaveActive() {
    if (!activeSection) return;
    setIsSaving(true);
    setError('');
    try {
      const anchorValue = anchorDrafts[activeSection.id]?.trim() || null;
      const updated = await adminFunnelsApi.updateSection(funnelId, activeSection.id, {
        html: htmlDrafts[activeSection.id] ?? '',
        name: nameDrafts[activeSection.id] ?? '',
        anchor: anchorValue,
      });
      setSections((prev) => prev.map((s) => (s.id === activeSection.id ? updated : s)));
      success('Section saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save section');
      setError(msg);
      toastError(msg);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleVisible(section: FunnelSection) {
    try {
      const updated = await adminFunnelsApi.updateSection(funnelId, section.id, { is_visible: !section.is_visible });
      setSections((prev) => prev.map((s) => (s.id === section.id ? updated : s)));
      success(updated.is_visible ? 'Section shown' : 'Section hidden');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to update visibility');
      setError(msg);
      toastError(msg);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm('Delete this section?')) return;
    try {
      await adminFunnelsApi.deleteSection(funnelId, sectionId);
      setSections((prev) => {
        const next = prev.filter((s) => s.id !== sectionId);
        if (sectionId === activeSectionId) setActiveSectionId(next[0]?.id ?? null);
        return next;
      });
      success('Section deleted');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to delete section');
      setError(msg);
      toastError(msg);
    }
  }

  const handleDragStart = useCallback((id: string, idx: number) => {
    dragRef.current = { id, startIdx: idx };
  }, []);

  const handleDrop = useCallback(
    async (targetIdx: number) => {
      if (!dragRef.current) return;
      const { startIdx } = dragRef.current;
      dragRef.current = null;
      if (startIdx === targetIdx) return;
      const reordered = [...sections];
      const [moved] = reordered.splice(startIdx, 1);
      reordered.splice(targetIdx, 0, moved);
      setSections(reordered);
      try {
        await adminFunnelsApi.reorderSections(funnelId, reordered.map((s) => s.id));
        success('Sections reordered');
      } catch (e) {
        const msg = getApiErrorMessage(e, 'Failed to reorder sections');
        setError(msg);
        toastError(msg);
      }
    },
    [funnelId, sections, success, toastError],
  );

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center bg-[var(--coachio-admin-dashboard-surface-muted)]">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
      </div>
    );
  }

  const visibleSections = sections.filter((s) => s.is_visible);

  return (
    <main className="flex h-full flex-col overflow-hidden text-[var(--coachio-admin-dashboard-text)]">
      {/* Header: status/title + preview size segment + actions */}
      <header className="relative flex min-h-[73px] shrink-0 items-center justify-between gap-4 border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-6 py-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <div className="min-w-0 max-w-[320px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-accent)]">{funnel.status}</p>
          <h1 className="line-clamp-2 text-lg font-semibold leading-tight text-[var(--coachio-admin-dashboard-text)]" title={funnel.title}>{funnel.title}</h1>
        </div>

        {/* Preview size segment — centered */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-1 lg:inline-flex">
          {PREVIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreviewSize(value)}
              className={`grid h-9 w-10 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] transition ${previewSize === value ? 'bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-accent)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]' : 'text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]'}`}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={`/funnels/${funnel.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open landing page in new tab"
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open page
          </a>
          <button type="button" onClick={() => setShowVariables(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
            <Braces className="h-3.5 w-3.5" />
            Variables
          </button>
          <button type="button" onClick={() => setShowSeo(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
            <Search className="h-3.5 w-3.5" />
            SEO
          </button>
          <button
            type="button"
            onClick={handleExportHtml}
            disabled={isExporting}
            title="Xuất landing page thành 1 file HTML độc lập"
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export HTML
          </button>
          <button type="button" onClick={handleAddSection} className="inline-flex h-8 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
            <Plus className="h-3.5 w-3.5" />
            Add section
          </button>
          {/* Nút "Save" tổng đã bỏ — mỗi section lưu riêng bằng "Save section" ở panel trái. */}
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: edit active section */}
        <aside className="flex w-[420px] shrink-0 flex-col overflow-y-auto border-r border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)]">
          {activeSection ? (
            <div className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Edit section</p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-[var(--coachio-admin-dashboard-text)]">{nameDrafts[activeSection.id] ?? activeSection.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleVisible(activeSection)}
                  title={activeSection.is_visible ? 'Visible — click to hide' : 'Hidden — click to show'}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]"
                >
                  {activeSection.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {activeSection.is_visible ? 'Visible' : 'Hidden'}
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">Section name</span>
                <input
                  value={nameDrafts[activeSection.id] ?? ''}
                  onChange={(e) => setNameDrafts((prev) => ({ ...prev, [activeSection.id]: e.target.value }))}
                  className="h-10 w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-sm font-medium text-[var(--coachio-admin-dashboard-text)] outline-none transition focus:border-[var(--coachio-admin-dashboard-accent)]"
                  placeholder="Section name"
                />
              </label>

              <div className="block">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">Anchor (optional)</span>
                  <button
                    type="button"
                    onClick={async () => {
                      // Mirror the backend `normalize_anchor` slug rule so the copied
                      // payload matches the saved anchor (and thus the rendered
                      // `landing-section-<slug>` id). Empty slug → fall back to section id.
                      const slug = (anchorDrafts[activeSection.id] ?? '')
                        .trim()
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                      const anchor = slug || activeSection.id;
                      const snippet = `data-landing-action="scroll" data-landing-payload="${anchor}"`;
                      try {
                        await navigator.clipboard.writeText(snippet);
                        success('Đã sao chép');
                      } catch {
                        toastError('Không sao chép được');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline"
                    title="Copy scroll CTA attributes to clipboard"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy scroll link
                  </button>
                </div>
                <input
                  value={anchorDrafts[activeSection.id] ?? ''}
                  onChange={(e) => setAnchorDrafts((prev) => ({ ...prev, [activeSection.id]: e.target.value }))}
                  className="h-9 w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-sm font-medium text-[var(--coachio-admin-dashboard-text)] outline-none transition focus:border-[var(--coachio-admin-dashboard-accent)]"
                  placeholder="e.g. pricing"
                  maxLength={80}
                />
                <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
                  Used by <code className="font-mono">data-landing-action=&quot;scroll&quot;</code> CTAs. Falls back to the section id if empty.
                </p>
              </div>

              <label className="block">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">HTML</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setShowMediaPicker(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Insert media
                    </button>
                    <button type="button" onClick={() => setShowVariables(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)] hover:underline">
                      <Braces className="h-3.5 w-3.5" />
                      View variables &amp; attributes
                    </button>
                  </div>
                </div>
                <textarea
                  ref={htmlTextareaRef}
                  value={htmlDrafts[activeSection.id] ?? ''}
                  onChange={(e) => setHtmlDrafts((prev) => ({ ...prev, [activeSection.id]: e.target.value }))}
                  rows={18}
                  spellCheck={false}
                  className="w-full resize-y rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-text)] px-3 py-3 font-mono text-sm text-[var(--coachio-admin-dashboard-text-inverse)] outline-none transition focus:border-[var(--coachio-admin-dashboard-accent)]"
                  placeholder="<div>HTML section...</div>"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleSaveActive} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save section
                </button>
                <button type="button" onClick={() => handleDeleteSection(activeSection.id)} className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)] transition hover:opacity-90">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">No sections yet. Click &quot;Add section&quot; to get started.</p>
              <button type="button" onClick={handleAddSection} className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]">
                <Plus className="h-4 w-4" />
                Add section
              </button>
            </div>
          )}
        </aside>

        {/* Center: preview (cuộn riêng) + inspector cố định bên phải */}
        <section className="relative min-w-0 flex-1 overflow-hidden bg-[var(--coachio-admin-dashboard-surface-muted)]">
          <div className="h-full overflow-auto p-4">
            <div className="mx-auto transition-all" style={{ width: PREVIEW_WIDTH[previewSize], maxWidth: '100%' }}>
              {visibleSections.length === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-lg)] border-2 border-dashed border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                  Add a section to preview
                </div>
              ) : (
                visibleSections.map((section) => (
                  <div
                    key={section.id}
                    ref={(el) => { sectionRefs.current[section.id] = el; }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSectionId(section.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setActiveSectionId(section.id); }}
                    className={`relative scroll-mt-4 cursor-pointer ${activeSectionId === section.id ? 'outline outline-2 outline-offset-[-2px] outline-[var(--coachio-admin-dashboard-accent)]' : ''}`}
                  >
                    <LandingSectionFrame
                      html={htmlDrafts[section.id] ?? section.html}
                      frameId={`funnel-section-${section.id}`}
                      title={section.name}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {isInspectorOpen ? (
            <div className="absolute right-6 top-6 z-30 flex max-h-[calc(100%-48px)] w-72 flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]">
              <div className="flex h-12 items-center justify-between border-b border-[var(--coachio-admin-dashboard-border)] px-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-muted)]">
                  <Layers className="h-4 w-4" />
                  Sections
                </div>
                <button type="button" onClick={() => setIsInspectorOpen(false)} className="grid h-8 w-8 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]" aria-label="Collapse inspector">
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto">
                {sections.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-[var(--coachio-admin-dashboard-text-muted)]">No sections yet.</p>
                )}
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => handleDragStart(section.id, index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    onClick={() => focusSection(section.id)}
                    className={`flex w-full cursor-pointer items-center gap-2 border-b border-[var(--coachio-admin-dashboard-border)] px-3 py-3 text-left text-sm transition last:border-b-0 ${activeSectionId === section.id ? 'bg-[var(--coachio-admin-dashboard-accent-soft)]' : 'bg-[var(--coachio-admin-dashboard-surface)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)]'}`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--coachio-admin-dashboard-text-soft)]" />
                    <span className="w-5 shrink-0 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-[var(--coachio-admin-dashboard-text)]">{nameDrafts[section.id] ?? section.name}</span>
                    <button
                      type="button"
                      title={section.is_visible ? 'Hide' : 'Show'}
                      onClick={(e) => { e.stopPropagation(); handleToggleVisible(section); }}
                      className="shrink-0 text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
                    >
                      {section.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setIsInspectorOpen(true)} className="absolute right-6 top-6 z-30 grid h-10 w-10 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text-muted)] shadow-[var(--coachio-admin-dashboard-shadow-md)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]" aria-label="Open inspector">
              <PanelRightOpen className="h-5 w-5" />
            </button>
          )}
        </section>
      </div>

      {landing && (
        <AdminFunnelSeoModal
          isOpen={showSeo}
          onClose={() => setShowSeo(false)}
          funnelId={funnelId}
          landing={landing}
          onUpdated={(updated) => setLanding(updated)}
        />
      )}
      <VariablesModal
        isOpen={showVariables}
        onClose={() => setShowVariables(false)}
        systemVariables={FUNNEL_LANDING_SYSTEM_VARIABLE_TOKENS}
        customVariables={funnel.variables}
        ctaAttributes={FUNNEL_CTA_ATTRIBUTE_TOKENS}
      />
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        selectLabel="Insert into HTML"
        onSelect={insertMedia}
      />
    </main>
  );
}
