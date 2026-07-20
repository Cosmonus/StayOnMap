// Shared between auth.service (login/register/OTP), session.service (refresh
// rotation) and oauth.service (social login) — lives here so none of them has
// to import another's whole module.
import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'

export function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  )
}

export function stripPasswordHash(user) {
  const { passwordHash: _passwordHash, ...rest } = user
  return rest
}
