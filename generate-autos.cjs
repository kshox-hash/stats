const XLSX = require('xlsx')

const MARCAS = ['Toyota','Ford','Chevrolet','Volkswagen','Honda','Nissan','Renault','Peugeot','Fiat','Hyundai']
const MODELOS = {
  Toyota:     ['Corolla','Hilux','RAV4','Yaris','Camry'],
  Ford:       ['Ranger','Focus','Fiesta','EcoSport','Mustang'],
  Chevrolet:  ['Onix','Cruze','S10','Tracker','Montana'],
  Volkswagen: ['Gol','Polo','Amarok','Tiguan','Vento'],
  Honda:      ['Civic','HR-V','CR-V','Fit','City'],
  Nissan:     ['Frontier','Versa','Kicks','March','Sentra'],
  Renault:    ['Kwid','Sandero','Duster','Logan','Megane'],
  Peugeot:    ['208','308','2008','3008','Partner'],
  Fiat:       ['Uno','Argo','Cronos','Pulse','Strada'],
  Hyundai:    ['HB20','Tucson','Creta','i30','Santa Fe'],
}
const SERVICIOS = [
  'Cambio de aceite','Cambio de frenos','Alineación y balanceo','Cambio de neumáticos',
  'Revisión general','Cambio de batería','Reparación de motor','Cambio de correa de distribución',
  'Cambio de amortiguadores','Revisión de suspensión','Cambio de filtros','Reparación de transmisión',
  'Cambio de bujías','Diagnóstico computarizado','Revisión de aire acondicionado',
]
const TECNICOS  = ['Carlos Méndez','María López','Jorge Ramírez','Ana Gómez','Luis Herrera','Sofía Castro']
const ESTADOS   = ['Completado','En proceso','Pendiente','Entregado','En garantía']
const CLIENTES  = [
  'Juan García','María Rodríguez','Carlos Martínez','Laura Sánchez','Pedro López',
  'Ana Torres','Luis Pérez','Carmen Díaz','Roberto Núñez','Isabel Flores',
  'Fernando Morales','Elena Vargas','Andrés Castro','Patricia Jiménez','Miguel Ortiz',
  'Valentina Reyes','Diego Herrera','Natalia Guerrero','Sebastián Molina','Camila Ramos',
]

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randDate(daysBack) {
  const d = new Date()
  d.setDate(d.getDate() - randInt(0, daysBack))
  return d.toISOString().slice(0, 10)
}

const rows = []
for (let i = 0; i < 200; i++) {
  const marca   = rand(MARCAS)
  const modelo  = rand(MODELOS[marca])
  const anio    = randInt(2005, 2024)
  const servicio = rand(SERVICIOS)
  const estado  = rand(ESTADOS)

  // Costo base por tipo de servicio
  const costos = {
    'Cambio de aceite': [45, 95],
    'Cambio de frenos': [120, 280],
    'Alineación y balanceo': [40, 80],
    'Cambio de neumáticos': [200, 600],
    'Revisión general': [80, 160],
    'Cambio de batería': [90, 180],
    'Reparación de motor': [500, 2500],
    'Cambio de correa de distribución': [250, 550],
    'Cambio de amortiguadores': [200, 500],
    'Revisión de suspensión': [100, 250],
    'Cambio de filtros': [35, 75],
    'Reparación de transmisión': [400, 1800],
    'Cambio de bujías': [60, 140],
    'Diagnóstico computarizado': [50, 100],
    'Revisión de aire acondicionado': [80, 200],
  }
  const [cMin, cMax] = costos[servicio]
  const costo = randInt(cMin, cMax)

  const tiempoHoras = servicio.includes('Reparación') || servicio.includes('distribución') || servicio.includes('transmisión')
    ? randInt(4, 16) : randInt(1, 5)

  rows.push({
    'Fecha':         randDate(365),
    'Cliente':       rand(CLIENTES),
    'Marca':         marca,
    'Modelo':        modelo,
    'Año':           anio,
    'Kilometraje':   randInt(5000, 280000),
    'Servicio':      servicio,
    'Técnico':       rand(TECNICOS),
    'Estado':        estado,
    'Costo ($)':     costo,
    'Tiempo (hs)':   tiempoHoras,
    'Repuestos ($)': Math.round(costo * (0.3 + Math.random() * 0.4)),
    'Satisfacción':  estado === 'Completado' || estado === 'Entregado' ? randInt(3, 5) : null,
  })
}

// Ordenar por fecha
rows.sort((a, b) => a['Fecha'].localeCompare(b['Fecha']))

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Taller')
XLSX.writeFile(wb, 'taller-mecanico.xlsx')

console.log(`✓ Generado taller-mecanico.xlsx con ${rows.length} registros`)
