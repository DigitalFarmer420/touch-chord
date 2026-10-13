// Minimal browser globals so app modules can be imported in node (module bodies only declare things;
// a few register listeners or look up elements, which this stub absorbs). localStorage is a real in-memory store.
const any = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : any()), apply: () => any(), construct: () => any(), set: () => true });
export const store = {};
globalThis.window = globalThis;
globalThis.document = any();
globalThis.location = { search: '' };
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; }, key: i => Object.keys(store)[i] ?? null, get length() { return Object.keys(store).length; } };
