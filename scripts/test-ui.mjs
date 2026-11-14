import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4401;
const BASE = `http://localhost:${PORT}`;
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const FIXED_NOW = (() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 15, 12, 0, 0);
})();

const results = [];

function pad(n) {
  return String(n).padStart(2, '0');
}

function dayStr(offset) {
  const d = new Date(FIXED_NOW.getFullYear(), FIXED_NOW.getMonth(), FIXED_NOW.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function task(title, day, status) {
  const now = FIXED_NOW.getTime();
  return { id: `t-${Math.random().toString(36).slice(2)}`, title, day, status, updatedAt: now, createdAt: now };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function startServer() {
  const child = spawn(`npx vite --port ${PORT} --strictPort`, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { cache: 'no-store' });
      if (res.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function killServer(child) {
  if (!child) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

async function newPage(browser, { viewport = DESKTOP, profile = 'Test', tasks = [] } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.clock.setFixedTime(FIXED_NOW);
  await context.route(/(googleapis\.com|firebaseio\.com|firebaseapp\.com|gstatic\.com\/firebasejs)/, (route) =>
    route.abort(),
  );
  await context.addInitScript(
    ({ profile, tasks }) => {
      if (profile) localStorage.setItem('tu-dia-profile-v1', profile);
      localStorage.setItem('tu-dia-tasks-v1', JSON.stringify(tasks));
    },
    { profile, tasks },
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(8000);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { context, page, errors };
}

async function runCase(browser, name, options, fn) {
  let session;
  try {
    session = await newPage(browser, options);
    await fn(session.page);
    assert(session.errors.length === 0, `pageerror: ${session.errors.join(' | ')}`);
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, detail: error && error.message ? error.message.split('\n')[0] : String(error) });
  } finally {
    if (session) await session.context.close().catch(() => undefined);
  }
}

async function firstRun(page) {
  const nameInput = page.getByLabel('¿Cómo te llamas?');
  await nameInput.waitFor();
  assert((await page.getByRole('main').count()) === 0, 'la agenda es visible sin perfil');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.getByRole('alert').waitFor();
  assert((await page.getByRole('alert').innerText()).trim().length > 0, 'sin mensaje de error con nombre vacío');
  await nameInput.fill('Test');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await page.getByRole('main').waitFor();
  assert((await page.getByLabel('¿Cómo te llamas?').count()) === 0, 'el formulario de nombre sigue visible');
  const saved = await page.evaluate(() => localStorage.getItem('tu-dia-profile-v1'));
  assert(saved === 'Test', `perfil guardado: ${saved}`);
}

async function createAndMove(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  for (const view of ['Día', 'Línea de tiempo', 'Mes']) {
    await page.getByRole('button', { name: view, exact: true }).first().click();
    await input.waitFor();
  }
  await page.getByRole('button', { name: 'Día', exact: true }).first().click();
  await input.fill('Tarea de prueba');
  await input.press('Enter');
  const card = page.locator('[data-task-id]', { hasText: 'Tarea de prueba' }).first();
  await card.waitFor();
  const columnOf = () => card.evaluate((el) => el.closest('section')?.getAttribute('aria-label') ?? null);
  assert((await columnOf()) === 'Pendiente', `columna inicial: ${await columnOf()}`);

  await card.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  let column = await columnOf();
  if (column === 'Pendiente') {
    const target = page.getByRole('region', { name: 'En curso' });
    const from = await card.boundingBox();
    const to = await target.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    column = await columnOf();
  }
  assert(column !== 'Pendiente' && column !== null, `la tarea no cambió de columna (${column})`);
}

async function pasteTwoLines(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Primera tarea\nSegunda tarea');
  await page.getByText('2 tareas', { exact: true }).waitFor();
  await input.press('Enter');
  await page.getByRole('status').filter({ hasText: '2 tareas creadas' }).waitFor();
  assert((await page.locator('[data-task-id]', { hasText: 'Primera tarea' }).count()) === 1, 'falta "Primera tarea"');
  assert((await page.locator('[data-task-id]', { hasText: 'Segunda tarea' }).count()) === 1, 'falta "Segunda tarea"');
}

async function overflowNotice(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill(Array.from({ length: 22 }, (_, i) => `Tarea ${i}`).join('\n'));
  await page.getByText('Máx. 20 tareas por vez: se ignorarán 2 líneas').waitFor();
  await input.press('Enter');
  await page.getByRole('status').filter({ hasText: '20 tareas creadas · 2 líneas ignoradas' }).waitFor();
}

async function suggestion(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('comp');
  const option = page.getByRole('option', { name: 'Comprar leche' });
  await option.waitFor();
  assert((await input.getAttribute('aria-expanded')) === 'true', 'combobox sin aria-expanded');
  await input.press('ArrowDown');
  await input.press('Tab');
  assert((await input.inputValue()) === 'Comprar leche', `valor tras Tab: ${await input.inputValue()}`);
  assert((await page.getByRole('option').count()) === 0, 'la lista sigue abierta tras aceptar');
}

async function highlight(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('reunión mañana 10am por 2 horas');
  const marks = page.locator('[data-testid="quick-add-backdrop"] mark');
  await marks.first().waitFor();
  const texts = await marks.allTextContents();
  assert(JSON.stringify(texts) === JSON.stringify(['mañana', '10am', 'por 2 horas']), `marks: ${JSON.stringify(texts)}`);
  const backdropText = await page.locator('[data-testid="quick-add-backdrop"]').evaluate((el) => el.textContent.replace('​', ''));
  assert(backdropText.startsWith('reunión '), 'el título no está en la capa trasera');
  assert(!texts.some((t) => t.includes('reunión')), 'el título quedó marcado');

  const diff = await page.evaluate(() => {
    const field = document.getElementById('quick-add-input');
    const mark = document.querySelector('[data-testid="quick-add-backdrop"] mark');
    const cs = getComputedStyle(field);
    const mirror = document.createElement('div');
    const box = field.getBoundingClientRect();
    mirror.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;white-space:pre-wrap;word-wrap:break-word;visibility:hidden;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};letter-spacing:${cs.letterSpacing};line-height:${cs.lineHeight}`;
    mirror.textContent = field.value;
    document.body.appendChild(mirror);
    const start = field.value.indexOf('mañana');
    const range = document.createRange();
    range.setStart(mirror.firstChild, start);
    range.setEnd(mirror.firstChild, start + 'mañana'.length);
    const word = range.getBoundingClientRect();
    const rect = mark.getBoundingClientRect();
    mirror.remove();
    return { dx: Math.abs(word.left - rect.left), dy: Math.abs(word.top - rect.top), dw: Math.abs(word.width - rect.width) };
  });
  assert(diff.dx <= 2 && diff.dy <= 2 && diff.dw <= 2, `desalineado: ${JSON.stringify(diff)}`);

  await input.fill('hola');
  assert((await marks.count()) === 0, 'hay marks sin spans');
}

async function monthView(page) {
  await page.getByRole('button', { name: 'Mes', exact: true }).first().click();
  const pastPending = page.getByRole('button', { name: /, 1 pendiente$/ });
  const pastDone = page.getByRole('button', { name: /, todo hecho$/ });
  const today = page.getByRole('button', { name: /, 2 pendientes$/ });
  const empty = page.getByRole('button', { name: /, sin tareas$/ });
  await today.first().waitFor();
  assert((await pastPending.count()) === 1, `celdas "1 pendiente": ${await pastPending.count()}`);
  assert((await pastDone.count()) === 1, `celdas "Todo hecho": ${await pastDone.count()}`);
  assert((await today.count()) === 1, `celdas "2 pendientes": ${await today.count()}`);
  const cellOf = (button) => button.locator('xpath=..');
  const barsIn = (button) => cellOf(button).locator('div[aria-hidden="true"].overflow-hidden').count();
  const danger = await cellOf(pastPending).getAttribute('class');
  assert(danger.includes('bg-danger-bg'), 'día pasado sin hechas sin clase bg-danger-bg');
  const doneClass = await cellOf(pastDone).getAttribute('class');
  assert(!doneClass.includes('bg-danger-bg'), 'día pasado todo hecho marcado como peligro');
  const emptyCount = await empty.count();
  assert(emptyCount > 0, 'no hay días vacíos');
  for (let i = 0; i < emptyCount; i += 1) {
    const bars = await barsIn(empty.nth(i));
    assert(bars === 0, 'día vacío con barra de progreso');
  }
  assert((await barsIn(today)) === 1, 'hoy sin barra de progreso');
}

async function focusInsideDialog(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return Boolean(dialog && dialog.contains(document.activeElement));
  });
}

async function mobile(page) {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await nav.waitFor();
  for (const name of ['Día', 'Línea', 'Añadir tarea', 'Mes', 'Menú']) {
    assert((await nav.getByRole('button', { name, exact: true }).count()) === 1, `falta "${name}" en la barra inferior`);
  }
  for (const name of ['Mes', 'Línea']) {
    const item = nav.getByRole('button', { name, exact: true });
    await item.click();
    assert((await item.getAttribute('aria-current')) === 'page', `${name} no queda activo`);
  }

  const plusButtons = page.getByRole('button', { name: 'Añadir tarea', exact: true });
  assert((await plusButtons.count()) === 1, `botones "+" Añadir tarea: ${await plusButtons.count()}`);

  await nav.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    assert(await focusInsideDialog(page), `el foco salió del dialog tras ${i + 1} Tab`);
  }
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Shift+Tab');
    assert(await focusInsideDialog(page), `el foco salió del dialog tras ${i + 1} Shift+Tab`);
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  const focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
  assert(focusedLabel === 'Añadir tarea', `foco tras Escape: ${focusedLabel}`);
}

async function storedTasks(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tu-dia-tasks-v1') || '[]'));
}

async function editDayChip(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('reunión mañana');
  const chip = page.getByRole('button', { name: /^Día: Mañana/ });
  await chip.click();
  assert((await chip.getAttribute('aria-expanded')) === 'true', 'chip de día sin aria-expanded');
  assert((await chip.getAttribute('aria-haspopup')) === 'menu', 'chip de día sin aria-haspopup');
  await page.getByRole('menuitemradio', { name: 'Pasado mañana' }).click();
  await page.getByRole('menu').waitFor({ state: 'detached' });
  await input.fill('reunión mañana y media');
  await page.getByRole('button', { name: /^Día: .*\(editado\)/ }).waitFor();
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  const created = (await storedTasks(page)).find((t) => t.title.startsWith('reunión'));
  assert(created && created.day === dayStr(2), `día de la tarea: ${created && created.day}`);
}

async function editStatusChip(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Revisar informe');
  await page.getByRole('button', { name: /^Estado: Pendiente/ }).click();
  await page.getByRole('menuitemradio', { name: 'En curso' }).click();
  await page.getByRole('button', { name: /^Estado: En curso/ }).waitFor();
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  const card = page.locator('[data-task-id]', { hasText: 'Revisar informe' }).first();
  await card.waitFor();
  const column = await card.evaluate((el) => el.closest('section')?.getAttribute('aria-label') ?? null);
  assert(column === 'En curso', `columna: ${column}`);
}

async function menuEscapeMobile(page) {
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await nav.getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await page.getByLabel('Añadir tarea rápida').fill('gym mañana');
  const chip = page.getByRole('button', { name: /^Hora: / });
  await chip.click();
  const menu = page.getByRole('menu');
  await menu.waitFor();
  const box = await menu.boundingBox();
  const view = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
  assert(box.y >= 0 && box.y + box.height <= view, 'el menú se sale de la pantalla');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
  assert((await dialog.count()) === 1, 'Escape cerró la hoja');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null);
  assert(focused && focused.startsWith('Hora:'), `foco tras Escape: ${focused}`);
}

async function customTimeKeyboard(page) {
  await page.getByLabel('Añadir tarea rápida').fill('gym mañana');
  await page.getByRole('button', { name: /^Hora: / }).click();
  const menu = page.getByRole('menu');
  const input = menu.locator('input');
  await input.waitFor();
  await input.focus();
  await page.keyboard.type('0930');
  const inInput = () => page.evaluate(() => document.activeElement?.tagName === 'INPUT');
  assert(await inInput(), 'el foco salió del input al teclear');
  let focused = null;
  for (let i = 0; i < 5 && focused !== 'Aplicar'; i++) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => document.activeElement?.textContent ?? null);
  }
  assert(focused === 'Aplicar', `Tab desde el input: ${focused}`);
  assert((await page.getByRole('menu').count()) === 1, 'Tab cerró el menú');
}

async function main() {
  let server;
  let browser;
  try {
    server = await startServer();
    const up = await waitForServer();
    results.push({ name: `servidor vite en :${PORT}`, ok: up, detail: up ? '' : 'sin respuesta' });
    if (!up) return;

    browser = await chromium.launch({ headless: true });

    await runCase(browser, '1. Primer arranque', { profile: null }, firstRun);
    await runCase(browser, '2. Crear y mover tarea', {}, createAndMove);
    await runCase(
      browser,
      '3. Vista Mes',
      {
        tasks: [
          task('Atrasada', dayStr(-2), 'todo'),
          task('Hecha A', dayStr(-4), 'done'),
          task('Hecha B', dayStr(-4), 'done'),
          task('Hoy A', dayStr(0), 'todo'),
          task('Hoy B', dayStr(0), 'todo'),
        ],
      },
      monthView,
    );
    await runCase(browser, '4. Móvil', { viewport: MOBILE }, mobile);
    await runCase(browser, '5. Captura de dos líneas', {}, pasteTwoLines);
    await runCase(browser, '7. Aviso de más de 20 líneas', {}, overflowNotice);
    await runCase(browser, '8. Chip de día editable', {}, editDayChip);
    await runCase(browser, '9. Chip de estado editable', {}, editStatusChip);
    await runCase(browser, '11. Teclado en hora personalizada', {}, customTimeKeyboard);
    await runCase(browser, '10. Menú de chip con Escape en móvil', { viewport: MOBILE }, menuEscapeMobile);
    await runCase(browser, '11. Resaltado en el campo', {}, highlight);
    await runCase(browser, '12. Resaltado en la hoja móvil', { viewport: MOBILE }, async (page) => {
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Añadir tarea', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await highlight(page);
    });
    await runCase(browser, '6. Sugerencia de título', { tasks: [task('Comprar leche', dayStr(0), 'done')] }, suggestion);
  } catch (error) {
    results.push({ name: 'ejecución sin excepciones', ok: false, detail: error && error.message ? error.message : String(error) });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    killServer(server);
  }

  console.log('');
  for (const result of results) {
    console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
  }
  const failures = results.filter((result) => !result.ok);
  console.log(`\nRESULTADO: ${results.length - failures.length}/${results.length} PASS`);
  if (failures.length > 0) process.exitCode = 1;
}

main();
