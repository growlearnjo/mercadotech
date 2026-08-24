"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { RegisterInput } from "@/lib/validators/auth";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, loading, error, user, initializing } = useAuth();

  const redirectTo = searchParams.get("redirectTo") ?? "/";

  React.useEffect(() => {
    if (!initializing && user) router.replace(redirectTo);
  }, [initializing, user, redirectTo, router]);

  const handleSubmit = async (values: RegisterInput) => {
    const ok = await register({
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      role: values.role,
    });
    // En local `enable_confirmations = false`, así que el alta deja sesión
    // iniciada y se puede navegar de inmediato.
    if (ok) router.push(redirectTo);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu cuenta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RegisterForm onSubmit={handleSubmit} loading={loading} error={error} />
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="text-primary hover:underline"
          >
            Ingresar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={null}>
      <RegisterPageContent />
    </React.Suspense>
  );
}
