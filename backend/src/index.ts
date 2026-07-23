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
app.use(express.json({ limit: '5mb' })) // snapshots de gráficos con muchas categorías pueden pesar más que el default de 100kb
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/dashboards', dashboardRoutes)
app.use('/api/embeds', embedRoutes)

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend (TS) corriendo en http://localhost:${PORT}`))
