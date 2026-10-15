// Diagnóstico de drag calendario -> día (temporal)
// Levanta el preview build (vite preview) lo arranca por separado antes de correr.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4173'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// Localizar barra de tarea en el calendario (TaskBar). Las barras tienen texto
// y estan dentro de celdas con data; usamos el selector por color/clase.
// DayCell droppable: div con onClick - no tiene data attr. Las barras son
// los Draggable con class 'absolute left-0.5 right-0.5'.
const bar = page.locator('.grid-cols-7 div.absolute').first()
const barCount = await page.locator('.grid-cols-7 div.absolute').count()
console.log('barras en calendario:', barCount)

if (barCount === 0) {
  console.log('No hay tareas seed en el calendario (mes actual sin tareas?). Navego al mes con seed (mes actual).')
  await page.screenshot({ path: 'drag0.png' })
  await browser.close()
  process.exit(1)
}

const barBox = await bar.boundingBox()
const barText = (await bar.textContent())?.trim()
console.log('barra origen:', JSON.stringify(barText), barBox)

// Destino: otra celda del grid. Las celdas son DayCell (relative...). Tomamos
// la celda 20 posiciones despues en la rejilla -> div.relative dentro de grid.
const cells = page.locator('.grid-cols-7 > div')
const cellCount = await cells.count()
console.log('celdas grid:', cellCount)
// escoger una celda distinta (por ejemplo índice 10 si el origen está en otra)
const target = cells.nth(20)
const targetBox = await target.boundingBox()
console.log('celda destino box:', targetBox)

const hud = page.locator('div.fixed.left-2.top-20') // debug HUD

// Arrastrar: mouse down en la barra, mover al centro de la celda destino.
await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2)
await page.mouse.down()
await page.waitForTimeout(100)

const steps = 25
for (let i = 1; i <= steps; i++) {
  const x = barBox.x + barBox.width / 2 + ((targetBox.x + targetBox.width / 2) - (barBox.x + barBox.width / 2)) * (i / steps)
  const y = barBox.y + barBox.height / 2 + ((targetBox.y + targetBox.height / 2) - (barBox.y + barBox.height / 2)) * (i / steps)
  await page.mouse.move(x, y)
  await page.waitForTimeout(30)
  if (i === steps - 2) {
    const hudText = await hud.count() ? await hud.textContent() : '(sin HUD)'
    console.log('HUD cerca del destino:', hudText)
  }
}
await page.screenshot({ path: 'drag-during.png' })

// Inspeccionar: overlay en DOM + drugging state
const diagnostics = await page.evaluate(() => {
  // dnd-kit: draggable activo aria-pressed=true
  const pressed = Array.from(document.querySelectorAll('[aria-roledescription=draggable][aria-pressed=true]'))
  const pressedInfo = pressed.map((el) => {
    const r = el.getBoundingClientRect()
    const title = el.textContent.trim()
    const cls = el.className.slice(0, 120)
    return { text: title.slice(0, 40), txt: title, cls, rect: { w: r.width, h: r.height } }
  })
  // dnd-kit DragOverlay renders a fixed div? Let me find any element with role-preset 'dialog'
  const overlays = Array.from(document.querySelectorAll('[aria-roledescription=draggable][aria-pressed=true]')).map((el) => {
    const r = el.getBoundingClientRect()
    const title = el.textContent.trim().slice(0, 40)
    return { t: title, rect: { w: r.width, h: r.height } }
  })
  return {
    pressedPressed: pressedInfo.length,
    pressedInfo,
    totalgridCells: document.querySelectorAll('.grid-cols-7 > div').length,
    dragulaName: 'cuenta fixed elem',
    pressed: pressed.length,
  }
})
console.log('diag:', diagnostics)

await page.mouse.up()
await page.waitForTimeout(400)

const hudEnd = await hud.count() ? await hud.textContent() : '(sin HUD)'
console.log('HUD tras soltar:', hudEnd)

// Verificar: la tarea sigue existiendo en el mismo dia o se movio?
// Contar barras con el texto en cada celda: parcheado por texto.
const after = await page.evaluate((txt) => {
  const bars = Array.from(document.querySelectorAll('.grid-cols-7 div.absolute'))
  return bars.filter((b) => (b.textContent || '').trim() === txt).length
}, barText)
console.log('barras con ese texto tras drag:', after)
await page.screenshot({ path: 'drag-after.png' })

await browser.close()
