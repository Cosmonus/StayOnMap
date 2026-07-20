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
