// Zod schema validation middleware factory
// Usage: router.post('/route', validate(schema), controller)
// Usage: router.get('/route', validate(schema, 'query'), controller)

export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: result.error.errors[0]?.message ?? 'Invalid input',
        statusCode: 400,
      })
    }
    // NOT `req[target] = result.data`.
    //
    // Express 5 made req.query a getter-only property, so a plain assignment
    // throws "Cannot set property query of #<IncomingMessage> which has only a
    // getter" — a 500 on every query-validated route. That shipped unnoticed in
    // the Express 4 -> 5 bump (the path-to-regexp fallout was caught, this
    // wasn't) and took down /properties, /properties/pins, /properties/count
    // and chat message search in production.
    //
    // defineProperty rewrites the property itself rather than assigning
    // through the getter, so every downstream `req.query` read is unchanged.
    // Used for all targets, not just query, so a future Express turning
    // req.body or req.params into a getter can't reintroduce this.
    Object.defineProperty(req, target, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })
    next()
  }
}
