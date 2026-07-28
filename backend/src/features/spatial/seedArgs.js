// Command-line parsing shared by the OSM seeders.
//
// Lives in src/ rather than inline in scripts/ for the same reason
// seedMaintenance.js does: so it can be tested. This is not a hypothetical —
// the original inline version read a bare `--confirm` as a city named
// "confirm", because `args.indexOf('--city')` returns -1 when the flag is
// absent and `args[-1 + 1]` is `args[0]`. The result was a "dry run" that
// silently seeded nothing, or a confirmed run that seeded one imaginary city.
//
// It was then fixed identically in TWO scripts, which is the state this
// module ends.

/**
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {{ confirm: boolean, city: string|null, allowUnseeded: boolean }}
 */
export function parseSeedArgs(argv = []) {
  return {
    confirm: argv.includes('--confirm'),
    allowUnseeded: argv.includes('--allow-unseeded'),
    city: flagValue(argv, '--city'),
  }
}

/**
 * The value following `flag`, or null.
 *
 * Returns null when the flag is absent, is the last argument, or is followed by
 * another flag — so `--city --confirm` is "no city given", never a city called
 * "--confirm". A missing value must never silently become one.
 */
export function flagValue(argv, flag) {
  const i = argv.indexOf(flag)
  if (i === -1) return null
  const next = argv[i + 1]
  if (!next || next.startsWith('--')) return null
  return next
}

/**
 * Refuse to start without a database, and say exactly how to supply one.
 *
 * Added 2026-07-28 after a production seeding attempt was one tile away from
 * discovering this the expensive way. On the prod VM the environment lives in
 * `/etc/stayonmap/api.env` and there is NO `backend/.env`, so the
 * `import 'dotenv/config'` at the top of every seeder loads nothing and
 * DATABASE_URL is undefined. The scripts fetch happily for ~15 minutes per city
 * and only fail at the first write.
 *
 * `.claude/ops.md` already warned that "a bare `node script.mjs` silently
 * targets nothing usable". A warning in a document is not a guard; this is.
 */
export function requireDatabaseUrl() {
  if (process.env.DATABASE_URL) return

  console.error(`
DATABASE_URL is not set — refusing to start.

A seeder without a database spends 15 minutes per city fetching data it cannot
write. Failing now instead.

  Local dev:   the .env in backend/ is picked up automatically. If you are
               seeing this locally, that file is missing.

  Production:  the environment lives in /etc/stayonmap/api.env, NOT in a .env,
               and the repo is owned by the 'deploy' user. Run:

  sudo -u deploy bash -c 'set -a; . /etc/stayonmap/api.env; set +a; \
    cd /srv/stayonmap/backend && node ${process.argv[1]?.split(/[\\/]/).pop() ?? 'scripts/<script>.mjs'} --confirm'
`)
  process.exit(1)
}
