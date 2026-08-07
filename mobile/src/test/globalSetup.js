// The suite runs in IST, always.
//
// The app reads LOCAL wall-clock time in the places that matter — which visit
// slots are still bookable today, and which calendar day "Today" is — because
// that is what the person holding the phone means. Every one of those rules is
// therefore timezone-dependent, and the product is India-only.
//
// Without this, AppointmentForm's tests passed on a developer machine in IST
// and failed in CI, which runs UTC: a fixture at 10:00 IST is 04:30 UTC, so the
// runner's local clock disagreed with the fixture about what time it was and
// about which day it was. A test that only passes in one timezone is worse than
// no test — it turns "green" into a fact about the machine.
//
// Pinned here rather than in the npm script (`TZ=... jest` is not portable to
// PowerShell) or in setupFiles (V8 caches the zone on first Date use, and the
// setup file is not always first). globalSetup runs before any worker is
// spawned, and workers inherit the environment.
//
// It also keeps the midnight regression test meaningful: "Today" resolving to
// yesterday is a bug that only exists at a POSITIVE UTC offset, so under a UTC
// runner that test would pass against the broken code it was written for.
module.exports = async () => {
  process.env.TZ = 'Asia/Kolkata'
}
