// E2E del centro de soporte — MODO TEXTO (Fase 8.4).
//
// POR QUÉ AQUÍ NO SE PRUEBA LA VOZ, y no es una omisión:
//
//   1. No hay micrófono en un runner de CI. Ni tarjeta de sonido, ni alguien
//      que hable.
//   2. `SpeechRecognition` no existe en un navegador headless: la propia API
//      que probaríamos está ausente.
//   3. El permiso de micrófono es una decisión del usuario en el navegador,
//      justo lo que un test automatizado no puede representar.
//
// Simular la Web Speech API para "probar la voz" daría un test verde que no
// prueba nada: estaríamos verificando nuestro propio simulador. La voz se
// verifica a mano, con la checklist de la demo (Fase 8.5).
//
// Y ESTO SIGUE CUBRIENDO LO QUE IMPORTA, porque la arquitectura lo permite:
// el agente no sabe que existe la voz. Recibe texto y devuelve texto, así que
// el camino que recorre este spec —clasificar, consultar, proponer,
// confirmar, crear el ticket— es EXACTAMENTE el mismo que recorrería dictando.
// Lo único sin cubrir es el transporte.
//
// DOS PRERREQUISITOS, no uno:
//
//   supabase db reset                # como toda la suite
//   npx tsx scripts/index-all.ts     # ADEMÁS, para los specs del agente
//
// El segundo se descubrió aquí: `db reset` reconstruye las tablas y siembra la
// FAQ, pero NO genera sus embeddings —eso cuesta llamadas al proveedor de IA y
// no cabe en un archivo .sql—. Sin ese paso la tabla knowledge_embeddings
// queda vacía, la búsqueda semántica no encuentra nada y el agente responde,
// con toda corrección, que no halló información. El test se pone rojo por
// datos que faltan, no por código roto. Es el mismo tipo de desajuste que
// `npm run db:images` resuelve para las fotos del catálogo.

import { expect, test } from "@/e2e/fixtures/test";
import { BUYER1 } from "@/e2e/data/users";

/**
 * ¿Se puede hablar con el modelo en esta corrida?
 *
 * El CI corre SIN SECRETOS a propósito (decisión de la sesión 6), así que allí
 * no hay token de Hugging Face y los turnos que dependen del modelo no pueden
 * probarse. En vez de simular la IA —lo que verificaría nuestro propio
 * simulador y no el agente— esos tests se SALTAN con su motivo visible en el
 * reporte, y el resto del spec sigue corriendo.
 */
const HAY_MODELO = Boolean(process.env.HUGGINGFACEHUB_API_TOKEN);
const SIN_MODELO =
  "Requiere HUGGINGFACEHUB_API_TOKEN: el CI corre sin secretos y el agente no puede responder.";

/** Asunto único por corrida: el ticket sobrevive hasta el siguiente reset. */
function reclamoUnico(): string {
  return `la laptop llegó rayada, referencia E2E ${Date.now()}`;
}

test.describe("Centro de soporte — agente en modo texto", () => {
  test("responde una duda de la FAQ citando sus fuentes", async ({
    page,
    loginAs,
  }) => {
    test.skip(!HAY_MODELO, SIN_MODELO);

    await loginAs(BUYER1);
    await page.goto("/soporte");

    await page.getByTestId("chat-input").fill("¿cómo devuelvo un producto?");
    await page.getByTestId("chat-send").click();

    // El agente hace dos llamadas al modelo por turno (clasificar y redactar)
    // contra un servicio gratuito: el margen es holgado a propósito.
    const respuesta = page.getByTestId("chat-message-assistant").first();
    await expect(respuesta).toBeVisible({ timeout: 45_000 });

    // QUÉ SE AFIRMA Y QUÉ NO, que aquí es toda la cuestión.
    //
    // Se afirma que el turno LLEGÓ y no reventó: hay una respuesta del
    // asistente y no es el mensaje de error inline.
    //
    // NO se afirma su contenido, ni que traiga fuentes citadas. Se intentó y
    // el test salió INTERMITENTE: que el RAG encuentre algo depende de superar
    // un umbral de similitud, y eso varía según cómo el modelo vectorice la
    // pregunta — el mismo test pasaba y fallaba sin cambiar una línea. Un test
    // que falla al azar no protege nada: entrena a ignorar el rojo.
    //
    // Es la misma regla que la sesión 6 se puso al escribir los E2E del chat:
    // no se afirman respuestas de IA. Que las fuentes viajen del orquestador a
    // la interfaz SÍ está cubierto, en support-agent.service.test.ts, donde el
    // modelo es un doble y el resultado es determinista.
    await expect(respuesta).not.toContainText("No pude procesar tu mensaje");
  });

  test("un reclamo exige confirmación y solo entonces crea el ticket", async ({
    page,
    loginAs,
  }) => {
    test.skip(!HAY_MODELO, SIN_MODELO);

    const reclamo = reclamoUnico();

    await loginAs(BUYER1);
    await page.goto("/soporte");

    await test.step("1. el usuario plantea el reclamo", async () => {
      await page.getByTestId("chat-input").fill(`quiero reclamar porque ${reclamo}`);
      await page.getByTestId("chat-send").click();
      await expect(page.getByTestId("chat-message-assistant").first()).toBeVisible({
        timeout: 45_000,
      });
    });

    await test.step("2. el agente PROPONE y no ha creado nada", async () => {
      // La garantía dura de la sesión: consultar es directo, escribir se
      // pregunta. Si esta aserción se pone roja, el agente está actuando sin
      // permiso y eso es un fallo grave, no un detalle de redacción.
      await expect(page.getByTestId("ticket-created-card")).toHaveCount(0);
    });

    await test.step("3. el usuario confirma y ahí sí se crea", async () => {
      await page.getByTestId("chat-input").fill("sí, confirmo");
      await page.getByTestId("chat-send").click();

      const tarjeta = page.getByTestId("ticket-created-card");
      await expect(tarjeta).toBeVisible({ timeout: 45_000 });
      await expect(tarjeta).toContainText("Ticket creado");
    });

    await test.step("4. aparece en Mis tickets", async () => {
      await expect(page.getByTestId("my-tickets")).toContainText("Reclamo");
    });

    await test.step("5. su detalle muestra la conversación y permite cerrarlo", async () => {
      await page.getByTestId("ticket-created-card").getByRole("link").click();

      const detalle = page.getByTestId("ticket-detail");
      await expect(detalle).toBeVisible();
      // El primer mensaje es del usuario, no del sistema: quien reclama es la
      // persona, y así lo lee quien atienda el ticket.
      await expect(detalle).toContainText("Tú");

      await page.getByTestId("ticket-close").click();
      await expect(detalle).toContainText("Cerrado");
    });
  });

  test("el botón de voz existe y no bloquea el uso por teclado", async ({
    page,
    loginAs,
  }) => {
    // No se prueba que el micrófono FUNCIONE (ver la cabecera), sino la regla
    // de paridad: la voz es un acelerador y su ausencia no impide nada. En un
    // navegador headless `isVoiceSupported` es false, así que este test recorre
    // exactamente el caso de Firefox.
    await loginAs(BUYER1);
    await page.goto("/soporte");

    await expect(page.getByTestId("voice-button")).toBeVisible();
    await expect(page.getByTestId("chat-input")).toBeEnabled();
  });

  test("un anónimo en /soporte acaba en /login", async ({ page }) => {
    await page.goto("/soporte");
    await expect(page).toHaveURL(/\/login/);
  });
});
