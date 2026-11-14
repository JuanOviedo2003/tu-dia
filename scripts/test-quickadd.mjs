import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const hooks = `
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if (specifier.startsWith('.') && !/\\.[a-z]+$/i.test(specifier)) {
      return next(specifier + '.js', context)
    }
    throw err
  }
}
`
register('data:text/javascript,' + encodeURIComponent(hooks), import.meta.url)

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const modPath = path.resolve(import.meta.dirname, '../src/lib/quickAdd.js')
const { parseQuickAdd, parseQuickAddLines, splitQuickAddLines } = await import(pathToFileURL(modPath).href)

const pad = (n) => String(n).padStart(2, '0')
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const TOMORROW = dateStr(tomorrow)
const TODAY = dateStr(new Date())

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const cases = [
  ['estado por defecto', 'comprar pan', { title: 'comprar pan', status: 'todo', durationMinutes: null, doubts: [], repeat: 'none', day: null }],
  ['en progreso', 'escribir informe en progreso', { title: 'escribir informe', status: 'inprogress' }],
  ['en curso', 'migrar base de datos en curso', { title: 'migrar base de datos', status: 'inprogress' }],
  ['haciendo ya no es estado', 'Estoy haciendo ejercicio', { title: 'Estoy haciendo ejercicio', status: 'todo' }],
  ['en 2 horas no es duracion', 'llamar en 2 horas', { durationMinutes: null, doubts: [] }],
  ['en 5 minutos no es duracion', 'llamar en 5 minutos', { durationMinutes: null }],
  ['dentro de 2 horas no es duracion', 'llamar dentro de 2 horas', { durationMinutes: null }],
  ['el N seguido de sustantivo no se consume', 'comprar el 2 tomos', { title: 'comprar el 2 tomos', day: null }],
  ['el N seguido de lugar', 'pagar el 5 en casa', { day: parseQuickAdd('pagar el 5').day }],
  ['en revision con tilde', 'diseño del logo en revisión', { title: 'diseño del logo', status: 'review' }],
  ['en revision sin tilde', 'diseño del logo en revision', { title: 'diseño del logo', status: 'review' }],
  ['ya hecha', 'pagar luz ya hecha', { title: 'pagar luz', status: 'done' }],
  ['ya terminada', 'informe ya terminada', { title: 'informe', status: 'done' }],
  ['ya completada', 'limpiar casa ya completada', { title: 'limpiar casa', status: 'done' }],
  ['hecha tras coma', 'llamar al banco, hecha', { title: 'llamar al banco', status: 'done' }],
  ['lista tras guion', 'preparar slides - lista', { title: 'preparar slides', status: 'done' }],
  ['falso positivo lista de compras', 'comprar lista de compras', { title: 'comprar lista de compras', status: 'todo' }],
  ['falso positivo hecha sin coma', 'tarea hecha en casa', { title: 'tarea hecha en casa', status: 'todo' }],
  ['falso positivo revision del contrato', 'revisión del contrato', { title: 'revisión del contrato', status: 'todo' }],
  ['duracion por 2 horas', 'taller por 2 horas', { title: 'taller', durationMinutes: 120 }],
  ['duracion por 90 minutos', 'estudiar por 90 minutos', { title: 'estudiar', durationMinutes: 90 }],
  ['duracion durante 1h30', 'ensayo durante 1h30', { title: 'ensayo', durationMinutes: 90 }],
  ['duracion 1h30 suelta', 'ensayo 1h30', { title: 'ensayo', durationMinutes: 90 }],
  ['duracion 2h', 'clase 2h', { title: 'clase', durationMinutes: 120 }],
  ['duracion 45 min', 'llamada 45 min', { title: 'llamada', durationMinutes: 45 }],
  ['duracion media hora', 'caminar media hora', { title: 'caminar', durationMinutes: 30 }],
  ['duracion una hora', 'yoga una hora', { title: 'yoga', durationMinutes: 60 }],
  ['duracion de 1 hora', 'reunion de 1 hora', { title: 'reunion', durationMinutes: 60 }],
  ['duracion fuera de rango alto', 'maraton por 20 horas', { durationMinutes: null, doubts: ['duration-ignored'] }],
  ['duracion fuera de rango bajo', 'pausa por 2 minutos', { durationMinutes: null, doubts: ['duration-ignored'] }],
  ['hora de inicio no es duracion', 'cita hoy a las 3pm', { title: 'cita', durationMinutes: null, startMinutes: 15 * 60, day: TODAY, doubts: [] }],
  ['recurrencia no es duracion', 'revisar metas cada 2 semanas', { durationMinutes: null }],
  ['recurrencia intacta semana', 'gimnasio cada semana', { title: 'gimnasio', repeat: 'week', status: 'todo', durationMinutes: null, doubts: [] }],
  ['recurrencia intacta mes', 'pagar alquiler cada mes', { title: 'pagar alquiler', repeat: 'month' }],
  ['combinacion completa', 'reunión con Ana mañana 10am por 2 horas en progreso', { title: 'reunión con Ana', day: TOMORROW, startMinutes: 600, durationMinutes: 120, status: 'inprogress', doubts: [] }],
  ['combinacion revision + minutos', 'demo mañana 16:00 45 min en revisión', { title: 'demo', day: TOMORROW, startMinutes: 960, durationMinutes: 45, status: 'review', doubts: [] }],
  ['duda hora sin meridiem', 'cita mañana a las 3', { startMinutes: 180, doubts: ['time-without-meridiem'] }],
  ['sin duda con pm', 'cita mañana a las 3pm', { startMinutes: 900, doubts: [] }],
  ['sin duda hora 24h', 'cita mañana a las 15:00', { startMinutes: 900, doubts: [] }],
  ['duda titulo vacio', 'mañana 10am', { title: '', doubts: ['title-empty'] }],
  ['sin fecha', 'comprar pan sin fecha', { title: 'comprar pan', day: null, unscheduled: true }],
  ['sin programar', 'llamar a Ana sin programar', { title: 'llamar a Ana', day: null, unscheduled: true }],
  ['algun dia con tilde', 'aprender piano algún día', { title: 'aprender piano', day: null, unscheduled: true }],
  ['sin fecha anula la fecha', 'dentista mañana sin fecha', { title: 'dentista mañana', day: null, unscheduled: true }],
  ['sin fecha no se activa sola', 'comprar pan', { unscheduled: false }],
  ['compatibilidad dia y hora', 'dentista mañana 15:00', { title: 'dentista', day: TOMORROW, startMinutes: 900, repeat: 'none' }],
]

