// Zod schema validation middleware factory
// Usage: router.post('/route', validate(schema), controller)

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: result.error.errors[0]?.message ?? 'Invalid input',
        statusCode: 400,
      })
    }
    req.body = result.data
    next()
  }
}
