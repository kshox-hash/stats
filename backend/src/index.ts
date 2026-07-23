import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboards'
import embedRoutes from './routes/embeds'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '25mb' })) // guardar un dashboard manda todas las filas del archivo subido, puede superar varios MB
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/dashboards', dashboardRoutes)
app.use('/api/embeds', embedRoutes)

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Manejador de errores genérico: sin esto, errores como "payload too large" o
// cualquier excepción no controlada devuelven una página HTML de Express en vez
// de JSON, y el frontend no puede mostrar un mensaje útil.
app.use((err: Error & { status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.status || err.statusCode || 500).json({ error: err.message || 'Error interno del servidor' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend (TS) corriendo en http://localhost:${PORT}`))
