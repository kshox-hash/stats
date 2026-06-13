require('dotenv').config()
const express      = require('express')
const cookieParser = require('cookie-parser')
const cors         = require('cors')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth',       require('./routes/auth'))
app.use('/api/dashboards', require('./routes/dashboards'))

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Backend corriendo en http://localhost:${PORT}`))
