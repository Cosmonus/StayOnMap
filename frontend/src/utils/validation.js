// Form validation helpers

export const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(phone)

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const isValidRent = (amount) => Number(amount) > 0 && Number(amount) <= 10_000_000
