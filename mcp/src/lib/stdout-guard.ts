/**
 * DEBE importarse ANTES que cualquier otro módulo (ver la primera línea de
 * index.ts). Con transporte stdio, stdout transporta mensajes JSON-RPC: un
 * solo `console.log` — propio o de una dependencia transitiva — intercala
 * texto que el cliente no puede parsear y corta la sesión.
 *
 * Por qué un módulo aparte y no una línea suelta en index.ts: en ESM los
 * `import` se HOISTEAN y se evalúan antes que cualquier sentencia del cuerpo
 * del módulo. Una asignación "en la línea 1" de index.ts correría DESPUÉS de
 * que todos sus imports ya se ejecutaron — demasiado tarde. Importar este
 * archivo primero sí garantiza el orden, porque los imports se evalúan en el
 * orden en que aparecen.
 */
const toStderr = (...args: unknown[]): void => {
  console.error(...args);
};

console.log = toStderr;
console.info = toStderr;
console.warn = toStderr;
console.debug = toStderr;
