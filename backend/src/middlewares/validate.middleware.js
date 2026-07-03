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
    req[target] = result.data
    next()
  }
}
