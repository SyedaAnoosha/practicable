// The address behind every "contact us" link.
//
// Kept here, sourced from the environment, because it was previously a personal Gmail
// address hardcoded into three separate pages — including the checkout-failure and
// checkout-success screens, which are exactly where a professional buyer forms their
// impression of whether there is a real business behind the product. Changing who
// handles support should be a config change, not a code change across three files.
//
// The fallback is the brand domain rather than anyone's personal inbox: if the mailbox
// does not exist yet the mail bounces and the sender finds out, which is a better
// failure than silently publishing someone's private address on a payment page.
// Set VITE_SUPPORT_EMAIL to override.
export const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@practicable.com.au'

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`
