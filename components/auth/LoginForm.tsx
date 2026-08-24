"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateLogin, type LoginInput } from "@/lib/validators/auth";

type LoginFormProps = {
  onSubmit: (values: LoginInput) => void;
  loading?: boolean;
  /** Error del servidor (credenciales, red). Los de formato salen del validador. */
  error?: string | null;
};

export function LoginForm({ onSubmit, loading, error }: LoginFormProps) {
  const [values, setValues] = React.useState<LoginInput>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = React.useState<Partial<LoginInput>>({});

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateLogin(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value);
  };

  const update = (field: keyof LoginInput) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => setValues((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={update("password")}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password ? (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password}
          </p>
        ) : null}
      </div>

      {error ? (
        // `alert` para que el lector de pantalla lo anuncie al aparecer.
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
