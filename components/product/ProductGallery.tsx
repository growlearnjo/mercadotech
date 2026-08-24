"use client";

import * as React from "react";

import { ProductImage } from "@/components/shared/ProductImage";
import { cn } from "@/lib/utils";
import type { ProductImage as ProductImageType } from "@/types/product";

type ProductGalleryProps = {
  images: ProductImageType[];
  /** Título del producto: base del texto alternativo de cada imagen. */
  title: string;
};

/**
 * Galería del detalle: imagen grande + tira de miniaturas.
 *
 * Las miniaturas son un `tablist` porque eso es exactamente lo que son —
 * controles que cambian el panel principal — y así se recorren con ←/→ como
 * espera un lector de pantalla.
 */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [index, setIndex] = React.useState(0);
  const buttonsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Si cambia el producto, volver a la primera imagen.
  React.useEffect(() => setIndex(0), [images]);

  const current = images[index];

  const move = (next: number) => {
    const bounded = (next + images.length) % images.length;
    setIndex(bounded);
    buttonsRef.current[bounded]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (images.length < 2) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(index - 1);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ProductImage
        src={current?.image_url ?? null}
        alt={
          images.length > 1
            ? `${title} — imagen ${index + 1} de ${images.length}`
            : title
        }
        className="aspect-square w-full rounded-lg border border-border"
        sizes="(min-width: 1024px) 45vw, 100vw"
        priority
      />

      {images.length > 1 ? (
        <div
          role="tablist"
          aria-label="Imágenes del producto"
          onKeyDown={handleKeyDown}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {images.map((image, i) => (
            <button
              key={image.id}
              ref={(el) => {
                buttonsRef.current[i] = el;
              }}
              role="tab"
              type="button"
              aria-selected={i === index}
              aria-label={`Ver imagen ${i + 1} de ${images.length}`}
              // Un solo tab stop: se entra a la tira y se recorre con flechas.
              tabIndex={i === index ? 0 : -1}
              onClick={() => setIndex(i)}
              className={cn(
                "shrink-0 overflow-hidden rounded-md border-2 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                i === index ? "border-primary" : "border-transparent",
              )}
            >
              <ProductImage
                src={image.image_url}
                alt=""
                className="size-16 rounded-none"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
