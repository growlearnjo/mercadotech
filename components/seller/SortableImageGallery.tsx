"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/shared/ProductImage";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGE_BYTES,
} from "@/lib/constants/product";

/** Una miniatura, ya venga de Storage o de un File aún sin subir. */
export type GalleryImage = {
  /** id de `product_images`, o un id local para las que no se subieron aún. */
  id: string;
  url: string;
  /** true si todavía vive solo en el navegador. */
  isLocal: boolean;
};

type SortableImageGalleryProps = {
  images: GalleryImage[];
  onReorder: (images: GalleryImage[]) => void;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** Mensaje de error de validación de archivos. */
  error?: string | null;
  disabled?: boolean;
};

function SortableThumb({
  image,
  index,
  onRemove,
  disabled,
}: {
  image: GalleryImage;
  index: number;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <ProductImage
        src={image.url}
        alt=""
        className="aspect-square w-full rounded-none"
        sizes="128px"
      />

      {index === 0 ? (
        <span className="absolute top-1 left-1 rounded-4xl bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
          Portada
        </span>
      ) : null}

      {/* El asa lleva los listeners de dnd-kit; `sortableKeyboardCoordinates`
          hace que con Espacio + flechas se reordene sin ratón. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar imagen ${index + 1}`}
        className="absolute bottom-1 left-1 cursor-grab rounded-md bg-card/90 p-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => onRemove(image.id)}
        aria-label={`Quitar imagen ${index + 1}`}
        className="absolute top-1 right-1 bg-card/90"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </li>
  );
}

/**
 * Drag & drop #1 — galería del producto.
 *
 * El orden es el dato: `position` decide cuál es la portada (la primera). El
 * componente es puro: recibe la lista y emite el nuevo orden; quién persiste
 * (al instante en modo edición, al enviar en modo alta) lo decide el hook.
 */
export function SortableImageGallery({
  images,
  onReorder,
  onAdd,
  onRemove,
  error,
  disabled,
}: SortableImageGalleryProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Sin esta distancia, un clic en "quitar" se interpretaría como arrastre.
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.id === active.id);
    const to = images.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(images, from, to));
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = [...fileList];
    setLocalError(null);

    // Mismos límites que el bucket: el error se ve antes de intentar subir.
    const invalidType = files.find(
      (f) => !ALLOWED_IMAGE_TYPES.includes(f.type as (typeof ALLOWED_IMAGE_TYPES)[number]),
    );
    if (invalidType) {
      setLocalError("Solo se admiten imágenes JPG, PNG o WebP.");
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      setLocalError(`Cada imagen debe pesar menos de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    if (images.length + files.length > MAX_IMAGES_PER_PRODUCT) {
      setLocalError(`Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto.`);
      return;
    }
    onAdd(files);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Imágenes{" "}
          <span className="font-normal text-muted-foreground">
            (arrastra para reordenar; la primera es la portada)
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {images.length}/{MAX_IMAGES_PER_PRODUCT}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={images.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((image, index) => (
              <SortableThumb
                key={image.id}
                image={image}
                index={index}
                onRemove={onRemove}
                disabled={disabled}
              />
            ))}

            {images.length < MAX_IMAGES_PER_PRODUCT ? (
              <li>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ImagePlus className="size-5" aria-hidden="true" />
                  <span className="text-xs">Agregar</span>
                </button>
              </li>
            ) : null}
          </ul>
        </SortableContext>
      </DndContext>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files);
          // Permite volver a elegir el mismo archivo tras quitarlo.
          event.target.value = "";
        }}
      />

      {(localError ?? error) ? (
        <p role="alert" className="text-sm text-destructive">
          {localError ?? error}
        </p>
      ) : null}
    </div>
  );
}
