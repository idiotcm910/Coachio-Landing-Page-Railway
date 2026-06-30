'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { adminFunnelsApi, getApiErrorMessage, type Funnel } from '@coachio/api-client';
import { adminDashboardToken } from '@coachio/design-system/admin-dashboard-token';
import { AdminFunnelHeader } from './AdminFunnelHeader';
import { AdminFunnelWorkspaceSidebar, type FunnelWorkspace } from './AdminFunnelWorkspaceSidebar';
import { AdminFunnelLandingWorkspace } from './AdminFunnelLandingWorkspace';
import { AdminFunnelProductWorkspace } from './AdminFunnelProductWorkspace';
import { AdminFunnelCheckoutWorkspace } from './AdminFunnelCheckoutWorkspace';
import { AdminFunnelSuccessWorkspace } from './AdminFunnelSuccessWorkspace';
import { AdminFunnelEmailWorkspace } from './AdminFunnelEmailWorkspace';
import { AdminDiscountsWorkspace } from '../shared/discounts/AdminDiscountsWorkspace';
import { AdminVariablesWorkspace } from '../shared/variables/AdminVariablesWorkspace';
import { FUNNEL_CTA_ATTRIBUTE_TOKENS } from './funnelVariableTokens';
import { AdminFunnelLeadsWorkspace } from './AdminFunnelLeadsWorkspace';
import { AdminFunnelAnalyticsWorkspace } from './AdminFunnelAnalyticsWorkspace';
import { AdminFunnelTrackingWorkspace } from './AdminFunnelTrackingWorkspace';
import { AdminMediaManagement } from '../admin-dashboard/AdminMediaManagement';
import { AdminFunnelBroadcastWorkspace } from '../admin-broadcast/AdminFunnelBroadcastWorkspace';
import { useToast } from '../shared/toast';

const FUNNEL_RESERVED_KEYS = [
  'product_name', 'funnel_title', 'price', 'discounted_price', 'discount_percent',
  'checkout_url', 'success_url', 'zalo_link',
];
const FUNNEL_SYSTEM_VARIABLE_DESCRIPTIONS: Record<string, string> = {
  product_name: 'Name of the product linked to this funnel.',
  funnel_title: 'Title of this funnel.',
  price: 'Product base price, VND-formatted (e.g. 1.000.000).',
  discounted_price: "Price after the owner's default discount is applied, VND-formatted.",
  discount_percent: 'Total default discount percent (integer, no % sign — e.g. 30).',
  checkout_url: "URL of this funnel's checkout page.",
  success_url: 'URL of the thank-you page shown after payment.',
  zalo_link: 'Zalo group link configured for this funnel.',
};
const FUNNEL_SYSTEM_VARIABLES = FUNNEL_RESERVED_KEYS.map((key) => ({
  key,
  description: FUNNEL_SYSTEM_VARIABLE_DESCRIPTIONS[key],
}));

interface AdminFunnelEditShellProps {
  initialFunnel: Funnel;
  workspace: FunnelWorkspace;
}

export function AdminFunnelEditShell({ initialFunnel, workspace }: AdminFunnelEditShellProps) {
  const router = useRouter();
  const [funnel, setFunnel] = useState(initialFunnel);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [error, setError] = useState('');
  const { success, error: toastError } = useToast();

  function navigateTo(ws: FunnelWorkspace) {
    router.push(`/admin/funnels/${funnel.id}/edit/${ws}`);
  }

  async function handleToggleStatus() {
    setIsSavingStatus(true);
    setError('');
    try {
      const nextStatus = funnel.status === 'published' ? 'draft' : 'published';
      const updated = await adminFunnelsApi.update(funnel.id, { status: nextStatus });
      setFunnel(updated);
      success(updated.status === 'published' ? 'Funnel published' : 'Funnel moved to draft');
    } catch (caught) {
      const msg = getApiErrorMessage(caught, 'Failed to update status');
      setError(msg);
      toastError(msg);
    } finally {
      setIsSavingStatus(false);
    }
  }

  function renderContent() {
    switch (workspace) {
      case 'landing':
        return <AdminFunnelLandingWorkspace funnel={funnel} />;
      case 'product':
        return <AdminFunnelProductWorkspace funnel={funnel} />;
      case 'checkout':
        return <AdminFunnelCheckoutWorkspace funnel={funnel} onUpdated={setFunnel} />;
      case 'success':
        return <AdminFunnelSuccessWorkspace funnel={funnel} onUpdated={setFunnel} />;
      case 'email':
        return <AdminFunnelEmailWorkspace funnelId={funnel.id} productId={funnel.product_id} />;
      case 'broadcasts':
        return (
          <AdminFunnelBroadcastWorkspace
            funnelId={funnel.id}
            funnelTitle={funnel.title}
            variables={funnel.variables}
            variablesMeta={funnel.variables_meta}
          />
        );
      case 'discounts':
        return <AdminDiscountsWorkspace ownerType="funnel" ownerId={funnel.id} />;
      case 'variables':
        return (
          <AdminVariablesWorkspace
            initialVariables={funnel.variables}
            initialVariablesMeta={funnel.variables_meta}
            reservedKeys={FUNNEL_RESERVED_KEYS}
            systemVariables={FUNNEL_SYSTEM_VARIABLES}
            ctaAttributes={FUNNEL_CTA_ATTRIBUTE_TOKENS}
            onSave={(vars, meta) =>
              adminFunnelsApi.update(funnel.id, { variables: vars, variables_meta: meta }).then((f) => setFunnel(f))
            }
          />
        );
      case 'leads':
        return <AdminFunnelLeadsWorkspace funnelId={funnel.id} />;
      case 'analytics':
        return <AdminFunnelAnalyticsWorkspace funnelId={funnel.id} />;
      case 'tracking':
        return <AdminFunnelTrackingWorkspace funnel={funnel} onUpdated={setFunnel} />;
      case 'media':
        return <AdminMediaManagement />;
      default:
        return null;
    }
  }

  if (workspace === 'landing') {
    return (
      <div className="flex h-screen overflow-hidden text-[var(--coachio-admin-dashboard-text)]">
        <AdminFunnelWorkspaceSidebar
          activeWorkspace={workspace}
          status={funnel.status}
          slug={funnel.slug}
          isSavingStatus={isSavingStatus}
          onBack={() => router.push('/admin/funnels')}
          onNavigate={navigateTo}
          onToggleStatus={handleToggleStatus}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <AdminFunnelLandingWorkspace funnel={funnel} />
        </div>
      </div>
    );
  }

  return (
    <main
      className="flex h-screen overflow-hidden text-[var(--coachio-admin-dashboard-text)]"
      style={{ backgroundColor: adminDashboardToken.color.background }}
    >
      <AdminFunnelWorkspaceSidebar
        activeWorkspace={workspace}
        status={funnel.status}
        slug={funnel.slug}
        isSavingStatus={isSavingStatus}
        onBack={() => router.push('/admin/funnels')}
        onNavigate={navigateTo}
        onToggleStatus={handleToggleStatus}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminFunnelHeader
          title={funnel.title}
          slug={funnel.slug}
        />

        {error && (
          <div className="mx-6 mt-6 flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-6">{renderContent()}</div>
      </div>
    </main>
  );
}
