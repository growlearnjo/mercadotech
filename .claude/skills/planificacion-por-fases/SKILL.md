---
name: planificacion-por-fases
description: >
  Convierte una idea de proyecto en una especificación por fases que una IA (Claude Code u otra)
  pueda implementar sin suposiciones: primero valida el estado real del repositorio, después corta
  el trabajo en fases verificables y escribe cada fase con las mismas cinco secciones (Qué se
  construye / Depende de / Archivos / Reglas / Cómo verificar). Úsalo cuando haya que planificar un
  proyecto o una sesión de trabajo, dividir algo grande en fases, escribir o revisar una spec o un
  roadmap de desarrollo, o cuando lo invoquen con /planificacion-por-fases.
---

# Planificación de proyectos por fases

## Para qué sirve

Una IA implementa bien lo que está escrito, y mal lo que tuvo que adivinar.

Esta skill sirve para escribir el documento que elimina la adivinanza — la **spec** — un archivo
`.md` que responde, para cada tramo de trabajo: *qué se construye, en qué orden, en qué archivos,
con qué reglas y cómo se sabe que quedó bien.*

Después ese documento se le pasa a la IA **una fase por vez**.

---

## Regla 0 — Primero el terreno, después el plan

**Nunca escribir la spec desde la idea de cómo "suele ser" un proyecto.** Antes de la primera línea:

1. Leer el repositorio real: estructura de carpetas, esquema de base de datos, migraciones,
   dependencias instaladas (`package.json`), archivos que ya existen.
2. Leer las specs anteriores, si las hay, y el registro de lo ya ejecutado (bitácora, commits).
3. **Listar los hallazgos primero** — conflictos, cosas que ya existen, cosas que faltan — y recién
   entonces escribir.

Los hallazgos no se tiran: van dentro de la spec, en la tabla *Decisiones tomadas al validar contra
el repo*. Ahí es donde aparecen los problemas caros: rutas duplicadas, una librería que no funciona
en ese entorno, un permiso que impide lo que la fase daba por hecho.

> Si al validar cambia el **alcance funcional**, avisarlo explícitamente. Nunca cambiarlo en
> silencio.

---

## Los cuatro pasos

| Paso | Qué se hace | Resultado |
|---|---|---|
| 1 | Validar contra el repo (Regla 0) | lista de hallazgos |
| 2 | Cortar el trabajo en fases y ordenarlas por dependencia | mapa de fases |
| 3 | Escribir cada fase con las mismas 5 secciones | cuerpo de la spec |
| 4 | Revisar la spec con el checklist final | spec lista para ejecutar |

---

## Paso 2 — Cómo cortar en fases

**Criterios de un buen corte:**

* **Cada fase termina en algo que se puede ver o probar.** "Avanzar la UI un 30%" no es una fase;
  "el catálogo lista productos reales" sí.
* **Se avanza de abajo hacia arriba:** datos → lógica → interfaz. Lo que muchas fases necesitan se
  construye antes, una sola vez.
* **Una fase entra en una conversación con la IA.** Si no entra, son dos fases.
* **Las dependencias son explícitas y sin ciclos.** Si A necesita B y B necesita A, el corte está
  mal.
* **Entre 4 y 8 fases por documento.** Si salen 15, son dos documentos.
* **Numeradas** (`3.1`, `3.2`, …) para poder decir *"ejecuta la Fase 3.4"*.

**Señales de un corte malo:**

| Señal | Qué hacer |
|---|---|
| La fase no se puede verificar sin la siguiente | fusionarlas |
| "Cómo verificar" dice *"revisar que el código esté bien"* | no es verificación: definir una acción observable |
| Dos fases tocan los mismos archivos con las mismas reglas | probablemente son una |
| Una fase toca 20 archivos | partirla |
| La fase 1 no se puede empezar sin decidir algo que no está decidido | esa decisión va en la cabecera, antes de las fases |

---

## Paso 3 — Anatomía de la spec

### Cabecera (antes de las fases)