const rows = cases.map(([name, input, expected]) => {
  const result = parseQuickAdd(input)
  const failed = Object.keys(expected).filter((k) => !same(result?.[k], expected[k]))
  return { name, ok: failed.length === 0, detail: failed.map((k) => `${k}: esperado ${JSON.stringify(expected[k])}, obtuvo ${JSON.stringify(result?.[k])}`).join(' | ') }
})

const lines = parseQuickAddLines('comprar pan\n\n  gimnasio cada semana  \r\nllamar mañana 10am en progreso\n')
rows.push({
  name: 'varias lineas ignora vacias',
  ok: lines.length === 3 && lines[0].title === 'comprar pan' && lines[1].repeat === 'week' && lines[2].status === 'inprogress',
  detail: JSON.stringify(lines.map((l) => l.title)),
})

const hidden = parseQuickAddLines(Array.from({ length: 25 }, (_, i) => `tarea ${i}`).join('\n'))
rows.push({ name: 'splitQuickAddLines cuenta todas', ok: splitQuickAddLines(Array.from({ length: 25 }, (_, i) => `t${i}`).join('\n')).length === 25 && hidden.length === 20, detail: '' })
const many = parseQuickAddLines(Array.from({ length: 30 }, (_, i) => `tarea ${i}`).join('\n'))
rows.push({ name: 'varias lineas maximo 20', ok: many.length === 20, detail: `obtuvo ${many.length}` })
rows.push({ name: 'entrada vacia', ok: parseQuickAdd('   ') === null && same(parseQuickAddLines(''), []), detail: '' })

const dayOnly = parseQuickAdd('pagar el 5')
const passedThisMonth = new Date().getDate() > 5
const rolledOver = new Date(dayOnly.day + 'T00:00:00').getMonth() !== new Date().getMonth()
rows.push({
  name: 'duda fecha ambigua coherente',
  ok: dayOnly.title === 'pagar' && rolledOver === passedThisMonth && dayOnly.doubts.includes('ambiguous-date') === passedThisMonth,
  detail: JSON.stringify(dayOnly),
})

let failures = 0
for (const [i, r] of rows.entries()) {
  if (!r.ok) failures++
  console.log(`${String(i + 1).padStart(2)}  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`)
}
console.log(`\n${rows.length - failures}/${rows.length} PASS`)
process.exit(failures ? 1 : 0)
