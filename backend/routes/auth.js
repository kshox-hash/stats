const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const db      = require('../db')
const requireAuth = require('../middleware/auth')

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

  const valid = bcrypt.compareSync(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.cookie('token', token, COOKIE_OPTS)
  res.json({ id: user.id, email: user.email, name: user.name })
})

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name })
})

module.exports = router
