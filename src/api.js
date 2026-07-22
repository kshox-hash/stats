// En desarrollo, las rutas relativas /api/* funcionan por el proxy de Vite (vite.config.js).
// En producción (Netlify), el backend vive en otro dominio (Render), así que hace falta
// la URL completa — se configura con la variable de entorno VITE_API_URL en el build.
const API_BASE = import.meta.env.VITE_API_URL || ''

export function apiUrl(path) {
  return `${API_BASE}${path}`
}
