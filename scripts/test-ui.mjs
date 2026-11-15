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

async function newPage(browser, { viewport = DESKTOP, profile = 'Test', tasks = [], init = null } = {}) {
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
  if (init) await context.addInitScript(init);
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

function timedTask(title, day, startMinutes, durationMinutes) {
  return { ...task(title, day, 'todo'), startMinutes, durationMinutes };
}

async function templateFromSuggestion(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('gim');
  await page.getByRole('option', { name: 'Gimnasio' }).waitFor();
  await input.press('ArrowDown');
  await input.press('Tab');
  await page.getByRole('button', { name: /^Hora: 07:00 \(desde una tarea anterior\)/ }).waitFor();
  await page.getByRole('button', { name: /^Duración: 1 h \(desde una tarea anterior\)/ }).waitFor();
  await page.getByRole('button', { name: /^Hora: /, hasText: '07:00' }).click();
  await page.getByRole('menuitemradio', { name: 'Volver a lo escrito' }).click();
  await page.getByRole('button', { name: /^Hora: 09:00$/ }).waitFor();
}

async function habitApplied(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('yoga');
  await page.getByRole('button', { name: /^Hora: 18:00 \(habitual\)/ }).waitFor();
  await input.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  const created = (await storedTasks(page)).find((t) => t.title === 'Yoga' && t.day === dayStr(0));
  assert(created && created.startMinutes === 18 * 60, `hora del hábito: ${created && created.startMinutes}`);
  await input.fill('yoga 8am');
  await page.getByRole('button', { name: /^Hora: 08:00$/ }).waitFor();
}

async function tidyOnCreate(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('  reunión   con ana  ');
  await input.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  const titles = (await storedTasks(page)).map((t) => t.title);
  assert(titles.includes('Reunión con ana'), `títulos: ${JSON.stringify(titles)}`);
}

async function dayLoadLine(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('algo');
  await page.getByText('Hoy ya tiene 6 tareas', { exact: true }).waitFor();
  await page.getByText('Día cargado', { exact: true }).waitFor();
  await input.fill('cita hoy 10am');
  await page.getByText('A esa hora ya está: Dentista', { exact: true }).waitFor();
  await input.fill('algo sin programar');
  await page.getByText('Aún no hay tareas sin programar', { exact: true }).waitFor();
  assert((await page.getByText('Día cargado', { exact: true }).count()) === 0, 'Día cargado en Sin programar');
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
  const created = (await storedTasks(page)).find((t) => t.title.toLowerCase().startsWith('reunión'));
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

const NO_SPEECH = () => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
};

const MOCK_SPEECH = () => {
  const Mock = class {
    start() {
      window.__rec = this;
    }
    stop() {
      if (this.onend) this.onend();
    }
    abort() {}
  };
  window.SpeechRecognition = Mock;
  window.webkitSpeechRecognition = Mock;
};

async function shortcutDuration(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Informe final');
  await input.focus();
  await page.keyboard.press('Alt+Digit3');
  const menu = page.getByRole('menu', { name: 'Duración' });
  await menu.waitFor();
  assert((await page.getByRole('button', { name: /^Duración: / }).getAttribute('aria-keyshortcuts')) === 'Alt+3', 'sin aria-keyshortcuts');
  await page.getByRole('menuitemradio', { name: '1 h', exact: true }).focus();
  await page.keyboard.press('Enter');
  await menu.waitFor({ state: 'detached' });
  assert(await page.evaluate(() => document.activeElement?.id === 'quick-add-input'), 'el foco no volvió al campo');
  await page.keyboard.press('Alt+Digit3');
  await menu.waitFor();
  await page.keyboard.press('Alt+Digit3');
  await menu.waitFor({ state: 'detached' });
  assert(await page.evaluate(() => document.activeElement?.id === 'quick-add-input'), 'el foco no volvió al cerrar con Alt+3');
  await input.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  const created = (await storedTasks(page)).find((t) => t.title === 'Informe final');
  assert(created && created.durationMinutes === 60, `duración: ${created && created.durationMinutes}`);
}

async function createAndKeep(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Primera seguida');
  await page.getByText('Ctrl+Enter: crear y seguir', { exact: true }).waitFor();
  await input.press('Control+Enter');
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  assert((await input.inputValue()) === '', 'el campo no quedó vacío');
  assert(await page.evaluate(() => document.activeElement?.id === 'quick-add-input'), 'el campo perdió el foco');
  assert((await page.getByText('Ctrl+Enter: crear y seguir', { exact: true }).count()) === 0, 'ayuda visible sin texto');
  assert((await storedTasks(page)).some((t) => t.title === 'Primera seguida'), 'tarea no creada');
}

async function createAndKeepMobile(page) {
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Añadir tarea', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Seguida uno');
  await input.press('Control+Enter');
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  assert((await dialog.count()) === 1, 'la hoja se cerró con Ctrl+Enter');
  assert((await input.inputValue()) === '', 'el campo no quedó vacío');
  await input.fill('Seguida dos');
  await page.getByRole('button', { name: 'Crear y seguir', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('quick-add-input')?.value === '');
  assert((await dialog.count()) === 1, 'la hoja se cerró con el botón');
  await input.fill('Cierre');
  await input.press('Enter');
  await dialog.waitFor({ state: 'detached' });
  const titles = (await storedTasks(page)).map((t) => t.title);
  for (const title of ['Seguida uno', 'Seguida dos', 'Cierre']) assert(titles.includes(title), `falta ${title}`);
}

async function voiceAbsent(page) {
  await page.getByLabel('Añadir tarea rápida').waitFor();
  assert((await page.getByRole('button', { name: /^Dictar/ }).count()) === 0, 'botón de voz sin soporte');
}

async function voiceMock(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Llamar');
  const mic = page.getByRole('button', { name: /^Dictar/ });
  await mic.waitFor();
  assert((await mic.getAttribute('aria-label')).includes('servicio de voz'), 'sin aviso de privacidad');
  assert((await mic.getAttribute('aria-pressed')) === 'false', 'aria-pressed inicial');
  await mic.click();
  const stop = page.getByRole('button', { name: 'Detener dictado' });
  await stop.waitFor();
  assert((await stop.getAttribute('aria-pressed')) === 'true', 'aria-pressed al dictar');
  await page.evaluate(() => window.__rec.onresult({ results: [[{ transcript: 'a Ana' }]] }));
  assert((await input.inputValue()) === 'Llamar a Ana', `texto provisional: ${await input.inputValue()}`);
  await page.evaluate(() => window.__rec.onresult({ results: [[{ transcript: 'a Ana mañana' }]] }));
  assert((await input.inputValue()) === 'Llamar a Ana mañana', `texto final: ${await input.inputValue()}`);
  await stop.click();
  const idle = page.getByRole('button', { name: /^Dictar/ });
  await idle.waitFor();
  assert((await idle.getAttribute('aria-pressed')) === 'false', 'aria-pressed tras detener');
  await page.getByRole('button', { name: /^Día: Mañana/ }).waitFor();
  await idle.click();
  await page.evaluate(() => window.__rec.onerror({ error: 'not-allowed' }));
  await page.getByRole('status').filter({ hasText: 'No se pudo usar el micrófono' }).waitFor();
}

async function voiceSubmit(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.focus();
  await page.getByRole('button', { name: /^Dictar/ }).click();
  await page.getByRole('button', { name: 'Detener dictado' }).waitFor();
  await page.evaluate(() => {
    window.__late = window.__rec.onresult;
    window.__rec.onresult({ results: [[{ transcript: 'comprar pan' }]] });
  });
  assert((await input.inputValue()) === 'comprar pan', `dictado: ${await input.inputValue()}`);
  await input.press('Enter');
  await page.getByRole('status').filter({ hasText: 'Tarea creada' }).waitFor();
  await page.evaluate(() => window.__late({ results: [[{ transcript: 'comprar pan' }]] }));
  assert((await input.inputValue()) === '', `campo tras enviar: ${await input.inputValue()}`);
  const count = (await storedTasks(page)).filter((t) => t.title.toLowerCase() === 'comprar pan').length;
  assert(count === 1, `tareas duplicadas: ${count}`);
}

async function shortcutLayoutKey(page) {
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Informe final');
  await input.focus();
  await page.evaluate(() => {
    document.getElementById('quick-add-input').dispatchEvent(
      new KeyboardEvent('keydown', { key: '|', code: 'Digit1', altKey: true, bubbles: true, cancelable: true }),
    );
  });
  assert((await page.getByRole('menu').count()) === 0, 'Alt con símbolo abrió el menú');
}

async function shareFits(page) {
  const viewport = page.viewportSize();
  if (viewport.width < 600) {
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Menú', exact: true }).click();
    await page.getByRole('button', { name: /Compartir/ }).click();
  } else {
    await page.getByRole('button', { name: /Compartir/ }).first().click();
  }
  const dialog = page.getByRole('dialog', { name: 'Compartir' });
  await dialog.waitFor();
  await page.getByText('Sin conexión: se creará cuando haya red.').or(page.getByText('Creando tu agenda…')).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert(overflow <= 0, `scroll horizontal de ${overflow}px`);
  await page.waitForTimeout(500);
  const box = await dialog.boundingBox();
  assert(
    box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height,
    `el diálogo se sale: ${JSON.stringify(box)}`,
  );
  const close = await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().boundingBox();
  assert(close.width >= 44 && close.height >= 44, `botón cerrar ${close.width}x${close.height}`);
}

const SEED_ROOM = () => {
  localStorage.setItem('tu-dia-room-v1', 'ROOMTEST01');
  localStorage.setItem('tu-dia-token-v1', 'tokentest');
  localStorage.setItem('tu-dia-role-v1', 'editor');
  localStorage.setItem('tu-dia-own-room-v1', 'ROOMTEST01');
};

async function storedRoomNoBlock(page) {
  await page.getByRole('main').waitFor({ timeout: 3000 });
  assert((await page.getByText('Validando acceso').count()) === 0, 'aparece Validando acceso');
  await page.getByText('Local A').first().waitFor({ timeout: 3000 });
  const input = page.getByLabel('Añadir tarea rápida');
  await input.fill('Nueva en segundo plano');
  await input.press('Enter');
  await page.getByText('Nueva en segundo plano').first().waitFor();
  const label = await page.getByText(/Sincronizando…|Sin conexión/).count();
  assert(label > 0, 'el indicador de sync no muestra estado de espera');
  assert((await page.getByText(/Agenda privada|Agenda no encontrada|Sin respuesta/).count()) === 0, 'aviso bloqueante');
}

async function storedRoomShareVerifying(page) {
  await page.getByRole('main').waitFor({ timeout: 3000 });
  await page.getByRole('button', { name: /Compartir/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Compartir' });
  await dialog.waitFor();
  await dialog.getByText(/Verificando tu agenda…|Sin conexión: se reintentará solo/).first().waitFor({ timeout: 3000 });
  assert((await dialog.getByRole('button', { name: /Copiar link/ }).count()) === 0, 'aparece Copiar link');
  assert((await dialog.getByRole('button', { name: /Mostrar QR/ }).count()) === 0, 'aparece Mostrar QR');
  assert((await dialog.getByRole('button', { name: /Renovar|Dejar de sincronizar/ }).count()) === 0, 'aparecen acciones de credenciales');
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
    await runCase(browser, '13. Plantilla desde sugerencia', { tasks: [timedTask('Gimnasio', dayStr(-1), 420, 60)] }, templateFromSuggestion);
    await runCase(
      browser,
      '14. Hábito aplicado',
      { tasks: [timedTask('Yoga', dayStr(-1), 1080, null), timedTask('Yoga', dayStr(-2), 1080, null)] },
      habitApplied,
    );
    await runCase(browser, '15. Título corregido al crear', {}, tidyOnCreate);
    await runCase(
      browser,
      '16. Carga del día',
      {
        tasks: [
          timedTask('Dentista', dayStr(0), 600, null),
          ...Array.from({ length: 5 }, (_, i) => timedTask(`Tarea ${i}`, dayStr(0), 700 + i * 30, null)),
        ],
      },
      dayLoadLine,
    );
    await runCase(browser, '17. Atajo Alt+3 en duración', {}, shortcutDuration);
    await runCase(browser, '18. Crear y seguir en escritorio', {}, createAndKeep);
    await runCase(browser, '19. Crear y seguir en la hoja móvil', { viewport: MOBILE }, createAndKeepMobile);
    await runCase(browser, '20. Voz: sin soporte no hay botón', { init: NO_SPEECH }, voiceAbsent);
    await runCase(browser, '21. Voz: con mock anexa texto', { init: MOCK_SPEECH }, voiceMock);
    await runCase(browser, '22. Voz: enviar no duplica texto', { init: MOCK_SPEECH }, voiceSubmit);
    await runCase(browser, '23. Alt+símbolo no abre menú', {}, shortcutLayoutKey);
    await runCase(browser, '24. Compartir cabe en 360x640', { viewport: { width: 360, height: 640 } }, shareFits);
    await runCase(browser, '25. Compartir cabe en 1280x800', {}, shareFits);
    await runCase(
      browser,
      '26. Credenciales guardadas no bloquean',
      { init: SEED_ROOM, tasks: [task('Local A', dayStr(0), 'todo')] },
      storedRoomNoBlock,
    );
    await runCase(
      browser,
      '27. Compartir sin credenciales confirmadas',
      { init: SEED_ROOM, tasks: [task('Local A', dayStr(0), 'todo')] },
      storedRoomShareVerifying,
    );
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
