"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Brand } from "@/components/layout/Brand";
import { SellerSidebar } from "@/components/layout/SellerSidebar";
import { Container } from "@/components/shared/Container";
import { LoadingState } from "@/components/shared/LoadingState";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAuth } from "@/hooks/useAuth";

/**
 * Layout del panel del vendedor, con guard de rol.
 *
 * El middleware ya garantiza que hay SESIÓN en /vendedor/**; lo que no puede
 * comprobar sin una consulta extra es el ROL, que vive en `profiles`. Ese
 * segundo filtro se hace aquí.
 */
export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, initializing, logout } = useAuth();

  const allowed = profile?.role === "seller" || profile?.role === "admin";

  React.useEffect(() => {
    // Mientras se resuelve la sesión no se decide nada: expulsar aquí echaría
    // también a vendedores legítimos en el primer render.
    if (initializing) return;
    if (!allowed) {
      toast.error("Necesitas una cuenta de vendedor");
      router.replace("/");
    }
  }, [initializing, allowed, router]);

  if (initializing || !allowed) {
    // No se pinta el panel hasta confirmar el rol: evita el parpadeo de ver
    // por un instante una pantalla que no corresponde.
    return (
      <Container width="wide" className="py-10">
        <LoadingState variant="card" label="Verificando tu cuenta" />
      </Container>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-card">
        <Container
          width="wide"
          className="flex h-16 items-center justify-between gap-4"
        >
          <div className="flex items-baseline gap-3">
            <Brand />
            <span className="text-sm text-muted-foreground">
              Panel del vendedor
            </span>
          </div>
          <UserMenu user={profile} onLogout={logout} />
        </Container>
      </header>

      <Container
        width="wide"
        className="flex flex-1 flex-col gap-6 py-6 md:flex-row"
      >
        <SellerSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </Container>
    </div>
  );
}
