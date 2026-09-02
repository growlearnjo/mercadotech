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
