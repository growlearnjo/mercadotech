"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProductForm } from "@/components/seller/ProductForm";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useProductForm } from "@/hooks/useProductForm";

/**
 * Alta de producto.
 *
 * Flujo en dos pasos (decisión 12): el producto se crea primero para obtener
 * su id, y solo entonces se suben las imágenes —cuyo path lo incluye— en el
 * orden en que quedaron tras arrastrarlas.
 */
export default function PublishProductPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { categories } = useCategories();
  const form = useProductForm(profile?.id ?? null);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Publicar producto
      </h1>

      <ProductForm
        values={form.values}
        errors={form.errors}
        categories={categories}
        images={form.images}
        submitting={form.submitting}
        error={form.error}
        submitLabel="Publicar"
        onChange={form.setField}
        onReorderImages={form.reorder}
        onAddImages={form.addFiles}
        onRemoveImage={form.removeImage}
        onSubmit={async () => {
          const id = await form.submit();
          if (!id) return;
          toast.success("Producto publicado");
          router.push(`/vendedor/productos/${id}/editar`);
        }}
      />
    </div>
  );
}
