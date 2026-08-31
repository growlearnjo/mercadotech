// Doble de utilería del cliente de Supabase (Fase 6.3).
//
// POR QUÉ EXISTE: desde la sesión 2 todo service tiene la firma
// `fn(args, supabase: Client = createClient())`. El cliente entra por la
// puerta, así que el test le pasa ESTE objeto y el service no se entera. No
// hace falta `vi.mock` de `lib/supabase/*` — y de hecho está PROHIBIDO
// (decisión 7 de la spec): mockear el módulo taparía el diseño que hace
// posible probar sin red, y dejaría pasar tests que solo funcionan con
// Docker encendido.
//
// QUÉ IMITA: la cadena de PostgREST (`from().select().eq().maybeSingle()`),
// `rpc()`, `storage.from().getPublicUrl()` y `auth.*`. No es un Supabase de
// verdad: es un objeto programable que devuelve lo que el test le dijo y
// APUNTA todo lo que le pidieron, para poder afirmarlo después.
//
// CÓMO SE PROGRAMA: una entrada por tabla, y dentro una respuesta por método
// TERMINAL de la cadena.
//
//   const supabase = mockSupabase({
//     cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
//     products: { single: { stock: 4 } },
//   });
//
// El método terminal se elige así: si la cadena llamó a `maybeSingle()` o a
// `single()`, esa es la llave; si no, la llave es la operación con la que
// empezó (`select`, `insert`, `update`, `delete` o `upsert`).

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** Base por defecto de las URLs públicas: la del Supabase local del proyecto. */
const DEFAULT_STORAGE_BASE = "http://127.0.0.1:54321/storage/v1/object/public";

/**
 * Error con la forma de un error de PostgREST.
 *
 * Los services propagan el error TAL CUAL (`if (error) throw error`), así que
 * los tests afirman su mensaje y su código reales — nunca un `toThrow()` a
 * secas, que pasaría también si el service fallara por otro motivo.
 */
export class MockDbError extends Error {
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(message: string, code = "PGRST000") {
    super(message);
    this.name = "MockDbError";
    this.code = code;
    this.details = null;
    this.hint = null;
  }
}

/** Azúcar para programar una respuesta que falla. */
export function dbError(message: string, code?: string): MockDbError {
  return new MockDbError(message, code);
}

/** Métodos que cierran una cadena y por los que se busca la respuesta. */
export type TerminalMethod =
  | "select"
  | "single"
  | "maybeSingle"
  | "insert"
  | "update"
  | "delete"
  | "upsert";

export type TableMock = Partial<Record<TerminalMethod, unknown>> & {
  /** `count` que devuelve un `select(cols, { count: "exact" })`. */
  count?: number;
};

/** Llaves reservadas: todo lo demás en el config se lee como nombre de tabla. */
const RESERVED_KEYS = ["tables", "rpc", "auth", "storageBase"] as const;

export type MockConfig = {
  /** Respuestas por tabla. Una tabla sin entrada devuelve `[]` / `null`. */
  tables?: Record<string, TableMock>;
  /** Respuestas de `supabase.rpc(nombre, params)`, por nombre de función. */
  rpc?: Record<string, unknown>;
  /** Respuestas de `supabase.auth.*`, por método. */
  auth?: Record<string, unknown>;
  /** Prefijo de las URLs públicas de Storage. */
  storageBase?: string;
} & {
  /** Atajo: una tabla se puede declarar en la raíz, sin envolverla en `tables`. */
  [table: string]: TableMock | Record<string, unknown> | string | undefined;
};

/** Un filtro aplicado a la cadena: `.eq("id", "p1")` → `{ method, column, value }`. */
export type FilterCall = {
  method: string;
  column: string;
  value: unknown;
};

/** Todo lo que el mock apunta de una llamada a una tabla. */
export type TableCall = {
  table: string;
  operation: TerminalMethod;
  /** Columnas pedidas en `select()`, si hubo. */
  columns?: string;
  /** Payload de insert / update / upsert. */
  payload?: unknown;
  filters: FilterCall[];
  orders: { column: string; ascending: boolean }[];
  range?: { from: number; to: number };
  limit?: number;
  /** Método terminal por el que se resolvió la respuesta. */
  resolvedBy: TerminalMethod;
};

