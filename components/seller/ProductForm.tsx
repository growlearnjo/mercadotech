"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SortableImageGallery,
  type GalleryImage,
} from "@/components/seller/SortableImageGallery";
import { PRODUCT_CONDITIONS } from "@/lib/constants/roles";
import { TITLE_MAX } from "@/lib/constants/product";
import type { ProductCondition } from "@/lib/constants/roles";
import type { ProductErrors } from "@/lib/validators/product";
import type { Category } from "@/types/product";

export type ProductFormValues = {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  condition: ProductCondition;
  price: string;
  stock: string;
};

type ProductFormProps = {
  values: ProductFormValues;
  errors: ProductErrors;
  categories: Category[];
  images: GalleryImage[];
  submitting?: boolean;
  error?: string | null;
  submitLabel: string;
  onChange: <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) => void;
  onReorderImages: (images: GalleryImage[]) => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onSubmit: () => void;
};

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

/** Campo con etiqueta y error asociado por `aria-describedby`. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProductForm({
  values,
  errors,
  categories,
  images,
  submitting,
  error,
  submitLabel,
  onChange,
  onReorderImages,
  onAddImages,
  onRemoveImage,
  onSubmit,
}: ProductFormProps) {
  const selectClass =
    "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

  return (
    <form
      className="flex max-w-2xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <Field id="title" label="Título" error={errors.title}>
        <Input
          id="title"
          value={values.title}
          maxLength={TITLE_MAX}
          onChange={(e) => onChange("title", e.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
        />
      </Field>

      <Field id="description" label="Descripción">
        <Textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="brand" label="Marca">
          <Input
            id="brand"
            value={values.brand}
            onChange={(e) => onChange("brand", e.target.value)}
          />
        </Field>

        <Field id="categoryId" label="Categoría" error={errors.categoryId}>
          <select
            id="categoryId"
            value={values.categoryId}
            onChange={(e) => onChange("categoryId", e.target.value)}
            aria-invalid={Boolean(errors.categoryId)}
            className={selectClass}
          >
            <option value="">Elige una…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="condition" label="Condición" error={errors.condition}>
          <select
            id="condition"
            value={values.condition}
            onChange={(e) =>
              onChange("condition", e.target.value as ProductCondition)
            }
            className={selectClass}
          >
            {PRODUCT_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {CONDITION_LABELS[condition]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="price" label="Precio (S/)" error={errors.price}>
          <Input
            id="price"
            inputMode="decimal"
            value={values.price}
            onChange={(e) => onChange("price", e.target.value)}
            aria-invalid={Boolean(errors.price)}
            aria-describedby={errors.price ? "price-error" : undefined}
          />
        </Field>

        <Field id="stock" label="Stock" error={errors.stock}>
          <Input
            id="stock"
            inputMode="numeric"
            value={values.stock}
            onChange={(e) => onChange("stock", e.target.value)}
            aria-invalid={Boolean(errors.stock)}
            aria-describedby={errors.stock ? "stock-error" : undefined}
          />
        </Field>
      </div>

      <SortableImageGallery
        images={images}
        onReorder={onReorderImages}
        onAdd={onAddImages}
        onRemove={onRemoveImage}
        error={errors.imageCount}
        disabled={submitting}
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
