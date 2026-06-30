import type { PublicFunnelLanding } from '../funnels/types';

export type HomepageTargetType = 'funnel';

export interface HomepageOption {
  type: HomepageTargetType;
  id: string; // funnel id
  title: string;
  slug: string;
}

export interface HomepageOptionsResponse {
  funnels: HomepageOption[];
}

/** Current homepage selection for the admin menu (all null = default homepage). */
export interface SiteHomepageSetting {
  target_type: HomepageTargetType | null;
  target_id: string | null;
  title: string | null;
  slug: string | null;
}

export interface SiteHomepageSetInput {
  target_type: HomepageTargetType;
  target_id: string;
}

/** Discriminated resolved homepage payload consumed by the public root `/`. */
export interface PublicHomepage {
  type: 'funnel' | 'none';
  funnel: PublicFunnelLanding | null;
}
