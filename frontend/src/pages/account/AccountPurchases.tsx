import { Purchases } from '@/pages/Purchases'

/** Phase 10 §2 / §10C: The account Purchases section mounts the exact same
 *  Purchases component as the standalone /purchases route.
 *  "They cannot be allowed to drift, and one of them already works." */
export function AccountPurchases() {
  return <Purchases />
}
