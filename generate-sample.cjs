const XLSX = require('xlsx')
const path = require('path')

const wb = XLSX.utils.book_new()

// Hoja 1: Ventas mensuales (buena para barras, líneas, área)
const ventas = [
  { Mes: 'Enero',      Ventas: 42000, Gastos: 28000, Ganancia: 14000 },
  { Mes: 'Febrero',    Ventas: 38000, Gastos: 25000, Ganancia: 13000 },
  { Mes: 'Marzo',      Ventas: 55000, Gastos: 31000, Ganancia: 24000 },
  { Mes: 'Abril',      Ventas: 47000, Gastos: 29000, Ganancia: 18000 },
  { Mes: 'Mayo',       Ventas: 61000, Gastos: 35000, Ganancia: 26000 },
  { Mes: 'Junio',      Ventas: 58000, Gastos: 33000, Ganancia: 25000 },
  { Mes: 'Julio',      Ventas: 72000, Gastos: 40000, Ganancia: 32000 },
  { Mes: 'Agosto',     Ventas: 69000, Gastos: 38000, Ganancia: 31000 },
  { Mes: 'Septiembre', Ventas: 53000, Gastos: 30000, Ganancia: 23000 },
  { Mes: 'Octubre',    Ventas: 64000, Gastos: 36000, Ganancia: 28000 },
  { Mes: 'Noviembre',  Ventas: 78000, Gastos: 44000, Ganancia: 34000 },
  { Mes: 'Diciembre',  Ventas: 95000, Gastos: 52000, Ganancia: 43000 },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas), 'Ventas Mensuales')

// Hoja 2: Ventas por producto (buena para torta)
const productos = [
  { Producto: 'Laptops',    Ventas: 85000 },
  { Producto: 'Monitores',  Ventas: 42000 },
  { Producto: 'Teclados',   Ventas: 18000 },
  { Producto: 'Mouses',     Ventas: 12000 },
  { Producto: 'Auriculares',Ventas: 27000 },
  { Producto: 'Webcams',    Ventas: 15000 },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productos), 'Por Producto')

// Hoja 3: Datos de dispersión (buena para scatter)
const scatter = Array.from({ length: 30 }, (_, i) => ({
  Presupuesto: Math.round(10000 + Math.random() * 90000),
  Retorno:     Math.round(5000  + Math.random() * 80000),
}))
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scatter), 'Dispersión')

const outPath = path.join(__dirname, 'datos-ejemplo.xlsx')
XLSX.writeFile(wb, outPath)
console.log('Archivo creado:', outPath)