export type SupabaseMock = SupabaseClient<Database> & {
  /** Payloads pasados a `.insert()` sobre esa tabla, en orden. */
  inserts(table: string): unknown[];
  /** Payloads pasados a `.update()` sobre esa tabla, en orden. */
  updates(table: string): unknown[];
  /** Payloads pasados a `.upsert()` sobre esa tabla, en orden. */
  upserts(table: string): unknown[];
  /** Cuántos `.delete()` se ejecutaron sobre esa tabla. */
  deletes(table: string): number;
  /** Filtros aplicados en la ÚLTIMA llamada a esa tabla. */
  filters(table: string): FilterCall[];
  /** Registro completo de llamadas (a una tabla, o a todas). */
  calls(table?: string): TableCall[];
  /** Llamadas a `rpc()`, en orden. */
  rpcCalls(): { name: string; params: unknown }[];
  /** Argumentos con los que se llamó a un método de `auth`, en orden. */
  authCalls(method: string): unknown[][];
};

type Resolved = { data: unknown; error: MockDbError | null; count: number | null };

function resolveTable(
  config: MockConfig,
  table: string,
  key: TerminalMethod,
): Resolved {
  const tableMock =
    config.tables?.[table] ??
    ((RESERVED_KEYS as readonly string[]).includes(table)
      ? undefined
      : (config[table] as TableMock | undefined)) ??
    {};
  const programmed = tableMock[key];

  if (programmed instanceof MockDbError) {
    return { data: null, error: programmed, count: null };
  }

  if (programmed === undefined) {
    // Sin programar: una lista vacía para las consultas de conjunto y `null`
    // para las de fila única. Es el default menos sorprendente — y si un
    // service necesitaba datos, el test falla de forma ruidosa y evidente.
    const emptyIsNull = key === "single" || key === "maybeSingle";
    return {
      data: emptyIsNull ? null : [],
      error: null,
      count: tableMock.count ?? null,
    };
  }

  return { data: programmed, error: null, count: tableMock.count ?? null };
}

/**
 * Constructor de consultas encadenable Y "thenable": cada método devuelve
 * `this`, y `await` sobre él resuelve la respuesta programada. Es exactamente
 * lo que hace `PostgrestFilterBuilder` de verdad, y por eso los services no
 * notan la diferencia.
 */
class QueryBuilderMock {
  private operation: TerminalMethod | null = null;
  private terminal: TerminalMethod | null = null;
  private readonly call: TableCall;

  constructor(
    private readonly config: MockConfig,
    private readonly table: string,
    private readonly log: TableCall[],
  ) {
    this.call = {
      table,
      operation: "select",
      filters: [],
      orders: [],
      resolvedBy: "select",
    };
  }

  private setOperation(operation: TerminalMethod): void {
    // La primera gana: en `update(...).eq(...).select("id")` la operación es
    // el update, no el select que solo pide qué devolver.
    if (this.operation === null) {
      this.operation = operation;
      this.call.operation = operation;
    }
  }

  select(columns?: string): this {
    this.setOperation("select");
    if (columns !== undefined) this.call.columns = columns;
    return this;
  }

  insert(payload: unknown): this {
    this.setOperation("insert");
    this.call.payload = payload;
    return this;
  }

  update(payload: unknown): this {
    this.setOperation("update");
    this.call.payload = payload;
    return this;
  }

  upsert(payload: unknown): this {
    this.setOperation("upsert");
    this.call.payload = payload;
    return this;
  }

  delete(): this {
    this.setOperation("delete");
    return this;
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ method: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.call.filters.push({ method: "neq", column, value });
    return this;
  }

