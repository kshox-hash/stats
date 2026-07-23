import { z } from 'zod'

// El "snapshot" ya viene agregado desde el frontend (getChartExportData) —
// acá solo garantizamos que sea un objeto serializable.
export const createEmbedSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
})

export type CreateEmbedInput = z.infer<typeof createEmbedSchema>
