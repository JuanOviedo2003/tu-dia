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
const { parseQuickAdd, parseQuickAddLines, splitQuickAddLines, highlightSegments, tidyTitle } = await import(pathToFileURL(modPath).href)
const { habitFor, templateFor } = await import(pathToFileURL(path.resolve(import.meta.dirname, '../src/lib/habits.js')).href)


const pad = (n) => String(n).padStart(2, '0')
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const REF = new Date(2026, 10, 14, 10, 30)
const at = (y, m, d) => dateStr(new Date(y, m - 1, d))
const TODAY = at(2026, 11, 14)
const TOMORROW = at(2026, 11, 15)
const parse = (input) => parseQuickAdd(input, REF)

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
  ['el N seguido de lugar', 'pagar el 5 en casa', { day: parse('pagar el 5').day }],
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
  ['pasado manana', 'dentista pasado mañana', { title: 'dentista', day: at(2026, 11, 16) }, [['date', 'pasado mañana']]],
  ['en 3 dias', 'pagar en 3 días', { title: 'pagar', day: at(2026, 11, 17) }, [['date', 'en 3 días']]],
  ['en 2 semanas', 'revisión médica en 2 semanas', { title: 'revisión médica', day: at(2026, 11, 28) }, [['date', 'en 2 semanas']]],
  ['en un mes', 'renovar seguro en un mes', { title: 'renovar seguro', day: at(2026, 12, 14) }, [['date', 'en un mes']]],
  ['proximo lunes', 'entregar informe el próximo lunes', { title: 'entregar informe', day: at(2026, 11, 16) }, [['date', 'el próximo lunes']]],
  ['lunes que viene', 'reunión el lunes que viene', { title: 'reunión', day: at(2026, 11, 16) }, [['date', 'el lunes que viene']]],
  ['sabado que viene es el siguiente', 'fútbol el sábado que viene', { title: 'fútbol', day: at(2026, 11, 21) }, [['date', 'el sábado que viene']]],
  ['este viernes', 'cena este viernes', { title: 'cena', day: at(2026, 11, 20) }, [['date', 'este viernes']]],
  ['fin de mes', 'pagar luz fin de mes', { title: 'pagar luz', day: at(2026, 11, 30) }, [['date', 'fin de mes']]],
  ['a fin de mes', 'cerrar caja a fin de mes', { title: 'cerrar caja', day: at(2026, 11, 30) }, [['date', 'a fin de mes']]],
  ['a principios de mes', 'alquiler a principios de mes', { title: 'alquiler', day: at(2026, 12, 1) }, [['date', 'a principios de mes']]],
  ['a mediados de mes', 'informe a mediados de mes', { title: 'informe', day: at(2026, 11, 15) }, [['date', 'a mediados de mes']]],
  ['15 de enero', 'cumpleaños 15 de enero', { title: 'cumpleaños', day: at(2027, 1, 15) }, [['date', '15 de enero']]],
  ['15/01', 'cumpleaños 15/01', { title: 'cumpleaños', day: at(2027, 1, 15) }, [['date', '15/01']]],
  ['el 20 del mes actual', 'pagar el 20', { title: 'pagar', day: at(2026, 11, 20), doubts: [] }, [['date', 'el 20']]],
  ['hoy', 'llamar hoy', { title: 'llamar', day: TODAY }, [['date', 'hoy']]],
  ['esta noche', 'cenar esta noche', { title: 'cenar', day: TODAY, startMinutes: 21 * 60, doubts: [] }, [['date', 'esta noche']]],
  ['esta tarde', 'estudiar esta tarde', { title: 'estudiar', day: TODAY, startMinutes: 16 * 60 }, [['date', 'esta tarde']]],
  ['esta manana', 'correr esta mañana', { title: 'correr', day: TODAY, startMinutes: 9 * 60 }, [['date', 'esta mañana']]],
  ['esta noche con hora', 'cine esta noche a las 10', { title: 'cine', day: TODAY, startMinutes: 22 * 60, doubts: [] }, [['date', 'esta noche'], ['time', 'a las 10']]],
  ['esta tarde con hora 24h', 'cita esta tarde 17:30', { title: 'cita', day: TODAY, startMinutes: 17 * 60 + 30 }, [['date', 'esta tarde'], ['time', '17:30']]],
  ['mediodia', 'comer mañana a mediodía', { title: 'comer', day: TOMORROW, startMinutes: 720, doubts: [] }, [['date', 'mañana'], ['time', 'a mediodía']]],
  ['medianoche es 23:59 del dia indicado', 'fiesta mañana a medianoche', { title: 'fiesta', day: TOMORROW, startMinutes: 23 * 60 + 59 }, [['date', 'mañana'], ['time', 'a medianoche']]],
  ['medianoche sin dia es hoy', 'entrega a medianoche', { title: 'entrega', day: TODAY, startMinutes: 23 * 60 + 59 }, [['time', 'a medianoche']]],
  ['y media', 'dentista mañana a las 3 y media de la tarde', { title: 'dentista', day: TOMORROW, startMinutes: 15 * 60 + 30, doubts: [] }, [['date', 'mañana'], ['time', 'a las 3 y media de la tarde']]],
  ['y media sin meridiem duda', 'dentista mañana a las 3 y media', { startMinutes: 3 * 60 + 30, doubts: ['time-without-meridiem'] }, [['date', 'mañana'], ['time', 'a las 3 y media']]],
  ['y cuarto', 'yoga hoy a las 6 y cuarto pm', { title: 'yoga', day: TODAY, startMinutes: 18 * 60 + 15, doubts: [] }, [['date', 'hoy'], ['time', 'a las 6 y cuarto pm']]],
  ['menos cuarto', 'tren hoy a las 4 menos cuarto pm', { title: 'tren', day: TODAY, startMinutes: 15 * 60 + 45 }, [['date', 'hoy'], ['time', 'a las 4 menos cuarto pm']]],
  ['15h', 'reunión mañana 15h', { title: 'reunión', day: TOMORROW, startMinutes: 900, durationMinutes: null }, [['date', 'mañana'], ['time', '15h']]],
  ['a las 15h', 'reunión mañana a las 15h', { title: 'reunión', startMinutes: 900, durationMinutes: null, doubts: [] }, [['date', 'mañana'], ['time', 'a las 15h']]],
  ['2h sigue siendo duracion', 'clase mañana 2h', { title: 'clase', durationMinutes: 120, startMinutes: 540 }, [['date', 'mañana'], ['duration', '2h']]],
  ['3pm', 'café hoy 3pm', { title: 'café', startMinutes: 900 }, [['date', 'hoy'], ['time', '3pm']]],
  ['rango con pm', 'reunión mañana de 3 a 4pm', { title: 'reunión', day: TOMORROW, startMinutes: 900, durationMinutes: 60, doubts: [] }, [['date', 'mañana'], ['time', 'de 3 a 4pm']]],
  ['rango con minutos', 'taller hoy de 10 a 11:30', { title: 'taller', day: TODAY, startMinutes: 600, durationMinutes: 90, doubts: [] }, [['date', 'hoy'], ['time', 'de 10 a 11:30']]],
  ['rango invalido', 'taller hoy de 5pm a 4pm', { title: 'taller', durationMinutes: null, doubts: ['duration-ignored'] }, [['date', 'hoy'], ['time', 'de 5pm a 4pm']]],
  ['rango sin marcas no es rango', 'comprar de 1 a 3 piezas', { title: 'comprar de 1 a 3 piezas', day: null }, []],
  ['en 2 horas', 'llamar en 2 horas', { title: 'llamar', day: TODAY, startMinutes: 12 * 60 + 30, doubts: [] }, [['time', 'en 2 horas']]],
  ['en 30 minutos', 'sacar pan en 30 minutos', { title: 'sacar pan', day: TODAY, startMinutes: 11 * 60, durationMinutes: null }, [['time', 'en 30 minutos']]],
  ['en 2 horas pasa medianoche', 'llamar en 2 horas', { day: TOMORROW, startMinutes: 60 }, [['time', 'en 2 horas']], new Date(2026, 10, 14, 23, 0)],
  ['lunes de pascua intacto', 'comprar pan para el lunes de pascua', { title: 'comprar pan para el lunes de pascua', day: null }, []],
  ['nombre propio intacto', 'llamar a Pedro', { title: 'llamar a Pedro', day: null, startMinutes: 540, doubts: [] }, []],
  ['viernes santo intacto', 'misa viernes santo', { title: 'misa viernes santo', day: null }, []],
  ['spans combinados', 'reunión con Ana mañana 10am por 2 horas en progreso', { title: 'reunión con Ana' }, [['date', 'mañana'], ['time', '10am'], ['duration', 'por 2 horas'], ['status', 'en progreso']]],
  ['spans repeat', 'gimnasio cada semana', { repeat: 'week' }, [['repeat', 'cada semana']]],
  ['spans unscheduled', 'comprar pan sin fecha', { unscheduled: true }, [['unscheduled', 'sin fecha']]],
  ['spans con espacios extra', '  dentista   mañana   15:00', { title: 'dentista', day: TOMORROW, startMinutes: 900 }, [['date', 'mañana'], ['time', '15:00']]],
  ['spans estado hecha', 'llamar al banco, hecha', { status: 'done' }, [['status', ', hecha']]],
]

