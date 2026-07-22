export interface User {
  id: number
  email: string
  name: string
  passwordHash: string
}

export interface AuthTokenPayload {
  id: number
  email: string
  name: string
}

export interface DashboardRow {
  id: number
  user_id: number
  name: string
  config: string
  updated_at: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload
    }
  }
}
