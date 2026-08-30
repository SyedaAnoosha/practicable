import { Purchases } from '@/pages/Purchases'

/** The account Purchases section mounts the exact same
 * Purchases component as the standalone /purchases route.
 * "They cannot be allowed to drift, and one of them already works." */
export function AccountPurchases() {
  // `embedded` swaps the page-level h1 + container for a section h2, so the shell's
  // "Account" stays the page's only h1 and the section headings all sit at one rung.
  return <Purchases embedded />
}
