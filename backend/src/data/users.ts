import type { User } from '../types'

// Usuarios de prueba, tipados y guardados en este archivo por ahora.
// TODO: reemplazar por una tabla real (users) cuando se conecte una base de datos definitiva.
// Contraseña de "Demo Usuario": demo1234
export const users: User[] = [
  {
    id: 1,
    email: 'demo@demo.com',
    name: 'Demo Usuario',
    passwordHash: '$2b$10$PeYni6uMRg1VLvetzaKAo.9JwSpjbZTdl40W2J7WubKM/CLI6CJ02',
  },
]

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.toLowerCase().trim()
  return users.find(u => u.email === normalized)
}
