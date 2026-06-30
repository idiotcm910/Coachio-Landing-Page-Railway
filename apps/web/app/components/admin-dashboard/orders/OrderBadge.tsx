'use client';

import type { BadgeTokens } from './order-format';
import styles from './OrderBadge.module.scss';

interface OrderBadgeProps {
  tokens: BadgeTokens;
  /** Small dot before the label so meaning is not conveyed by colour alone. */
  withDot?: boolean;
}

export function OrderBadge({ tokens, withDot = true }: OrderBadgeProps) {
  return (
    <span
      className={styles.badge}
      style={{ backgroundColor: tokens.background, color: tokens.color, borderColor: tokens.border }}
    >
      {withDot && <span className={styles.dot} style={{ backgroundColor: tokens.color }} aria-hidden="true" />}
      {tokens.label}
    </span>
  );
}
