// The axios interceptor rejects with the response BODY, so `err.response` does
// not exist on a rejection — `err.message` is the server's own message.
//
// `lib/api.js` does `Promise.reject(err.response?.data ?? err)`, exactly as web
// does. Four files still reached through a `.response` wrapper that had already
// been unwrapped for them, so every one of those alerts fell back to "Please
// try again" and threw away what the server actually said — including the
// specific ones worth reading: "That number is verified on another account",
// "Your account has been blocked".
//
// Found on 2026-08-10 by the web port of this lint, then found again here. It
// is invisible in review because the code looks MORE careful than the correct
// version: `err?.response?.data?.message` reads as defensive, and every `?.`
// in it is doing nothing but hiding the mistake.
const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const SRC = join(__dirname, '..')

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.js$/.test(e.name) ? [p] : []
})

describe('error message reads', () => {
  it('never reach through err.response — the interceptor already unwrapped it', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.includes('.test.'))
      // lib/api.js is where the unwrapping is DONE, so it is the one place
      // err.response legitimately appears.
      .filter((f) => !f.endsWith(join('lib', 'api.js')))
      // Comments stripped first: `sendError.js` EXPLAINS this exact rejection
      // shape in prose, and a lint that fails on a file for describing the bug
      // it avoids teaches people to stop writing the explanation.
      .filter((f) => /err(or)?\??\.response\??\.\s*data/.test(
        readFileSync(f, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1'),
      ))
      .map((f) => f.replace(SRC, '').replace(/\\/g, '/'))

    expect(offenders).toEqual([])
  })
})
