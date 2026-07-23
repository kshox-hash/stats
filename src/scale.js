// Escala del eje Y (lineal o logarítmica) compartida por Barras, Líneas y Área.
// La logarítmica comprime los valores grandes y expande los chicos, para que un
// outlier extremo no aplaste al resto contra el cero — igual que el toggle
// "Lineal / Logarítmica" del panel de formato del eje en Power BI.
// No se aplica a Cascada porque puede tener valores negativos y el logaritmo
// de un negativo no está definido.

export function niceLinearTicks(max, count = 5) {
  if (max <= 0) return [0, 1]
  const raw  = max / (count - 1)
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) ?? mag * 10
  const ticks = []
  for (let v = 0; v <= max * 1.05; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)))
    if (ticks.length > count + 1) break
  }
  return ticks
}

// maxCount limita cuántas décadas se muestran — si el rango cubre muchas (ej. de
// 10 a mil millones), se salta de a 2 o de a 5 décadas para que las líneas/etiquetas
// del eje no se amontonen y se solapen en un gráfico de altura fija. El paso se
// mantiene constante en todo el eje (no se fuerza a incluir la década exacta del
// máximo), para que las líneas queden siempre parejas — forzarla generaba a veces
// dos líneas pegadas arriba, rompiendo el espaciado.
export function niceLogTicks(max, maxCount = 6) {
  if (max <= 0) return [0, 1]
  const maxExp   = Math.ceil(Math.log10(max + 1))
  const decades  = maxExp + 1
  const expStep  = Math.max(1, Math.ceil(decades / maxCount))
  const ticks = [0]
  for (let e = 0; e <= maxExp; e += expStep) ticks.push(Math.pow(10, e))
  return ticks
}

// Devuelve una función que normaliza un valor a [0,1] según el modo de escala elegido
export function makeYScale(max, mode) {
  if (mode === 'log') {
    const denom = Math.log10(Math.max(max, 1) + 1)
    return v => Math.max(0, Math.min(1, Math.log10(Math.max(0, v) + 1) / (denom || 1)))
  }
  const m = max || 1
  return v => Math.max(0, Math.min(1, v / m))
}
