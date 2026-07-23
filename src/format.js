// Formato de número compartido por todos los gráficos y KPIs.
// 'auto' es el comportamiento original (abrevia a K/M); las demás son las
// opciones que se pueden elegir por gráfico desde ChartConfig.
export function formatValue(n, mode = 'auto') {
  if (!isFinite(n)) return ''
  switch (mode) {
    case 'currency':
      return '$' + Math.round(n).toLocaleString('es-CL')
    case 'percent':
      return (n * 100).toFixed(1) + '%'
    case 'plain':
      return Number.isInteger(n) ? n.toLocaleString('es-CL') : n.toFixed(2)
    case 'auto':
    default:
      if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
      if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
      return Number.isInteger(n) ? n.toLocaleString('es-CL') : n.toFixed(2)
  }
}

// Devuelve el tamaño de fuente más grande de la lista que entra en maxWidth,
// o 0 si ni el más chico entra (ahí se prefiere ocultar la etiqueta a que se solape).
export function fitLabelFontSize(text, maxWidth, sizes = [9, 8, 7]) {
  for (const size of sizes) {
    if (text.length * size * 0.62 <= maxWidth) return size
  }
  return 0
}
