# Despliegue de MercadoTech

Manual de operación: dónde vive cada clave, cómo se publica un cambio y cómo se
vuelve atrás. Escrito en la sesión 7.

> **Regla de oro de este documento: aquí no hay ni un solo valor de clave.**
> Solo nombres de variables, dónde viven y quién las lee. Los valores se pegan
> a mano en el dashboard de Vercel y no pasan por el repositorio, por el chat
> ni por los logs.

---

## 1. Variables y secretos (Fase 7.3)

### 1.1 Tabla de gobernanza

Seis variables, y una fila que no existe a propósito.

| Variable | Dónde vive | Quién la lee | Pública / Secreta |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Production + Preview), cargada a mano | navegador y servidor | **pública** — viaja en el bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (ambos entornos), a mano | navegador y servidor | **pública** — no protege nada por sí sola: quien gobierna el acceso es la RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (ambos), a mano — solo runtime de servidor | `lib/supabase/admin.ts`, y solo desde Route Handlers y `scripts/` | 🔴 **SECRETA** — **bypasea la RLS por completo** |
| `HUGGINGFACEHUB_API_TOKEN` | Vercel (ambos), a mano | `lib/ai/` a través de los Route Handlers de `app/api/v1/` | 🔴 **SECRETA** |
| `NEXT_PUBLIC_SITE_URL` | Vercel, distinta por entorno (producción = la URL real; preview = la que asigna Vercel) | redirects de autenticación | pública |
| `HUGGINGFACE_EMBEDDING_MODEL`, `HUGGINGFACE_CHAT_MODEL` | Vercel, **solo si hace falta rotar de modelo** | `lib/ai/` | públicas (son nombres de modelo, no credenciales) |

| **GitHub Actions** | **ninguna variable, ningún secreto** | — | — |

Esa última fila es una decisión de diseño, no un olvido: el workflow de la
sesión 6 levanta su propio Supabase efímero y **no afirma respuestas de IA**,
así que no necesita ninguna credencial. Un CI sin secretos es un CI que no
puede filtrarlos — y en un repositorio público eso importa el doble.

### 1.2 Qué distingue una pública de una secreta

El prefijo `NEXT_PUBLIC_` no es una etiqueta descriptiva: es una **instrucción
al compilador**. Next sustituye esas variables por su valor literal dentro del
JavaScript que descarga el navegador. Cualquiera puede leerlas con "ver código
fuente".

De ahí las dos reglas que no se negocian:

* La `anon key` es pública **por diseño**, y es segura porque cada consulta que
  habilita pasa por las políticas RLS. Su seguridad vive en la base de datos,
  no en el secreto.
* La `service role key` **bypasea la RLS entera**. Prefijarla con
  `NEXT_PUBLIC_` una sola vez equivale a publicar la base de datos completa,
  con permiso de escritura, en internet. Por eso `lib/supabase/admin.ts` lleva
  `import "server-only"`: si alguien la importa desde un componente de
  navegador, **el build falla** en vez de desplegarse.

### 1.3 Reglas de operación

1. **Nunca commitear `.env*.local`.** Ya está en `.gitignore` (línea 21) y el
   historial está limpio (§1.4).
2. **Los valores solo se pegan en el dashboard de Vercel**, uno por uno,
   marcando Production y Preview. Nunca en el chat, en un issue, en un commit
   ni en un log.
3. **Si una clave se expone, se rota de inmediato** — antes de limpiar el
   historial: Supabase → Project Settings → API → rotar; Hugging Face →
   Settings → Access Tokens → revocar y crear otro. Un secreto que estuvo
   publicado un minuto en un repositorio público es un secreto quemado.
4. **Cambiar una variable en Vercel NO afecta a los deploys ya hechos.** Las
   `NEXT_PUBLIC_*` se incrustan **en tiempo de build**. Tras tocar cualquier
   variable: **Redeploy**, o el cambio no existe.
