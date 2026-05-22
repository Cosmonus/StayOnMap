// Shared property type definitions
// Used by both frontend (JS) and backend validation

/** @enum {string} */
export const PropertyType = {
  APARTMENT: 'APARTMENT',
  HOUSE: 'HOUSE',
  VILLA: 'VILLA',
  // Future: PG, CO_LIVING, COMMERCIAL
}

/** @enum {string} */
export const FurnishedType = {
  FULLY: 'FULLY',
  SEMI: 'SEMI',
  UNFURNISHED: 'UNFURNISHED',
}

/** @enum {string} */
export const PropertyStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
}

/**
 * @typedef {Object} PropertyPin
 * @property {string} id
 * @property {number} lat
 * @property {number} lng
 * @property {number} rent
 */

/**
 * @typedef {Object} Property
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {PropertyType} type
 * @property {FurnishedType} furnished
 * @property {PropertyStatus} status
 * @property {number} bhk
 * @property {number} rent
 * @property {number} deposit
 * @property {number} area
 * @property {boolean} parking
 * @property {string[]} amenities
 * @property {string[]} images
 * @property {number} lat
 * @property {number} lng
 * @property {string} address
 * @property {string} city
 * @property {string} ownerId
 * @property {Date} createdAt
 */
