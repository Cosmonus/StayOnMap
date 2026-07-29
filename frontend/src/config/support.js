// The one address a person can reach a human at.
//
// It became worth a constant on 2026-07-30, when the /contact page was deleted:
// every "get in touch" affordance is now a `mailto:` instead of a route, so the
// address went from one page to five call sites (Footer, the dashboard Support
// section, the Rules pledge, both legal pages). Mobile's copy of this lives in
// features/host/screens/SupportScreen.js — keep the two the same.
export const SUPPORT_EMAIL = 'hello@cosmonus.com'