const spansOf = (input, result) => result.spans.map((s) => [s.kind, input.slice(s.start, s.end)])

const rows = cases.map(([name, input, expected, spans, ref]) => {
  const result = parseQuickAdd(input, ref || REF)
  const failed = Object.keys(expected).filter((k) => !same(result?.[k], expected[k]))
  const detail = failed.map((k) => `${k}: esperado ${JSON.stringify(expected[k])}, obtuvo ${JSON.stringify(result?.[k])}`)
  if (result && spans) {
    const got = spansOf(input, result)
    if (!same(got, spans)) detail.push(`spans: esperado ${JSON.stringify(spans)}, obtuvo ${JSON.stringify(got)}`)
  }
  if (result && !result.spans.every((s, i, a) => s.end > s.start && (i === 0 || a[i - 1].end <= s.start))) detail.push('spans desordenados o solapados')
  return { name, ok: detail.length === 0, detail: detail.join(' | ') }
})

const spanLines = parseQuickAddLines('hola mañana\n  cena hoy 8pm', REF)
rows.push({
  name: 'spans por linea son relativos a su linea',
  ok: same(spanLines[0].spans, [{ start: 5, end: 11, kind: 'date' }]) && same(spanLines[1].spans.map((x) => 'cena hoy 8pm'.slice(x.start, x.end)), ['hoy', '8pm']),
  detail: JSON.stringify(spanLines.map((l) => l.spans)),
})

