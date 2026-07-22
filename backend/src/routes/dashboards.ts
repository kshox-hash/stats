import { Router } from 'express'
import db from '../db'
import requireAuth from '../middleware/auth'
import { createDashboardSchema, updateDashboardSchema } from '../schemas/dashboard.schema'
import type { DashboardRow } from '../types'

const router = Router()
router.use(requireAuth)

// GET /api/dashboards — listar los del usuario
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, name, updated_at FROM dashboards WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user!.id)
  res.json(rows)
})

// POST /api/dashboards — crear
router.post('/', (req, res) => {
  const parsed = createDashboardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  const { name, config } = parsed.data
  const r = db.prepare('INSERT INTO dashboards (user_id, name, config) VALUES (?, ?, ?)')
    .run(req.user!.id, name, JSON.stringify(config))
  res.json({ id: r.lastInsertRowid, name })
})

// PUT /api/dashboards/:id — actualizar
router.put('/:id', (req, res) => {
  const parsed = updateDashboardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
  }
  const { name, config } = parsed.data
  const existing = db.prepare('SELECT id FROM dashboards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id)
  if (!existing) return res.status(404).json({ error: 'No encontrado' })

  db.prepare("UPDATE dashboards SET name = ?, config = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, JSON.stringify(config), req.params.id)
  res.json({ ok: true })
})

// GET /api/dashboards/:id — cargar uno
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM dashboards WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as DashboardRow | undefined
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  res.json({ ...row, config: JSON.parse(row.config) })
})

// DELETE /api/dashboards/:id — borrar
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM dashboards WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id)
  res.json({ ok: true })
})

export default router
