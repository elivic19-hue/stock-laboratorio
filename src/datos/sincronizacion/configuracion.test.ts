import { describe, expect, it } from 'vitest'
import { leerConfiguracionPegada } from './configuracion'

describe('leerConfiguracionPegada', () => {
  it('entiende el bloque que copia Firebase', () => {
    const texto = `// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA-ejemplo_123",
  authDomain: "stock-lab.firebaseapp.com",
  projectId: "stock-lab",
  storageBucket: "stock-lab.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};`
    expect(leerConfiguracionPegada(texto)).toEqual({
      apiKey: 'AIzaSyA-ejemplo_123',
      authDomain: 'stock-lab.firebaseapp.com',
      projectId: 'stock-lab',
      storageBucket: 'stock-lab.firebasestorage.app',
      messagingSenderId: '1234567890',
      appId: '1:1234567890:web:abc123',
    })
  })

  it('acepta JSON y completa el authDomain', () => {
    expect(leerConfiguracionPegada('{"apiKey":"k","projectId":"p","appId":"a"}')).toEqual({
      apiKey: 'k',
      projectId: 'p',
      appId: 'a',
      authDomain: 'p.firebaseapp.com',
    })
  })

  it('rechaza lo que no es una configuración', () => {
    expect(() => leerConfiguracionPegada('hola')).toThrow('apiKey, projectId y appId')
  })
})