  in(column: string, value: unknown): this {
    this.call.filters.push({ method: "in", column, value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.call.filters.push({ method: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.call.filters.push({ method: "lte", column, value });
    return this;
  }

  or(expression: string): this {
    this.call.filters.push({ method: "or", column: "", value: expression });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.call.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  range(from: number, to: number): this {
    this.call.range = { from, to };
    return this;
  }

  limit(count: number): this {
    this.call.limit = count;
    return this;
  }

  single(): this {
    this.terminal = "single";
    return this;
  }

  maybeSingle(): this {
    this.terminal = "maybeSingle";
    return this;
  }

  /** `await query` — resuelve y deja la llamada apuntada en el registro. */
  then<TResult1 = Resolved, TResult2 = never>(
    onfulfilled?: ((value: Resolved) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const key = this.terminal ?? this.operation ?? "select";
    this.call.resolvedBy = key;
    this.log.push(this.call);
    return Promise.resolve(resolveTable(this.config, this.table, key)).then(
      onfulfilled,
      onrejected,
    );
  }
}

/**
 * Crea el doble. Todo lo que no se programe devuelve el default vacío, así
 * que un test solo declara lo que le importa a ESE caso.
 */
export function mockSupabase(config: MockConfig = {}): SupabaseMock {
  const log: TableCall[] = [];
  const rpcLog: { name: string; params: unknown }[] = [];
  const authLog = new Map<string, unknown[][]>();

  function recordAuth(method: string, args: unknown[]): void {
    const previous = authLog.get(method) ?? [];
    previous.push(args);
    authLog.set(method, previous);
  }

  function authResult(method: string): unknown {
    const programmed = config.auth?.[method];
    if (programmed instanceof MockDbError) {
      return { data: { user: null, session: null }, error: programmed };
    }
    return programmed ?? { data: { user: null, session: null }, error: null };
  }

  const storageBase = config.storageBase ?? DEFAULT_STORAGE_BASE;

  const client = {
    from(table: string) {
      return new QueryBuilderMock(config, table, log);
    },

    rpc(name: string, params: unknown) {
      rpcLog.push({ name, params });
      const programmed = config.rpc?.[name];
      if (programmed instanceof MockDbError) {
        return Promise.resolve({ data: null, error: programmed });
      }
      return Promise.resolve({ data: programmed ?? null, error: null });
    },

    storage: {
      from(bucket: string) {
        return {
          // Puramente sintáctico, igual que el real: construye la URL y no
          // comprueba que el objeto exista.
          getPublicUrl(path: string) {
            return { data: { publicUrl: `${storageBase}/${bucket}/${path}` } };
          },
          upload(path: string, file: unknown) {
            recordAuth("storage.upload", [bucket, path, file]);
            return Promise.resolve({ data: { path }, error: null });
          },
          remove(paths: string[]) {
            recordAuth("storage.remove", [bucket, paths]);
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    },

    auth: {
      signUp(...args: unknown[]) {
        recordAuth("signUp", args);
        return Promise.resolve(authResult("signUp"));
      },
      signInWithPassword(...args: unknown[]) {
        recordAuth("signInWithPassword", args);
        return Promise.resolve(authResult("signInWithPassword"));
      },
      signOut(...args: unknown[]) {
        recordAuth("signOut", args);
        const programmed = config.auth?.signOut;
        if (programmed instanceof MockDbError) {
          return Promise.resolve({ error: programmed });
        }
        return Promise.resolve({ error: null });
      },
      getUser(...args: unknown[]) {
        recordAuth("getUser", args);
        return Promise.resolve(authResult("getUser"));
      },
      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        recordAuth("onAuthStateChange", [callback]);
        const unsubscribe = () => recordAuth("unsubscribe", []);
        return {
          data: { subscription: { unsubscribe } },
        };
      },
    },

    inserts(table: string) {
      return log
        .filter((entry) => entry.table === table && entry.operation === "insert")
        .map((entry) => entry.payload);
    },
    updates(table: string) {
      return log
        .filter((entry) => entry.table === table && entry.operation === "update")
        .map((entry) => entry.payload);
    },
    upserts(table: string) {
      return log
        .filter((entry) => entry.table === table && entry.operation === "upsert")
        .map((entry) => entry.payload);
    },
    deletes(table: string) {
      return log.filter(
        (entry) => entry.table === table && entry.operation === "delete",
      ).length;
    },
    filters(table: string) {
      const entries = log.filter((entry) => entry.table === table);
      return entries.length > 0 ? entries[entries.length - 1].filters : [];
    },
    calls(table?: string) {
      return table === undefined
        ? [...log]
        : log.filter((entry) => entry.table === table);
    },
    rpcCalls() {
      return [...rpcLog];
    },
    authCalls(method: string) {
      return authLog.get(method) ?? [];
    },
  };

  // El doble no implementa TODA la superficie de SupabaseClient (ni falta):
  // el cast la declara compatible para que los services lo acepten por su
  // último parámetro sin castear en cada test.
  return client as unknown as SupabaseMock;
}

/** Atajo para afirmar un filtro sin escribir el objeto entero. */
export function hasFilter(
  filters: FilterCall[],
  method: string,
  column: string,
  value?: unknown,
): boolean {
  return filters.some(
    (filter) =>
      filter.method === method &&
      filter.column === column &&
      (value === undefined || JSON.stringify(filter.value) === JSON.stringify(value)),
  );
}
