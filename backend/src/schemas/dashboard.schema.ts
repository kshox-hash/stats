import { z } from 'zod'

// El contenido de "config" es el snapshot completo del dashboard del frontend
// (páginas, gráficos, filas, config por gráfico, etc.) — su forma interna evoluciona
// del lado del cliente, así que acá solo garantizamos que sea un objeto serializable.
const configSchema = z.record(z.string(), z.unknown())

export const createDashboardSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  config: configSchema,
})

export const updateDashboardSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(120),
  config: configSchema,
})

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>
