import { z } from 'zod'

// Applied to NEW passwords only (signup + reset) — existing passwords keep
// working, so tightening this never locks anyone out.
export const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(200)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character')

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email(),
  password: strongPassword,
  city: z.string().trim().min(1, 'City is required').max(100),
  role: z.enum(['TENANT', 'OWNER']).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: strongPassword,
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
})

// Logout is best-effort — a missing/garbage token still returns 200, because
// the client is throwing its copy away regardless.
export const logoutSchema = z.object({
  refreshToken: z.string().max(200).optional(),
})

export const oauthCompleteSchema = z.object({
  token: z.string().min(20), // the pending-signup JWT from the callback
  city: z.string().trim().min(1, 'City is required').max(100),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
})

export const requestOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  // Exactly 6 digits — rejects a padded/whitespaced code at the edge so the
  // service never burns an attempt on input that could not have been issued.
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

// Same rule users.validation.js applies to a saved phone — a number this
// rejects could never be stored, so accepting it here would spend an SMS on a
// verification that could not land anywhere.
export const requestPhoneCodeSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
})

export const verifyPhoneCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

// Signing IN with a phone number. Same phone rule as above; the code travels
// WITH the number because this flow is unauthenticated and there is no session
// to say whose code it is.
export const phoneLoginRequestSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
})

export const phoneLoginVerifySchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export const updateRoleSchema = z.object({
  role: z.enum(['OWNER']),
})
