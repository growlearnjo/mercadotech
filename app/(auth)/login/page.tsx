"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

/**
 * Página de acceso. Es el punto donde el hook se conecta con el formulario
 * puro: el formulario no sabe de Supabase ni de routing.
 */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, error, user, initializing } = useAuth();

  // A dónde volver tras entrar. Lo pone el middleware al expulsar de una ruta
  // protegida; si no viene, al inicio.
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  // Si ya hay sesión (p. ej. se llegó aquí con el botón atrás), no tiene
  // sentido mostrar el formulario.
  React.useEffect(() => {
    if (!initializing && user) router.replace(redirectTo);
  }, [initializing, user, redirectTo, router]);

  const handleSubmit = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const ok = await login(email, password);
    if (ok) router.push(redirectTo);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresa a tu cuenta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />
        <p className="text-center text-sm text-muted-foreground">
          ¿Aún no tienes cuenta?{" "}
          <Link
            href={`/register?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="text-primary hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  // `useSearchParams` obliga a un límite de Suspense para no forzar el
  // renderizado dinámico de toda la ruta.
  return (
    <React.Suspense fallback={null}>
      <LoginPageContent />
    </React.Suspense>
  );
}
