// The WhatsApp listing bot — the one place the number is written on mobile.
// (Web keeps its own copy in frontend/src/lib/seo.js; the backend never needs
// it, Meta addresses the number for us.)
export const WHATSAPP_LIST_URL =
  'https://wa.me/917358247801?text=' + encodeURIComponent('Hi, I want to list my property')
