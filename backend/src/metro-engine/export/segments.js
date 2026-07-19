// Additive per-line `segments`: the gap-split components of `path`,
// precomputed server-side so clients stop hand-duplicating the split logic
// (mobile's MetroLines.js carried its own copy of splitPathIntoComponents
// because it can't import backend code). Only written when a line genuinely
// splits — for the common single-component line, `path` IS the one segment
// and duplicating it would double the payload for nothing. `path` always
// stays present and authoritative; released mobile builds never see a
// difference.
import { splitPathIntoComponents, PATH_GAP_METERS } from '../../lib/metro-validation/index.js'

export function withSegments(network) {
  return {
    ...network,
    lines: network.lines.map((line) => {
      const components = splitPathIntoComponents(line.path, PATH_GAP_METERS).filter((c) => c.length >= 2)
      if (components.length <= 1) {
        // Strip a stale segments field left by an earlier promote of a
        // then-split line.
        const { segments: _segments, ...rest } = line
        return rest
      }
      return { ...line, segments: components }
    }),
  }
}