const lines = parseQuickAddLines('comprar pan\n\n  gimnasio cada semana  \r\nllamar mañana 10am en progreso\n', REF)
rows.push({
  name: 'varias lineas ignora vacias',
  ok: lines.length === 3 && lines[0].title === 'comprar pan' && lines[1].repeat === 'week' && lines[2].status === 'inprogress',
  detail: JSON.stringify(lines.map((l) => l.title)),
})

const hidden = parseQuickAddLines(Array.from({ length: 25 }, (_, i) => `tarea ${i}`).join('\n'))
rows.push({ name: 'splitQuickAddLines cuenta todas', ok: splitQuickAddLines(Array.from({ length: 25 }, (_, i) => `t${i}`).join('\n')).length === 25 && hidden.length === 20, detail: '' })
const many = parseQuickAddLines(Array.from({ length: 30 }, (_, i) => `tarea ${i}`).join('\n'))
rows.push({ name: 'varias lineas maximo 20', ok: many.length === 20, detail: `obtuvo ${many.length}` })
const hlRaw = 'comprar pan\n\n  cena hoy 8pm  \r\nllamar mañana\n'
const hlLines = parseQuickAddLines(hlRaw, REF)
const hlMarks = highlightSegments(hlRaw, hlLines).filter((x) => x.kind).map((x) => x.text)
rows.push({
  name: 'highlightSegments mapea spans a offsets del texto completo',
  ok: hlLines.every((l) => hlRaw.slice(l.lineStart + l.trimOffset).startsWith(l.title.split(' ')[0])) && same(hlMarks, ['hoy', '8pm', 'mañana']),
  detail: JSON.stringify([hlLines.map((l) => [l.lineStart, l.trimOffset]), hlMarks]),
})
rows.push({ name: 'highlightSegments sin spans devuelve vacio', ok: same(highlightSegments('hola', parseQuickAddLines('hola', REF)), []), detail: '' })
rows.push({ name: 'entrada vacia', ok: parseQuickAdd('   ') === null && same(parseQuickAddLines(''), []), detail: '' })

const dayOnly = parse('pagar el 5')
const passedThisMonth = REF.getDate() > 5
const rolledOver = new Date(dayOnly.day + 'T00:00:00').getMonth() !== REF.getMonth()
rows.push({
  name: 'duda fecha ambigua coherente',
  ok: dayOnly.title === 'pagar' && rolledOver === passedThisMonth && dayOnly.doubts.includes('ambiguous-date') === passedThisMonth,
  detail: JSON.stringify(dayOnly),
})

const tidyCases = [
  ['  reunión   con ana  ', 'Reunión con ana'],
  ['llamar\n\na   Ana', 'Llamar a Ana'],
  ['ñandú al horno', 'Ñandú al horno'],
  ['Ya Capitalizado', 'Ya Capitalizado'],
  ['pagar iPhone', 'Pagar iPhone'],
  ['3 reuniones', '3 reuniones'],
  ['¿qué hacer?', '¿qué hacer?'],
  ['😀 fiesta', '😀 fiesta'],
  ['https://ejemplo.com/a', 'https://ejemplo.com/a'],
  ['www.ejemplo.com', 'www.ejemplo.com'],
  ['', ''],
  ['   ', ''],
]
for (const [input, expected] of tidyCases) {
  const got = tidyTitle(input)
  rows.push({ name: `tidyTitle ${JSON.stringify(input)}`, ok: got === expected, detail: `esperado ${JSON.stringify(expected)}, obtuvo ${JSON.stringify(got)}` })
}

