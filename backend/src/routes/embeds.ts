import { Router } from 'express'
import crypto from 'crypto'
import db from '../db'
import requireAuth from '../middleware/auth'
import { createEmbedSchema } from '../schemas/embed.schema'

const router = Router()

// POST /api/embeds — crear un snapshot para compartir/incrustar.
// Requiere sesión: solo un usuario logueado puede publicar un embed.
router.post('/', requireAuth, (req, res) => {
  const parsed = createEmbedSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  const id = crypto.randomBytes(9).toString('base64url')
  db.prepare('INSERT INTO embeds (id, user_id, payload) VALUES (?, ?, ?)')
    .run(id, req.user!.id, JSON.stringify(parsed.data.payload))
  res.json({ id })
})

// GET /api/embeds/:id — ver un embed. PÚBLICO a propósito (sin requireAuth):
// es lo que carga el <iframe> en cualquier otra página, sin sesión.
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT payload FROM embeds WHERE id = ?').get(req.params.id) as
    { payload: string } | undefined
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  res.json(JSON.parse(row.payload))
})

export default router
