// Vitest corre en Node, que no tiene IndexedDB: fake-indexeddb la simula en memoria
// para poder probar LocalRepository (Dexie) con transacciones reales.
import 'fake-indexeddb/auto'