const hTask = (title, startMinutes, durationMinutes, updatedAt, day = TODAY) => ({ title, day, startMinutes, durationMinutes, updatedAt, status: 'todo' })
const habitCases = [
  ['habitFor una sola tarea no es habito', [hTask('Gimnasio', 420, 60, 1)], 'gimnasio', null],
  ['habitFor dos tareas misma hora', [hTask('Gimnasio', 420, 60, 1), hTask('gimnasio ', 420, 60, 2)], 'Gimnasio', { startMinutes: 420, durationMinutes: 60 }],
  ['habitFor ignora acentos y mayusculas', [hTask('Reunión', 600, null, 1), hTask('REUNION', 600, null, 2)], 'reunión', { startMinutes: 600, durationMinutes: null }],
  ['habitFor excluye tareas sin dia', [hTask('Yoga', 1080, 60, 1), hTask('Yoga', 1080, 60, 2, null)], 'yoga', null],
  ['habitFor la moda gana', [hTask('Yoga', 1080, 60, 1), hTask('Yoga', 1080, 60, 2), hTask('Yoga', 540, 60, 9)], 'yoga', { startMinutes: 1080, durationMinutes: 60 }],
  ['habitFor empate gana la mas reciente', [hTask('Yoga', 1080, null, 1), hTask('Yoga', 1080, null, 2), hTask('Yoga', 540, null, 8), hTask('Yoga', 540, null, 9)], 'yoga', { startMinutes: 540, durationMinutes: null }],
  ['habitFor sin moda repetida no sugiere', [hTask('Yoga', 1080, 30, 1), hTask('Yoga', 540, 60, 2)], 'yoga', null],
  ['habitFor titulo distinto', [hTask('Gimnasio', 420, 60, 1), hTask('Gimnasio', 420, 60, 2)], 'gimnasio pesas', null],
  ['habitFor una serie de 12 no es habito', Array.from({ length: 12 }, (_, i) => ({ ...hTask('Gimnasio', 420, 60, i + 1), groupId: 'g1' })), 'gimnasio', null],
  ['habitFor serie cuenta como una mas otra tarea', [...Array.from({ length: 12 }, (_, i) => ({ ...hTask('Gimnasio', 420, 60, i + 1), groupId: 'g1' })), hTask('Gimnasio', 420, 60, 20)], 'gimnasio', { startMinutes: 420, durationMinutes: 60 }],
  ['habitFor titulo vacio', [hTask('Gimnasio', 420, 60, 1), hTask('Gimnasio', 420, 60, 2)], '  ', null],
]
for (const [name, tasks, title, expected] of habitCases) {
  const got = habitFor(tasks, title)
  rows.push({ name, ok: same(got, expected), detail: `esperado ${JSON.stringify(expected)}, obtuvo ${JSON.stringify(got)}` })
}

const tplDone = templateFor([{ ...hTask('Gimnasio', 420, 60, 1), status: 'done' }], 'gimnasio')
rows.push({ name: 'templateFor copia hora y duracion y no el estado done', ok: same(tplDone, { startMinutes: 420, durationMinutes: 60 }), detail: JSON.stringify(tplDone) })
const tplDoing = templateFor([{ ...hTask('Gimnasio', 420, 60, 1), status: 'inprogress' }], 'gimnasio')
rows.push({ name: 'templateFor copia estado no done', ok: same(tplDoing, { startMinutes: 420, durationMinutes: 60, status: 'inprogress' }), detail: JSON.stringify(tplDoing) })
const tplNoDay = templateFor([hTask('Gimnasio', 420, 60, 1, null)], 'gimnasio')
rows.push({ name: 'templateFor sin dia no copia hora', ok: same(tplNoDay, { durationMinutes: 60 }), detail: JSON.stringify(tplNoDay) })
const tplLatest = templateFor([hTask('Gimnasio', 420, 60, 1), hTask('Gimnasio', 480, 90, 5)], 'gimnasio')
rows.push({ name: 'templateFor usa la mas reciente', ok: same(tplLatest, { startMinutes: 480, durationMinutes: 90 }), detail: JSON.stringify(tplLatest) })

let failures = 0
for (const [i, r] of rows.entries()) {
  if (!r.ok) failures++
  console.log(`${String(i + 1).padStart(2)}  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`)
}
console.log(`\n${rows.length - failures}/${rows.length} PASS`)
process.exit(failures ? 1 : 0)
