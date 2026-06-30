export const adminDashboardToken = {
  color: {
    background: 'var(--coachio-admin-dashboard-bg)',
    surface: 'var(--coachio-admin-dashboard-surface)',
    surfaceMuted: 'var(--coachio-admin-dashboard-surface-muted)',
    surfaceHover: 'var(--coachio-admin-dashboard-surface-hover)',
    border: 'var(--coachio-admin-dashboard-border)',
    borderSubtle: 'var(--coachio-admin-dashboard-border-subtle)',
    text: 'var(--coachio-admin-dashboard-text)',
    textMuted: 'var(--coachio-admin-dashboard-text-muted)',
    textSoft: 'var(--coachio-admin-dashboard-text-soft)',
    textInverse: 'var(--coachio-admin-dashboard-text-inverse)',
    accent: 'var(--coachio-admin-dashboard-accent)',
    accentHover: 'var(--coachio-admin-dashboard-accent-hover)',
    accentSoft: 'var(--coachio-admin-dashboard-accent-soft)',
    success: {
      background: 'var(--coachio-admin-dashboard-success-bg)',
      text: 'var(--coachio-admin-dashboard-success-text)',
      border: 'var(--coachio-admin-dashboard-success-border)',
    },
    warning: {
      background: 'var(--coachio-admin-dashboard-warning-bg)',
      text: 'var(--coachio-admin-dashboard-warning-text)',
      border: 'var(--coachio-admin-dashboard-warning-border)',
    },
    danger: {
      background: 'var(--coachio-admin-dashboard-danger-bg)',
      text: 'var(--coachio-admin-dashboard-danger-text)',
      border: 'var(--coachio-admin-dashboard-danger-border)',
    },
    info: {
      background: 'var(--coachio-admin-dashboard-info-bg)',
      text: 'var(--coachio-admin-dashboard-info-text)',
      border: 'var(--coachio-admin-dashboard-info-border)',
    },
    neutral: {
      background: 'var(--coachio-admin-dashboard-neutral-bg)',
      text: 'var(--coachio-admin-dashboard-neutral-text)',
      border: 'var(--coachio-admin-dashboard-neutral-border)',
    },
  },
  radius: {
    sm: 'var(--coachio-admin-dashboard-radius-sm)',
    md: 'var(--coachio-admin-dashboard-radius-md)',
    lg: 'var(--coachio-admin-dashboard-radius-lg)',
  },
  shadow: {
    sm: 'var(--coachio-admin-dashboard-shadow-sm)',
    md: 'var(--coachio-admin-dashboard-shadow-md)',
    modal: 'var(--coachio-admin-dashboard-shadow-modal)',
  },
  layout: {
    sidebarWidth: 'var(--coachio-admin-dashboard-sidebar-width)',
    contentPadding: 'var(--coachio-admin-dashboard-content-padding)',
  },
} as const;

export type AdminDashboardToken = typeof adminDashboardToken;
