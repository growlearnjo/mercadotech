import { Brand } from "@/components/layout/Brand";

/**
 * Layout de autenticación: sin navbar ni distracciones, tarjeta centrada.
 * Es un Server Component: no necesita estado ni interactividad propia.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Brand size="lg" />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-center text-xs text-muted-foreground">
        Proyecto de curso. El checkout es simulado y no procesa pagos reales.
      </p>
    </div>
  );
}
