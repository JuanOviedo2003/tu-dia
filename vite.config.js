import os from 'node:os'
import dgram from 'node:dgram'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IP de salida real (la que el SO usaría para salir a internet).
// El móvil, en la misma red, debe alcanzar esta interfaz.
function getEgressIp() {
  try {
    const sock = dgram.createSocket('udp4')
    sock.connect('8.8.8.8', 53)
    const ip = sock.address().address
    sock.close()
    return ip
  } catch {
    return null
  }
}

// Devuelve las IPv4 locales (no internas), con la de salida primero.
function getLocalIPv4() {
  const ifaces = os.networkInterfaces()
  const all = []
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) all.push(iface.address)
    }
  }
  const egress = getEgressIp()
  if (egress && all.includes(egress)) {
    return [egress, ...all.filter((a) => a !== egress)]
  }
  return all
}

// Middleware que expone IP(s) y puerto al frontend para construir el QR.
function localIpPlugin() {
  return {
    name: 'local-ip-dev-info',
    configureServer(server) {
      server.middlewares.use('/__dev-info', (req, res) => {
        const addr = server.httpServer?.address()
        const port = addr && typeof addr === 'object' ? addr.port : 5173
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify({ ips: getLocalIPv4(), port }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localIpPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
