import { useStore } from '../context/StoreContext';
import UpgradePrompt from './UpgradePrompt';

/**
 * Wraps a route that requires a specific plan feature.
 * If the current plan doesn't include the feature, shows UpgradePrompt instead.
 *
 * Usage:
 *   <PlanGuard feature="customer_loyalty">
 *     <CustomersPage />
 *   </PlanGuard>
 */
export default function PlanGuard({ feature, children }) {
  const { hasFeature, store } = useStore();

  if (!hasFeature(feature)) {
    return <UpgradePrompt feature={feature} currentTier={store.plan_tier} />;
  }

  return children;
}
