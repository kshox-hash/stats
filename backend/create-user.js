/**
 * Uso: node create-user.js <email> <password> <nombre>
 * Ejemplo: node create-user.js ana@empresa.com Secreto123 "Ana García"
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const db     = require('./db')

const [,, email, password, name] = process.argv

if (!email || !password || !name) {
  console.error('Uso: node create-user.js <email> <password> <nombre>')
  process.exit(1)
}

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim())
if (existing) {
  console.error(`Ya existe un usuario con el email: ${email}`)
  process.exit(1)
}

const hash = bcrypt.hashSync(password, 12)
const result = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)').run(
  email.toLowerCase().trim(),
  name.trim(),
  hash
)

console.log(`Usuario creado — id: ${result.lastInsertRowid}, email: ${email}, nombre: ${name}`)