5. **Los previews comparten la base de datos de producción.** Un solo proyecto
   Supabase por alumno en el plan gratuito. Es una decisión asumida del
   laboratorio con un riesgo real: *un preview de un PR escribe sobre datos
   reales*. En un producto de verdad esto se resuelve con un proyecto de
   staging aparte, o con ramas de base de datos de Supabase.
6. **Ningún test apunta a producción.** Ni los unitarios (no tocan la red) ni
   los E2E (Supabase local, con `supabase db reset` antes). Correr la suite E2E
   contra un preview con `PLAYWRIGHT_BASE_URL=<url>` es una **herramienta
   manual** de diagnóstico, nunca parte del CI: los specs crean pedidos y
   productos de verdad.

### 1.4 Greps anti-fuga (evidencia)

El repositorio es **público**, así que esto no es higiene: es obligación antes
de cada push. Los cuatro deben devolver vacío.

```bash
EX='--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next
    --exclude-dir=coverage --exclude-dir=docs --exclude=package-lock.json'

grep -rn "hf_"        --include="*.ts" --include="*.tsx" --include="*.mjs" \
                      --include="*.sql" --include="*.yml" --include="*.json" $EX .
grep -rn "sb_secret"  --include="*.ts" --include="*.tsx" --include="*.mjs" \
                      --include="*.sql" --include="*.yml" --include="*.json" $EX .
grep -rn "eyJ"        --include="*.ts" --include="*.tsx" --include="*.mjs" \
                      --include="*.sql" --include="*.yml" --include="*.json" $EX .
git log --all -p -- .env.local
```

Resultado de la corrida de la Fase 7.3 (2026-09-02):

```
### grep -rn "hf_"        → (vacío)
### grep -rn "sb_secret"  → (vacío)
### grep -rn "eyJ"        → (vacío)
### git log --all -p -- .env.local → (vacío: nunca se commiteó)
```

Qué busca cada uno: `hf_` es el prefijo de los tokens de Hugging Face;
`sb_secret`, el de las claves secretas nuevas de Supabase; `eyJ` es el comienzo
de todo JWT en base64 (`{"alg"...`), que cubre las claves legacy `anon` y
`service_role`. Se excluye `docs/` porque este mismo archivo nombra los
prefijos: un gate que se marca a sí mismo deja de leerse.

Y el workflow, verificado a mano: `.github/workflows/ci.yml` **no contiene
ninguna referencia a `secrets.*`**. Las únicas credenciales que aparecen son
las claves fijas del stack local de Supabase, idénticas en la máquina de
cualquiera y sin valor fuera de un contenedor efímero — documentadas como tales
en el propio workflow.

### 1.5 Puesta en marcha local

En local no hay secretos que gobernar: `supabase start` imprime las claves del
stack efímero.

```bash
cp .env.example .env.local
supabase status -o env      # copiar los valores al .env.local
```

El único valor **personal** es `HUGGINGFACEHUB_API_TOKEN`: cada quien crea el
suyo en Hugging Face → Settings → Access Tokens (tipo *Read*). Sin él, el
catálogo, el carrito y los pedidos funcionan igual; lo que falla, con un error
controlado, son la búsqueda semántica y los dos asistentes.

---

## 2. Puesta en producción (Fase 7.4)

Arquitectura del despliegue: **todo por la interfaz de Vercel**. Sin CLI de
Vercel, sin tokens de deploy, sin jobs de despliegue en el workflow. Vercel se
conecta a GitHub desde su propio dashboard, y a partir de ahí cada PR levanta un
preview y cada merge a `main` publica producción.

```
Pull Request ──> CI (checks + e2e) ──verde──> merge a main ──> Vercel: PRODUCCIÓN
     │                   │                                            │
     │                 rojo ──> 🔒 merge bloqueado                     │
     └──> Vercel: PREVIEW (URL propia)                                 ▼
                                                        Supabase HOSTED (db push)
```

### 2.0 Antes de empezar: tres altas gratuitas

