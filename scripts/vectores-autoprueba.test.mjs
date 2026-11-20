// Comprueba con el modelo de verdad (procesador, en Node) que los vectores guardados de la
// autoprueba siguen cuadrando con los patrones y el modelo. Si falla, hay que ejecutar
// «npm run autoprueba»: si no, todos los móviles suspenderían la autoprueba.
import { describe, expect, it } from 'vitest'
import { vectorEsperado } from '../src/reconocimiento/autoprueba.ts'
import { normalizarL2, similitudCoseno } from '../src/reconocimiento/comparar.ts'
import { NOMBRES_PATRONES, pixelesPatron } from '../src/reconocimiento/patrones.ts'
import { cargarModeloEnNode, vectorDePixeles } from './modelo-en-node.mjs'

describe('vectores de la autoprueba', () => {
  it('cuadran con lo que calcula el modelo', async () => {
    const modelo = await cargarModeloEnNode()
    for (const nombre of NOMBRES_PATRONES) {
      const calculado = normalizarL2(await vectorDePixeles(modelo, pixelesPatron(nombre)))
      expect(similitudCoseno(calculado, vectorEsperado(nombre)), nombre).toBeGreaterThan(0.9999)
    }
  }, 180_000)
})
