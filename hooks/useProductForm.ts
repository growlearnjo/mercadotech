"use client";

import * as React from "react";

import * as sellerService from "@/services/seller.service";
import * as storageService from "@/services/storage.service";
import { getProductById, getProductImages } from "@/services/product.service";
import { validateProduct, type ProductErrors } from "@/lib/validators/product";
import type { ProductCondition } from "@/lib/constants/roles";
import type { GalleryImage } from "@/components/seller/SortableImageGallery";

export type ProductFormValues = {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  condition: ProductCondition;
  price: string;
  stock: string;
};

const EMPTY: ProductFormValues = {
  title: "",
  description: "",
  brand: "",
  categoryId: "",
  condition: "nuevo",
  price: "",
  stock: "1",
};

/** Imagen aún no subida: vive como File + preview de objeto local. */
type LocalImage = { id: string; file: File; url: string };
/** Imagen ya persistida en Storage + `product_images`. */
type StoredImage = { id: string; product_id: string; image_path: string; url: string };

/**
 * Estado del formulario de producto, en modo alta o edición.
 *
 * La diferencia clave es CUÁNDO se persisten las imágenes (decisión 12): el
 * path de Storage incluye el `product_id`, así que en alta no se puede subir
 * nada hasta que el producto exista. Por eso:
 *   - alta: el reorden es local y todo se sube tras crear el producto;
 *   - edición: cada cambio se persiste al momento.
 */
export function useProductForm(
  sellerId: string | null,
  /** `undefined` = alta; un id = edición. */
  productId?: string,
) {
  const [values, setValues] = React.useState<ProductFormValues>(EMPTY);
  const [errors, setErrors] = React.useState<ProductErrors>({});
  const [local, setLocal] = React.useState<LocalImage[]>([]);
  const [stored, setStored] = React.useState<StoredImage[]>([]);
  const [loading, setLoading] = React.useState(Boolean(productId));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEdit = Boolean(productId);

  // Carga inicial en modo edición.
  React.useEffect(() => {
    if (!productId) return;
    let active = true;
    setLoading(true);
    Promise.all([getProductById(productId), getProductImages(productId)])
      .then(([product, images]) => {
        if (!active || !product) return;
        setValues({
          title: product.title,
          description: product.description ?? "",
          brand: product.brand ?? "",
          categoryId: product.category_id,
          condition: product.condition,
          price: String(product.price),
          stock: String(product.stock),
        });
        setStored(
          images.map((image) => ({
            id: image.id,
            product_id: image.product_id,
            image_path: image.image_path,
            url: image.image_url,
          })),
        );
      })
      .catch(() => {
        if (active) setError("No pudimos cargar el producto.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  // Las URL de objeto local ocupan memoria hasta que se revocan.
  React.useEffect(() => {
    return () => {
      for (const image of local) URL.revokeObjectURL(image.url);
    };
  }, [local]);

  /** Galería unificada que ve el componente: primero las guardadas. */
  const images: GalleryImage[] = [
    ...stored.map((s) => ({ id: s.id, url: s.url, isLocal: false })),
    ...local.map((l) => ({ id: l.id, url: l.url, isLocal: true })),
  ];

  const setField = React.useCallback(
    <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addFiles = React.useCallback(
    async (files: File[]) => {
      if (!isEdit || !sellerId || !productId) {
        // Alta: se guardan en memoria hasta que exista el producto.
        setLocal((prev) => [
          ...prev,
          ...files.map((file) => ({
            id: `local-${file.name}-${file.size}-${prev.length}`,
            file,
            url: URL.createObjectURL(file),
          })),
        ]);
        return;
      }
      // Edición: se suben al instante, con n = siguiente índice libre.
      try {
        let next = stored.length;
        const created: StoredImage[] = [];
        for (const file of files) {
          const path = await storageService.uploadProductImage(
            file,
            sellerId,
            productId,
            next,
          );
          const row = await storageService.insertProductImage(
            productId,
            path,
            next,
          );
          created.push({
            id: row.id,
            product_id: row.product_id,
            image_path: row.image_path,
            url: storageService.getPublicUrl(
              storageService.PRODUCT_IMAGES_BUCKET,
              row.image_path,
            ),
          });
          next++;
        }
        setStored((prev) => [...prev, ...created]);
      } catch {
        setError("No pudimos subir la imagen.");
      }
    },
    [isEdit, sellerId, productId, stored.length],
  );

  const removeImage = React.useCallback(
    async (id: string) => {
      const localMatch = local.find((l) => l.id === id);
      if (localMatch) {
        URL.revokeObjectURL(localMatch.url);
        setLocal((prev) => prev.filter((l) => l.id !== id));
        return;
      }
      const storedMatch = stored.find((s) => s.id === id);
      if (!storedMatch) return;
      try {
        await storageService.deleteProductImage(
          storedMatch.id,
          storedMatch.image_path,
        );
        setStored((prev) => prev.filter((s) => s.id !== id));
      } catch {
        setError("No pudimos quitar la imagen.");
      }
    },
    [local, stored],
  );

  const reorder = React.useCallback(
    async (next: GalleryImage[]) => {
      // Se reconstruyen las dos listas respetando el nuevo orden global.
      const nextStored: StoredImage[] = [];
      const nextLocal: LocalImage[] = [];
      for (const image of next) {
        const s = stored.find((x) => x.id === image.id);
        if (s) {
          nextStored.push(s);
          continue;
        }
        const l = local.find((x) => x.id === image.id);
        if (l) nextLocal.push(l);
      }
      setStored(nextStored);
      setLocal(nextLocal);

      // En edición el orden se persiste de inmediato; en alta espera al submit.
      if (isEdit && nextStored.length > 0) {
        try {
          await storageService.saveImageOrder(
            nextStored.map((s, index) => ({
              id: s.id,
              product_id: s.product_id,
              image_path: s.image_path,
              position: index,
            })),
          );
        } catch {
          setError("No pudimos guardar el orden de las imágenes.");
        }
      }
    },
    [isEdit, stored, local],
  );

  /** Devuelve el id del producto si todo fue bien, o null. */
  const submit = React.useCallback(async (): Promise<string | null> => {
    if (!sellerId) return null;
    setError(null);

    const price = Number(values.price);
    const stock = Number(values.stock);
    const check = validateProduct({
      title: values.title,
      description: values.description,
      brand: values.brand,
      categoryId: values.categoryId,
      condition: values.condition,
      price,
      stock,
      imageCount: images.length,
    });
    setErrors(check.errors);
    if (!check.ok) return null;

    setSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim() || null,
        brand: values.brand.trim() || null,
        category_id: values.categoryId,
        condition: values.condition,
        price,
        stock,
      };

      if (isEdit && productId) {
        await sellerService.updateProduct(productId, payload);
        return productId;
      }

      // Alta en dos pasos: primero el producto (para tener id), luego las
      // imágenes en el orden en que quedaron tras arrastrarlas.
      const newId = await sellerService.createProduct(sellerId, payload);
      for (const [index, image] of local.entries()) {
        const path = await storageService.uploadProductImage(
          image.file,
          sellerId,
          newId,
          index,
        );
        await storageService.insertProductImage(newId, path, index);
      }
      return newId;
    } catch {
      setError("No pudimos guardar el producto.");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [sellerId, values, images.length, isEdit, productId, local]);

  return {
    values,
    errors,
    images,
    loading,
    submitting,
    error,
    setField,
    addFiles,
    removeImage,
    reorder,
    submit,
  };
}