| # | Qué | Dónde |
|---|---|---|
| A | Proyecto Supabase `mercadotech-prod`, región São Paulo. **Guarda la contraseña de la base de datos**: se muestra una sola vez y `db push` la va a pedir. | supabase.com/dashboard → New project |
| B | Cuenta de Vercel, entrando con **la misma cuenta de GitHub** del repositorio. | vercel.com/signup → Continue with GitHub |
| C | Permisos de admin sobre el repositorio, para la regla de rama. | github.com/growlearnjo/mercadotech |

No crees ninguna tabla a mano en el dashboard de Supabase: las migraciones del
repositorio son la única fuente de verdad del esquema, y el paso 2.2 las aplica.

### 2.1 Los tres pasos de riesgo, con su plan B

| Riesgo | Síntoma | Plan B |
|---|---|---|
| **`db push` falla a medias** | Deja unas migraciones aplicadas y otras no: el esquema queda inconsistente | El proyecto está **vacío**, así que la salida barata es borrarlo y crear otro. `supabase migration repair` solo tendría sentido si ya hubiera datos que perder. |
| **El primer deploy sale rojo** | El build falla en Vercel aunque pase en local | Casi siempre es una `NEXT_PUBLIC_*` que falta: se necesitan **en tiempo de build**, no solo en runtime. Ir a la tabla de síntomas (§4) antes de tocar nada. |
| **El smoke test revela algo roto** | Producción carga, pero un flujo falla | No improvisar sobre producción: reproducir en local con `supabase db reset`, arreglar, PR, y que el CI lo valide. Si es grave, **rollback** (§3) primero y diagnóstico después. |

### 2.2 Migrar la base de datos hosted

```bash
supabase login
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

El `<ref>` es el identificador del proyecto: está en la URL del dashboard
(`https://supabase.com/dashboard/project/<ref>`) y en Project Settings → API.
`link` pide la contraseña de la base de datos, la que guardaste en la tarea A.

**Deberías ver** las migraciones aplicándose en orden y un `Finished supabase db
push`. Verifica en el dashboard → Table Editor: **15 tablas**, todas con RLS
activa, y en Storage el bucket `product-images`.

Si `db push` pide una contraseña que no tienes: Project Settings → Database →
Reset database password.

### 2.3 Sembrar producción

Dashboard → SQL Editor → New query → pegar el contenido de
[`supabase/seed.prod.sql`](../supabase/seed.prod.sql) → Run. **Una sola vez.**

**Deberías ver** `INSERT 0 8` y `INSERT 0 10`. Compruébalo:

```sql
select count(*) from public.categories;
select count(*) from public.support_articles where is_published;
```

Deben dar 8 y 10.

⚠️ **`supabase/seed.sql` JAMÁS se ejecuta contra producción.** Trae usuarios con
contraseñas publicadas en este repositorio.

### 2.4 Indexar la FAQ de producción

Los 10 artículos quedan sembrados pero sin embeddings, y hasta que los tengan
`/soporte` responderá que no encontró información. Se corre **una vez**, con las
variables en línea para no tocar `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<clave-secreta> HUGGINGFACEHUB_API_TOKEN=<token> npx tsx scripts/index-all.ts
```

**Deberías ver** el recuento de artículos indexados. Verifica en el dashboard:

```sql
select count(*) from public.knowledge_embeddings;
```

Debe dar 10. El script indexa productos activos + FAQ publicada; con el catálogo
vacío, los 10 son la FAQ. Es idempotente: repetirlo no duplica nada.

### 2.5 Desactivar la confirmación de email

Authentication → Sign In / Providers → Email → desactivar **Confirm email** →
Save.

En Supabase hosted viene **activada** (en local está apagada), y con ella un
registro nuevo no inicia sesión hasta abrir un correo que este proyecto no tiene
configurado. Es una decisión **de laboratorio, consciente**: en un producto real
se deja activada y se configura el proveedor de correo.

### 2.6 Importar el proyecto en Vercel

