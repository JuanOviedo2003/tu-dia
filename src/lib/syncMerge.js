// Merge LWW + tombstones. Puro (sin DOM) para usarse en cliente y servidor.

export function mergeTasks(base = [], incoming = []) {
  const map = new Map()
  for (const t of base) map.set(t.id, t)
  for (const t of incoming) {
    const cur = map.get(t.id)
    if (!cur || (t.updatedAt || 0) >= (cur.updatedAt || 0)) map.set(t.id, t)
  }
  return [...map.values()]
}

export function mergeTombstones(base = {}, incoming = {}) {
  const out = { ...base }
  for (const [id, ts] of Object.entries(incoming)) {
    if (!(id in out) || ts > out[id]) out[id] = ts
  }
  return out
}

// Une estado local y remoto. LWW por tarea; borrados vía tombstone (deletedAt).
export function reconcile(localTasks, localTomb, remoteTasks, remoteTomb) {
  const tasks = mergeTasks(localTasks, remoteTasks)
  const tombstones = mergeTombstones(localTomb, remoteTomb)
  const live = tasks.filter((t) => !(t.id in tombstones) || (t.updatedAt || 0) > tombstones[t.id])
  return { tasks: live, tombstones }
}

export function snapshot(tasks, tombstones) {
  return { tasks, tombstones: tombstones || {} }
}
