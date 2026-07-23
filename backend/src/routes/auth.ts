import { Router, type CookieOptions } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail } from '../data/users'
import { loginSchema } from '../schemas/auth.schema'
import requireAuth from '../middleware/auth'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET as string

// En producción, frontend (Netlify) y backend (Render) viven en dominios distintos,
// así que la cookie necesita SameSite=None (y por lo tanto Secure) para viajar entre ellos.
// En desarrollo local ambos comparten origen vía el proxy de Vite, así que alcanza con Lax.
const isProd = process.env.NODE_ENV === 'production'
const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  const { email, password } = parsed.data

  const user = findUserByEmail(email)
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

  const valid = bcrypt.compareSync(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

  try {
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.cookie('token', token, COOKIE_OPTS)
    res.json({ id: user.id, email: user.email, name: user.name })
  } catch (err) {
    // Si JWT_SECRET falta o es inválido, jwt.sign explota -- esto evita el 500 genérico
    // y muestra la causa real en vez de una página de error sin información.
    res.status(500).json({ error: `Error al firmar el token: ${(err as Error).message}` })
  }
})

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

export default router