1. Vercel → **Add New → Project**.
2. Importar `growlearnjo/mercadotech`. Framework detectado: **Next.js**.
3. **ANTES de pulsar Deploy**, abrir *Environment Variables* y cargar a mano las
   de la tabla de §1.1, marcando cada una para **Production y Preview**:

   | Variable | Production | Preview |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ✔ | ✔ |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | ✔ |
   | `SUPABASE_SERVICE_ROLE_KEY` | ✔ | ✔ |
   | `HUGGINGFACEHUB_API_TOKEN` | ✔ | ✔ |
   | `NEXT_PUBLIC_SITE_URL` | ✔ (la URL real) | ✔ (la del preview) |

   Los valores se copian del dashboard de Supabase y de Hugging Face y se pegan
   aquí directamente. **No pasan por el chat ni por el repositorio.**
4. Settings → General → **Node.js Version: 24**, para que coincida con el CI
   (`NODE_VERSION: "24"` en el workflow) y con la máquina de desarrollo.
5. **Deploy**.

**Deberías ver** un build verde y una URL `*.vercel.app` que carga la tienda con
el catálogo **vacío** y su `EmptyState`. Eso es lo correcto: producción nace sin
productos (§2.3).

### 2.7 Poner el candado en `main` (branch protection)

GitHub → repositorio → **Settings → Branches → Add branch protection rule**:

* Branch name pattern: `main`
* ✔ **Require a pull request before merging**
* ✔ **Require status checks to pass before merging** → buscar y marcar los dos
  jobs del workflow: `Lint, tipos y tests unitarios` (job `checks`) y el job
  `e2e`.
* ✔ **Do not allow bypassing the above settings** — sin esto, un admin (tú) se
  salta el candado sin enterarse, y la regla decora en vez de proteger.

> Esto es posible en el plan gratuito **porque el repositorio es público**. En
> repositorios privados, la protección de ramas exige plan de pago.

### 2.8 Demostrar el flujo completo

La rama de prueba ya está preparada en local, con un cambio visible y trivial en
el pie de página:

```bash
git push -u origin deploy-smoke
```

Y en GitHub, abrir el PR hacia `main`. **Deberías ver**, en la página del PR:

1. Los dos checks del CI corriendo, y el botón de merge **bloqueado** mientras
   sigan en amarillo o se pongan en rojo.
2. Un comentario del bot de Vercel con la **URL del preview**, distinta de la de
   producción, mostrando el cambio.
3. Al ponerse verdes los checks, el merge se habilita.
4. Tras el merge, Vercel despliega `main` y **la URL de producción muestra el
   cambio** del pie.

Ese recorrido es el entregable de la fase: el candado bloqueando en rojo y
dejando pasar en verde.

### 2.9 Smoke test post-deploy

Sobre la URL de **producción**, en este orden:

| # | Qué | Qué debe pasar | ✅ |
|---|---|---|---|
| 1 | Abrir la home | Carga; catálogo **vacío** con su `EmptyState` (esperado) | ☐ |
| 2 | Registrarse como vendedor | Entra directo, sin pedir confirmación por correo (§2.5) | ☐ |
| 3 | Publicar 1 producto demo con imagen | Se guarda; la imagen sube a Storage | ☐ |
| 4 | Volver a la home | El producto aparece en el catálogo | ☐ |
| 5 | Abrir su detalle | Galería, precio y stock correctos | ☐ |
| 6 | En `/soporte`, preguntar cómo devolver un producto | Responde **citando la FAQ**; si el token de Hugging Face no está cargado, falla con el error controlado, no con una pantalla en blanco | ☐ |
| 7 | Logout y login | La sesión va y vuelve | ☐ |
| 8 | Favicon y título de la pestaña | Los de MercadoTech | ☐ |

Y en el dashboard de Supabase al terminar: 15 tablas, 10 artículos, 10
embeddings, y el producto demo con su imagen en el bucket.

> Anotar aquí los resultados de la corrida real, con fecha.

### 2.10 Opcional: E2E contra un preview

