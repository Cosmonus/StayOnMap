// Standardized response helpers

export const ok = (res, data, message = 'Success', meta = null) =>
  res.status(200).json({ success: true, data, message, ...(meta && { meta }) })

export const created = (res, data, message = 'Created') =>
  res.status(201).json({ success: true, data, message })

export const noContent = (res) => res.status(204).send()

export const notFound = (res, message = 'Not found') =>
  res.status(404).json({ success: false, error: 'NOT_FOUND', message, statusCode: 404 })

export const forbidden = (res, message = 'Forbidden') =>
  res.status(403).json({ success: false, error: 'FORBIDDEN', message, statusCode: 403 })
