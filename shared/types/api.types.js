/**
 * Standard API response envelope
 *
 * @template T
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {T} data
 * @property {string} message
 * @property {Object} [meta]      pagination, totals
 */

/**
 * @typedef {Object} ApiError
 * @property {boolean} success    always false
 * @property {string} error       error code
 * @property {string} message     human-readable
 * @property {number} statusCode
 */

/**
 * @typedef {Object} PaginationMeta
 * @property {number} total
 * @property {number} page
 * @property {number} limit
 * @property {number} totalPages
 */
