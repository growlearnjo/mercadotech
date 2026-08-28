/**
 * DERIVACIÓN documentada (lección 6): el proyecto web no expone perfiles de
 * vendedores — `seller.service.ts` solo sirve al vendedor sus PROPIOS datos
 * con su sesión, y no hay pantalla de "tienda del vendedor".
 *
 * Requiere el cliente ADMIN porque la política `profiles_select_own_or_admin`
 * no concede SELECT público (deuda documentada en la bitácora S3: por eso la
 * web muestra "Usuario" y "Comprador verificado" en vez de nombres).
 *
 * REGLA DURA: de `profiles` solo puede salir `display_name`. Nunca `phone`,
 * nunca el rol, nunca el id de auth de un comprador. Por eso las consultas de
 * este archivo seleccionan columnas explícitas y jamás `*`.
 */
import { listActiveProducts } from "@/services/product.service";
import type { Client } from "../context";
import { notFound } from "../lib/errors";

/** Vendedores que hoy tienen al menos un producto activo publicado. */
export async function listSellerIds(anon: Client, admin: Client) {
  const { items } = await listActiveProducts({ page: 1 }, anon);
  const sellerIds = [...new Set(items.map((product) => product.seller_id))];
  if (sellerIds.length === 0) return [];

  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", sellerIds);
  if (error) throw error;

  return (data ?? []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name ?? "Vendedor",
  }));
}

export async function getSellerProfile(sellerId: string, anon: Client, admin: Client) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("id", sellerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("un vendedor", sellerId);

  // Se listan con anon: solo debe verse lo que cualquier visitante vería.
  const { items } = await listActiveProducts({ page: 1 }, anon);
  const own = items.filter((product) => product.seller_id === sellerId);

  return {
    id: data.id,
    displayName: data.display_name ?? "Vendedor",
    activeProducts: own.map((product) => ({
      id: product.id,
      title: product.title,
      price: product.price,
      currency: "PEN",
      condition: product.condition,
      stock: product.stock,
    })),
  };
}
