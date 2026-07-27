import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every notification is addressed to ONE hat — the tenant or the owner — and
// the clients filter on it (see Notification.audience in schema.prisma).
// Omitting `audience` is legal and means "unclassified", which shows in BOTH
// modes: a safety net for old rows, not a default for new code. Nothing at the
// type level catches a new call site that forgets it, and the symptom is quiet
// — a host sees a notification about a flat they're renting — so the check
// lives here.
const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function jsFilesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return jsFilesUnder(full)
    return full.endsWith('.js') ? [full] : []
  })
}

// The call's argument object, from `notifyUser(` to the matching close brace.
// Crude on purpose: a real parser here would be more code than the rule.
function notifyUserCalls(source) {
  const calls = []
  let from = 0
  for (;;) {
    const start = source.indexOf('notifyUser(', from)
    if (start === -1) return calls
    from = start + 1
    let depth = 0
    for (let i = start + 'notifyUser('.length - 1; i < source.length; i++) {
      const ch = source[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          calls.push(source.slice(start, i + 1))
          break
        }
      }
    }
  }
}

describe('notification audience', () => {
  it('every notifyUser() call names the hat it is addressed to', () => {
    const offenders = []

    for (const file of jsFilesUnder(SRC)) {
      const source = readFileSync(file, 'utf8')
      // The definition itself, not a call.
      if (file.endsWith(join('notifications', 'notifications.service.js'))) continue

      for (const call of notifyUserCalls(source)) {
        if (!/\baudience\s*:/.test(call)) {
          offenders.push(`${file.replace(SRC, '')} — ${call.slice(0, 90).replace(/\s+/g, ' ')}…`)
        }
      }
    }

    expect(offenders, `notifyUser() without an audience:\n${offenders.join('\n')}`).toEqual([])
  })

  it('only uses hats the NotificationAudience enum declares', () => {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
    const block = schema.match(/enum NotificationAudience \{([^}]*)\}/)
    expect(block, 'NotificationAudience enum is missing from schema.prisma').toBeTruthy()
    const declared = block[1].split('\n').map((l) => l.trim()).filter(Boolean)
    expect(new Set(declared)).toEqual(new Set(['TENANT', 'OWNER']))

    const used = new Set()
    for (const file of jsFilesUnder(SRC)) {
      for (const call of notifyUserCalls(readFileSync(file, 'utf8'))) {
        for (const [, hat] of call.matchAll(/\baudience\s*:\s*'([A-Z_]+)'/g)) used.add(hat)
      }
    }
    for (const hat of used) expect(declared).toContain(hat)
  })
})
