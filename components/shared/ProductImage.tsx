"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

type ProductImageProps = {
  /** URL pública ya resuelta. `null` cuando el producto no tiene imagen. */
  src: string | null | undefined;
  /** Obligatorio: sin texto alternativo la imagen no pasa la revisión de a11y. */
  alt: string;
  /** Clases del contenedor: ahí se define tamaño y proporción. */
  className?: string;
  /** Pista de tamaños para el `srcset`; en grids evita descargar de más. */
  sizes?: string;
  priority?: boolean;
};

/**
 * Envoltorio de `next/image` que degrada a un placeholder.
 *
 * Existe porque las imágenes del seed NO están en Storage (decisión 13 de la
 * spec): sin esto el catálogo se vería con los iconos de imagen rota del
 * navegador. También cubre el caso de un producto sin imagen (`src` null).
 *
 * Siempre usa `fill`, así que el contenedor manda: se le pasa la proporción por
 * `className` (ej. "aspect-square").
 */
export function ProductImage({
  src,
  alt,
  className,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority,
}: ProductImageProps) {
  const [failed, setFailed] = React.useState(false);

  // Si cambia la URL (galería, navegación entre productos) se vuelve a intentar.
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const showPlaceholder = !src || failed;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className,
      )}
    >
      {showPlaceholder ? (
        <div
          className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground"
          // El alt ya viaja en el aria-label; el icono es decorativo.
          role="img"
          aria-label={alt}
        >
          <ImageOff className="size-6" aria-hidden="true" />
          <span className="px-2 text-center text-[0.7rem] leading-tight">
            Sin imagen
          </span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setFailed(true)}
          className="object-cover"
        />
      )}
    </div>
  );
}
