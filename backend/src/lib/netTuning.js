// Node's connection-attempt timeout is too aggressive for intercontinental links.
//
// Imported for its side effect, once, at every entry point. The setting is
// process-global, so importing it anywhere later would be a race.
//
// THE BUG, measured on the production VM 2026-07-28:
//
//   overpass-api.de   ETIMEDOUT in  573 ms   ← before
//   overpass-api.de   HTTP 200   in 1180 ms   ← after
//
// Node races connection attempts across resolved addresses (Happy Eyeballs) and
// abandons each after `autoSelectFamilyAttemptTimeout`, which defaults to
// 250 ms. A TCP + TLS handshake from a Google Cloud VM in India to a host in
// Europe needs three round trips — comfortably more than 250 ms. Node was
// hanging up mid-handshake and reporting the result as ETIMEDOUT, which reads
// exactly like "the host is down".
//
// It was not down. `curl` reached the same host fine, because curl has no such
// limit — which is what made this take so long to find: every manual check said
// the network was healthy while every Node request failed.
//
// This is NOT an Overpass problem. It affects EVERY outbound fetch from that
// box — Open-Meteo, OpenTopoData, ESA WorldCover, CPCB — and any of them can
// fail this way while looking, from a shell, perfectly reachable. Chennai's
// environment module reading "0 of 4 inputs" in production while Open-Meteo
// answered that coordinate on demand is very likely this same bug.
//
// 5 s is chosen to clear a three-round-trip handshake to Europe with room to
// spare, while still being far below any request timeout — a genuinely dead
// host still fails on its own timeout, not on this one.
import net from 'node:net'

net.setDefaultAutoSelectFamilyAttemptTimeout(5000)
