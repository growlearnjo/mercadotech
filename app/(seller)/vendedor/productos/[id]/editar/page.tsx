"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProductForm } from "@/components/seller/ProductForm";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useProductForm } from "@/hooks/useProductForm";

/**
 * Edición de producto.
 *
 * A diferencia del alta, aquí el producto ya existe: cada cambio en la
 * galería (añadir, quitar, reordenar) se persiste al momento.
 */
function EditProductForm({ id }: { id: string }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { categories } = useCategories();
  const form = useProductForm(profile?.id ?? null, id);

  if (form.loading) {
    return <LoadingState variant="card" label="Cargando producto" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Editar producto</h1>

      <ProductForm
        values={form.values}
        errors={form.errors}
        categories={categories}
        images={form.images}
        submitting={form.submitting}
        error={form.error}
        submitLabel="Guardar cambios"
        onChange={form.setField}
        onReorderImages={form.reorder}
        onAddImages={form.addFiles}
        onRemoveImage={form.removeImage}
        onSubmit={async () => {
          const ok = await form.submit();
          if (!ok) return;
          toast.success("Cambios guardados");
          router.push("/vendedor/productos");
        }}
      />
    </div>
  );
}

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return <EditProductForm id={id} />;
}
