// Module registry — the list of spatial intelligence modules, in render order.
//
// Adding a module is: write the file, add it here, declare `appliesTo`.
// Nothing else changes — not the service, not the API, not the frontend,
// because every module returns the same envelope (see envelope.js).
//
// Same spirit as features/properties/filters.registry.js: one list that
// generates the behaviour, rather than the same knowledge repeated in a
// service, a schema, and a UI config that drift apart.
import mobility from './modules/mobility.module.js'
import lifestyle from './modules/lifestyle.module.js'
import infrastructure from './modules/infrastructure.module.js'
import environment from './modules/environment.module.js'
import terrain from './modules/terrain.module.js'
import locality from './modules/locality.module.js'
import commerce from './modules/commerce.module.js'
import stayContext from './modules/stayContext.module.js'
import pgContext from './modules/pgContext.module.js'
import landContext from './modules/landContext.module.js'
import { appliesToType } from './propertyTypes.js'

export const MODULES = [
  // First: what this place IS, before anything about what is near it.
  locality,
  // Universal — every type needs to get somewhere and breathe something.
  mobility,
  // Type-specific. Each declares `appliesTo`; a listing only ever sees the
  // ones relevant to it. See propertyTypes.js for why this is a filter on
  // presentation rather than a fork of the cell model.
  lifestyle,
  commerce,
  pgContext,
  stayContext,
  landContext,
  infrastructure,
  environment,
  // Terrain last: it is the module most likely to be misread as a risk score,
  // so it sits after the things a renter came for rather than above them.
  terrain,
  // Phase 3: costOfLiving, propertyIntelligence.
  // See docs/spatial-intelligence.md §8.
]

export const MODULES_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m]))

/**
 * The modules a given property type should have computed and shown.
 * With no type (e.g. GET /spatial/at on a bare coordinate), everything.
 */
export function modulesFor(propertyType) {
  return MODULES.filter((m) => appliesToType(m, propertyType))
}

/**
 * A module's stored output is recomputed when its `version` moves. That makes
 * changing a formula a one-integer edit with automatic backfill, instead of a
 * migration script — and stops a cell table quietly holding a mix of results
 * from three different versions of the same calculation.
 */
export function isStale(storedEnvelope, module, now = new Date()) {
  if (!storedEnvelope) return true
  if (storedEnvelope.version !== module.version) return true
  if (!storedEnvelope.staleAfter) return true
  return new Date(storedEnvelope.staleAfter) <= now
}