| Sección | Qué contiene |
|---|---|
| **Objetivo general** | 2–3 líneas: qué existe al terminar que no existía al empezar |
| **Objetivos específicos** | lista corta y medible |
| **Qué vas a construir, en palabras simples** | la explicación sin jerga, para quien nunca vio el proyecto |
| **Glosario mínimo** | cada término técnico inevitable, en una línea |
| **Estado de partida** | tabla: qué ya existe y está verificado · detalle · qué fase lo usa |
| **Decisiones tomadas al validar contra el repo** | tabla: # · hallazgo · resolución · fase afectada |
| **Mapa de fases y dependencias** | tabla: fase · qué entrega en una línea · depende de · se verifica con |
| **Convenciones transversales** | las reglas que valen en TODAS las fases (nomenclatura, idioma, seguridad, qué no se toca) |

### Cada fase — siempre las mismas cinco secciones

| Sección | Regla al escribirla |
|---|---|
| **Qué se construye** | 1–2 líneas, lenguaje simple. Si no se puede explicar así, la fase es demasiado grande |
| **Depende de** | fases previas y/o condiciones del entorno. "Ninguna" también es una respuesta válida |
| **Archivos** | tabla `archivo → responsabilidad`. Rutas exactas, una responsabilidad por archivo |
| **Reglas** | las decisiones que la IA NO debe tomar por su cuenta: patrones, límites, qué está prohibido |
| **Cómo verificar al terminar** | acciones observables: qué comando correr, qué pantalla abrir, qué se debe ver |

### Cierre (después de las fases)

* **Si algo falla:** síntomas frecuentes → causa → arreglo.
* **Restricciones:** lo que esta sesión NO hace (y en qué fase futura se hace).
* **Entregables:** la lista de archivos y artefactos que deben existir al final.
* **Criterios de aceptación:** condiciones binarias para dar la sesión por cerrada.
* **Registro de cambios:** qué cambió en esta versión de la spec y por qué.

---

## Plantilla de una fase (copiable)

```markdown
## Fase N.M — <nombre corto>

**Prompt sugerido:** "Ejecuta la Fase N.M de `<archivo-spec>.md`."

### Qué se construye

<1–2 líneas en lenguaje simple>

### Depende de

<Fase N.M-1 / condiciones del entorno / "ninguna">

### Archivos

| Archivo | Rol |
|---|---|
| `ruta/exacta.ts` | <una responsabilidad, una línea> |

### Reglas

* <decisión ya tomada que la IA debe respetar>
* <qué está prohibido hacer en esta fase>

### Cómo verificar al terminar

1. <comando a correr> → <qué debe imprimir>
2. <pantalla a abrir> → <qué debe verse>
```

---

## Cómo se ejecuta la spec con la IA

* **Un prompt por fase**, en este formato: *"Ejecuta la Fase N.M de `archivo.md`."* La IA lee la
  spec completa y ejecuta solo esa fase.
* **No se adelanta trabajo de fases futuras**, aunque parezca trivial hacerlo ahora. Adelantar
  rompe la verificación de la fase actual y deja la spec desactualizada.
* **Al terminar cada fase se corre su verificación** antes de pasar a la siguiente. Una fase sin
  verificar es una fase sin terminar.
* Si durante la ejecución aparece algo que la spec no previó: **anotarlo en el registro de cambios**
  y actualizar la spec, no improvisar en silencio.

---

## Checklist antes de dar la spec por buena

- [ ] Cada afirmación del "Estado de partida" fue verificada en el repo real, no supuesta.
- [ ] Cada fase tiene las cinco secciones completas.
- [ ] Cada "Cómo verificar" se puede ejecutar sin leer el código (comando, pantalla, resultado).
- [ ] El mapa de dependencias no tiene ciclos y el orden de las fases lo respeta.
- [ ] Ningún archivo aparece en dos fases con responsabilidades distintas.
- [ ] Los términos técnicos están en el glosario.
- [ ] Está escrito qué NO hace esta sesión.
- [ ] Alguien que no participó de la conversación podría ejecutarla solo con el documento.

---

## Errores frecuentes

| Error | Por qué duele | Arreglo |
|---|---|---|
| Escribir la spec sin leer el repo | la IA implementa contra un proyecto que no existe | Regla 0 |
| Fases definidas como tareas ("crear componentes") | no se puede verificar el final | definirlas por entregable observable |
| Reglas vagas ("hacerlo bien", "que sea limpio") | la IA rellena con sus propios criterios | escribir la decisión concreta |
| Dejar decisiones abiertas dentro de una fase | la IA elige por su cuenta, y distinto cada vez | subirla a la cabecera y decidirla antes |
| Cambiar la spec mientras se ejecuta, sin registrarlo | nadie sabe qué versión se implementó | registro de cambios al final |
