# DEMOS - Play Integrity cost gate 2026-11-03

Decision: HOLD. Do not enable API, link billing, merge feature, or deploy.

Official Play Integrity setup requires a Google Cloud project and describes daily quotas of 10,000 standard preparations/classic tokens and 10,000 server-side decryptions. It does not provide an explicit full-chain guarantee of zero charges.
https://developer.android.com/google/play/integrity/setup

Google Cloud general billing documentation says an active Cloud Billing account is required for Cloud services, even Free Tier services, with exceptions for some products. Play Integrity-specific billing exception has not been established.
https://docs.cloud.google.com/docs/get-started/learn-about-billing

Cloud cost alerts do not automatically cap spending.

The product is not proven to be paid; the strict zero-cost/no-billing requirement is simply not proven. Leave PR 572 as draft and API disabled. No new billable resources have been activated.

Resume only with explicit provider documentation of pricing, required billing, decoding and standard tokens, and conditions for higher quotas, plus owner authorization.