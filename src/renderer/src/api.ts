import type { Api, Bridge } from '../../shared/types'

declare global {
  interface Window {
    codyken: Bridge
  }
}

export const bridge: Bridge = window.codyken

/** Cada método llama al proceso principal y convierte las respuestas fallidas en excepciones con un mensaje limpio. */
export const api = new Proxy({} as Api, {
  get: (_target, method: string) =>
    async (...args: unknown[]) => {
      const result = await bridge.invoke(method, args)
      if (!result.ok) throw new Error(result.error)
      return result.data
    }
})

export const isMac = bridge.platform === 'darwin'
export const mod = isMac ? '⌘' : 'Ctrl+'
