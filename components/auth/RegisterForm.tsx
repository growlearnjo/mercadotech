"use client";

import * as React from "react";
import { ShoppingBag, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  validateRegister,
  type RegisterInput,
  type RegistrableRole,
} from "@/lib/validators/auth";

type RegisterFormProps = {
  onSubmit: (values: RegisterInput) => void;
  loading?: boolean;
  error?: string | null;
};

const ROLE_OPTIONS: {
  value: RegistrableRole;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "buyer",
    label: "Quiero comprar",
    hint: "Navega el catálogo y haz pedidos.",
    icon: ShoppingBag,
  },
  {
    value: "seller",
    label: "Quiero vender",
    hint: "Publica productos y gestiona pedidos.",
    icon: Store,
  },
];

export function RegisterForm({ onSubmit, loading, error }: RegisterFormProps) {
  const [values, setValues] = React.useState<RegisterInput>({
    email: "",
    password: "",
    displayName: "",
    role: "buyer",
  });
  const [errors, setErrors] = React.useState<
    Partial<Record<keyof RegisterInput, string>>
  >({});

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateRegister(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.value);
  };

  const update = (field: "email" | "password" | "displayName") => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => setValues((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Nombre</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          value={values.displayName}
          onChange={update("displayName")}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
        />
        {errors.displayName ? (
          <p id="displayName-error" className="text-sm text-destructive">
            {errors.displayName}
          </p>
        ) : null}
      </div>

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
          autoComplete="new-password"
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

      {/* Selector de rol como radiogroup real: se recorre con flechas y se
          anuncia como un grupo, no como dos botones sueltos. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          ¿Cómo quieres usar MercadoTech?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
            const selected = values.role === value;
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                  selected
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={selected}
                  onChange={() =>
                    setValues((prev) => ({ ...prev, role: value }))
                  }
                  className="sr-only"
                />
                <Icon className="size-4" aria-hidden="true" />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </label>
            );
          })}
        </div>
        {errors.role ? (
          <p className="text-sm text-destructive">{errors.role}</p>
        ) : null}
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
