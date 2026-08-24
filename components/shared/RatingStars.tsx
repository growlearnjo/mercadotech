"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

const MAX_STARS = 5;

const SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

type RatingStarsProps = {
  /** Valor actual, 0–5. Admite decimales en modo lectura (ej. 4.8). */
  value: number;
  /** Si se pasa, el control es editable. Si no, es solo lectura. */
  onChange?: (value: number) => void;
  size?: keyof typeof SIZES;
  /** Etiqueta accesible del grupo cuando es editable. */
  label?: string;
  className?: string;
};

/**
 * Estrellas de 1 a 5.
 *
 * El color es `--primary`: el mockup muestra la calificación en el mismo azul
 * de la marca, no en el ámbar habitual.
 *
 * En solo lectura pinta fracciones (4.8 → 4 llenas + 80 % de la quinta) usando
 * una capa recortada por ancho, y se anuncia como un único texto.
 *
 * En modo editable sigue el patrón radiogroup: un solo tab stop, flechas para
 * moverse y Home/End para ir a los extremos.
 */
export function RatingStars({
  value,
  onChange,
  size = "md",
  label = "Calificación",
  className,
}: RatingStarsProps) {
  const iconSize = SIZES[size];
  const clamped = Math.min(MAX_STARS, Math.max(0, value));

  if (!onChange) {
    return (
      <span
        className={cn("relative inline-flex shrink-0", className)}
        role="img"
        aria-label={`${clamped.toFixed(1)} de ${MAX_STARS} estrellas`}
      >
        {/* Capa base: contornos. */}
        <span aria-hidden="true" className="flex text-muted-foreground/50">
          {Array.from({ length: MAX_STARS }, (_, i) => (
            <Star key={i} className={iconSize} />
          ))}
        </span>
        {/* Capa de relleno, recortada al porcentaje exacto. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex overflow-hidden text-primary"
          style={{ width: `${(clamped / MAX_STARS) * 100}%` }}
        >
          {Array.from({ length: MAX_STARS }, (_, i) => (
            <Star key={i} className={cn(iconSize, "fill-current")} />
          ))}
        </span>
      </span>
    );
  }

  const move = (next: number) => onChange(Math.min(MAX_STARS, Math.max(1, next)));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = Math.round(clamped);
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        move(current + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        move(current - 1);
        break;
      case "Home":
        event.preventDefault();
        move(1);
        break;
      case "End":
        event.preventDefault();
        move(MAX_STARS);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex shrink-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const starValue = i + 1;
        const active = starValue <= Math.round(clamped);
        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${starValue} ${starValue === 1 ? "estrella" : "estrellas"}`}
            // Un solo tab stop: el contenedor. Los botones se alcanzan con flechas.
            tabIndex={-1}
            onClick={() => onChange(starValue)}
            className="cursor-pointer p-0.5 text-muted-foreground/50 transition-colors hover:text-primary"
          >
            <Star
              className={cn(iconSize, active && "fill-current text-primary")}
            />
          </button>
        );
      })}
    </div>
  );
}
