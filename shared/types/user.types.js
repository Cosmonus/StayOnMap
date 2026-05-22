/** @enum {string} */
export const UserRole = {
  TENANT: 'TENANT',
  OWNER: 'OWNER',
}

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string|null} phone
 * @property {UserRole} role
 * @property {Date} createdAt
 */
