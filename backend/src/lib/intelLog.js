// Structured single-line JSON logs for the intelligence layer (listing
// evaluations, AI fraud/review scans). One event per line so Railway's log
// search — or any future log drain — can filter on src:"intel" and see why
// a decision was made without reading application code.
const silent = process.env.NODE_ENV === 'test'

export function intelLog(event, data = {}) {
  if (silent) return
  console.log(JSON.stringify({ ts: new Date().toISOString(), src: 'intel', event, ...data }))
}

export function intelError(event, err, data = {}) {
  if (silent) return
  console.error(JSON.stringify({ ts: new Date().toISOString(), src: 'intel', event, error: err?.message ?? String(err), ...data }))
}
