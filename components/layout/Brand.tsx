import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  /** `onDark` invierte el color del texto para la barra navy superior. */
  tone?: "default" | "onDark";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
} as const;

/**
 * Wordmark de MercadoTech.
 *
 * El mockup remata la marca con un punto en el color primario; se replica ese
 * gesto. Vive en su propio archivo porque aparece en el navbar, en el layout
 * de auth y en el sidebar del vendedor: duplicar el marcado en tres sitios
 * garantiza que se desincronicen.
 */
export function Brand({ tone = "default", size = "md", className }: BrandProps) {
  return (
    <Link
      href="/"
      className={cn(
        "font-semibold tracking-tight",
        SIZES[size],
        tone === "onDark" ? "text-white" : "text-foreground",
        className,
      )}
    >
      MercadoTech
      <span className="text-primary" aria-hidden="true">
        .
      </span>
    </Link>
  );
}
