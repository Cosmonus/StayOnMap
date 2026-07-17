import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
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

export const updateRoleSchema = z.object({
  role: z.enum(['OWNER']),
})
