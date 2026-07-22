import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthTokenPayload } from '../types'

const JWT_SECRET = process.env.JWT_SECRET as string

export default function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthTokenPayload
    next()
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' })
  }
}