Herramienta **manual** de diagnóstico, nunca parte del CI:

```bash
PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npx playwright test --project=chromium
```

Los specs **crean pedidos y productos de verdad**, y los previews comparten la
base de datos de producción (§1.3, regla 5). Úsalo sabiendo lo que ensucia.

---

## 3. Rollback: volver al deploy anterior (Fase 7.5)

### 3.1 Cómo

1. Vercel → el proyecto → pestaña **Deployments**.
2. Localizar el último deploy que **sí** funcionaba (los de producción llevan la
   etiqueta *Production*).
3. Menú **⋯** → **Promote to Production** (o **Redeploy** sobre ese deploy).
4. Confirmar. En menos de un minuto la URL de producción vuelve a servir esa
   versión.

No hace falta tocar git: la vuelta atrás es inmediata porque cada deploy de
Vercel es inmutable y sigue disponible.

### 3.2 Cuándo usarlo

Cuando producción está rota y **todavía no se sabe por qué**. Primero se
restaura el servicio, después se diagnostica con calma en local. Perseguir el
bug con la tienda caída es la peor forma de arreglarlo.

### 3.3 Qué NO revierte un rollback de Vercel

**La base de datos.** Un rollback repone el código, y nada más:

* Las **migraciones aplicadas con `db push` siguen aplicadas**. Si el deploy
  roto traía un cambio de esquema, volver el código atrás lo deja hablando con
  un esquema que ya no es el suyo. Deshacer una migración exige **otra
  migración** que revierta el cambio, más su `db push`.
* Los **datos escritos siguen escritos**: pedidos creados, stock descontado,
  productos publicados. Nada de eso vuelve solo.
* Las **variables de entorno** no se versionan con el deploy. Si el problema fue
  una variable mal pegada, hay que corregirla en el dashboard y **redesplegar**
  (§1.3, regla 4).

Regla práctica: los cambios de esquema entran **antes** que el código que los
usa, y siempre hacia adelante — nunca a mitad de un incidente.

---

## 4. Si algo falla: síntomas y diagnóstico

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| El build falla en Vercel pero pasa en local | Falta una `NEXT_PUBLIC_*` (se necesitan **en build**) o la versión de Node no coincide | Revisar las variables en Project Settings → Environment Variables; alinear Node en Settings → General a la 24 |
| "Invalid API key" o autenticación rota en producción | Clave pegada con espacios, de otro proyecto, o variable cambiada **sin redeploy** | Re-pegar desde el dashboard de Supabase y **Redeploy** |
| Un registro nuevo no inicia sesión | "Confirm email" activo, que es como viene el hosted | Desactivarlo (§2.5), o confirmar el usuario a mano en el dashboard |
| `/soporte` responde que no encontró información | FAQ sembrada pero **sin indexar** | Correr `index-all.ts` con las variables de producción (§2.4) y verificar los 10 embeddings |
| El chat falla con un error del proveedor | Token de Hugging Face no cargado, o el modelo gratuito rotó | Cargar `HUGGINGFACEHUB_API_TOKEN` y redesplegar; si fue rotación, cambiar `HUGGINGFACE_CHAT_MODEL` (ver [`RAG.md`](RAG.md)) |
| Imágenes rotas en el catálogo | El producto no tiene imagen subida, o el path no es el de producción | `ProductImage` degrada a placeholder a propósito; verificar el bucket en el dashboard |
| Lighthouse da 60 en local y nadie entiende | Se midió sobre `next dev` | Medir siempre contra `npm run build && npm run start`, o contra la URL de Vercel (ver [`PERFORMANCE.md`](PERFORMANCE.md) §1) |
| El merge no se bloquea con el CI en rojo | La regla no tiene los checks marcados, o permite bypass | Revisar §2.7: los **dos** jobs requeridos y *Do not allow bypassing* activo |
| Un preview rompió datos de producción | Comparten base de datos (§1.3, regla 5) | Restaurar a mano lo tocado. La solución de fondo es un proyecto de staging aparte |
