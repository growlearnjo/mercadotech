"use client";

import * as React from "react";

import * as reviewService from "@/services/review.service";
import type { CanReviewResult } from "@/services/review.service";
import type { Review } from "@/types/review";

export function useReviews(productId: string, userId: string | null) {
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [average, setAverage] = React.useState<number | null>(null);
  const [count, setCount] = React.useState(0);
  const [canReview, setCanReview] = React.useState<CanReviewResult>({
    allowed: false,
    orderId: null,
    reason: null,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      reviewService.listByProduct(productId),
      reviewService.getAverage(productId),
      // Sin sesión no tiene sentido preguntar si puede reseñar.
      userId
        ? reviewService.canReview(productId, userId)
        : Promise.resolve<CanReviewResult>({
            allowed: false,
            orderId: null,
            reason: null,
          }),
    ])
      .then(([list, avg, can]) => {
        if (!active) return;
        setReviews(list);
        setAverage(avg.average);
        setCount(avg.count);
        setCanReview(can);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar las reseñas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, userId, reloadToken]);

  const submit = React.useCallback(
    async (rating: number, comment: string) => {
      if (!userId || !canReview.orderId) return false;
      setError(null);
      try {
        const created = await reviewService.create({
          productId,
          orderId: canReview.orderId,
          buyerId: userId,
          rating,
          comment: comment.trim() || null,
        });
        setReviews((prev) => [created, ...prev]);
        setCount((prev) => prev + 1);
        setAverage((prev) =>
          prev === null ? rating : (prev * count + rating) / (count + 1),
        );
        // Ya no puede volver a reseñar: hay unique por comprador/producto.
        setCanReview({ allowed: false, orderId: null, reason: "ya_resenado" });
        return true;
      } catch {
        setError("No pudimos publicar tu reseña.");
        return false;
      }
    },
    [productId, userId, canReview.orderId, count],
  );

  return {
    reviews,
    average,
    count,
    canReview,
    loading,
    error,
    submit,
    retry: () => setReloadToken((t) => t + 1),
  };
}
