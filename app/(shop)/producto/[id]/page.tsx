"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BuyBox } from "@/components/product/BuyBox";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { QuestionsSection } from "@/components/product/QuestionsSection";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useFavorite } from "@/hooks/useFavorite";
import { useProduct } from "@/hooks/useProduct";
import { useQuestions } from "@/hooks/useQuestions";
import { useReviews } from "@/hooks/useReviews";

function ProductDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;

  const { product, images, loading, error, retry } = useProduct(id, userId);
  const questions = useQuestions(id);
  const reviews = useReviews(id, userId);
  const favorite = useFavorite(id, userId);
  const cart = useCart(userId);
  const [adding, setAdding] = React.useState(false);

  const loginHref = `/login?redirectTo=${encodeURIComponent(`/producto/${id}`)}`;
  const isOwner = Boolean(profile && product && profile.id === product.seller_id);

  if (loading) {
    return <LoadingState variant="card" label="Cargando producto" />;
  }
  if (error || !product) {
    return (
      <ErrorState
        title="No pudimos mostrar este producto"
        description={error ?? "Inténtalo de nuevo."}
        onRetry={retry}
      />
    );
  }

  /**
   * Las acciones del detalle no las bloquea el middleware (la ficha es
   * pública): el botón se ve siempre y, sin sesión, lleva a entrar. Es la
   * regla de navegación de la spec.
   */
  const requireSession = (): boolean => {
    if (userId) return true;
    router.push(loginHref);
    return false;
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-8 md:grid-cols-2">
          <ProductGallery images={images} title={product.title} />
          <ProductInfo
            product={product}
            averageRating={reviews.average}
            reviewCount={reviews.count}
          />
        </div>

        <BuyBox
          price={product.price}
          stock={product.stock}
          isActive={product.is_active}
          isOwner={isOwner}
          isFavorite={favorite.isFavorite}
          favoriteLoading={favorite.loading}
          addingToCart={adding}
          onAddToCart={async (quantity) => {
            if (!requireSession()) return;
            setAdding(true);
            const ok = await cart.add(product.id, quantity);
            setAdding(false);
            if (ok) toast.success("Agregado al carrito");
            else toast.error("No pudimos agregar el producto");
          }}
          onToggleFavorite={async () => {
            if (!requireSession()) return;
            const now = await favorite.toggle();
            toast.success(now ? "Agregado a favoritos" : "Quitado de favoritos");
          }}
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <QuestionsSection
          questions={questions.questions}
          loading={questions.loading}
          error={questions.error}
          isAuthenticated={Boolean(userId)}
          isOwner={isOwner}
          loginHref={loginHref}
          onAsk={async (text) => {
            if (!userId) {
              router.push(loginHref);
              return false;
            }
            return questions.ask(userId, text);
          }}
          onAnswer={questions.answer}
        />

        <ReviewsSection
          reviews={reviews.reviews}
          average={reviews.average}
          count={reviews.count}
          loading={reviews.loading}
          error={reviews.error}
          canReview={reviews.canReview}
          onSubmit={reviews.submit}
        />
      </div>
    </div>
  );
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return <ProductDetail id={id} />;
}
