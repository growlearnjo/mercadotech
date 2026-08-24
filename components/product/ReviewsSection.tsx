"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { RatingStars } from "@/components/shared/RatingStars";
import type { Review } from "@/types/review";

type ReviewsSectionProps = {
  reviews: Review[];
  average: number | null;
  count: number;
  loading?: boolean;
  error?: string | null;
  canReview: { allowed: boolean; reason: "sin_compra" | "ya_resenado" | null };
  onSubmit: (rating: number, comment: string) => Promise<boolean>;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Explica por qué no se puede reseñar, en lugar de esconder la sección sin más. */
const REASON_TEXT: Record<"sin_compra" | "ya_resenado", string> = {
  sin_compra:
    "Solo puedes reseñar productos de un pedido que ya recibiste. Así toda reseña es verificada.",
  ya_resenado: "Ya dejaste tu reseña de este producto.",
};

export function ReviewsSection({
  reviews,
  average,
  count,
  loading,
  error,
  canReview,
  onSubmit,
}: ReviewsSectionProps) {
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [sending, setSending] = React.useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Reseñas</h2>
        {count > 0 && average !== null ? (
          <div className="flex items-center gap-2">
            <RatingStars value={average} size="sm" />
            <span className="text-sm text-muted-foreground">
              {average.toFixed(1)} de 5 · {count}{" "}
              {count === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
        ) : null}
      </div>

      {canReview.allowed ? (
        <form
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSending(true);
            const ok = await onSubmit(rating, comment);
            setSending(false);
            if (ok) setComment("");
          }}
        >
          <p className="text-sm font-medium">Deja tu reseña</p>
          <div className="flex items-center gap-3">
            <RatingStars
              value={rating}
              onChange={setRating}
              size="lg"
              label="Tu calificación"
            />
            <span className="text-sm text-muted-foreground">{rating} de 5</span>
          </div>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Cuenta cómo te fue con el producto (opcional)"
            aria-label="Tu comentario"
            rows={3}
          />
          <div>
            <Button type="submit" size="sm" disabled={sending}>
              {sending ? "Publicando…" : "Publicar reseña"}
            </Button>
          </div>
        </form>
      ) : canReview.reason ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {REASON_TEXT[canReview.reason]}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingState variant="list" count={2} label="Cargando reseñas" />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Todavía no hay reseñas"
          description="Las reseñas solo pueden dejarlas compradores que ya recibieron el producto."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={review.rating} size="sm" />
                {/* Sin nombre real: RLS no deja leer el perfil de otros. */}
                <span className="text-sm font-medium">
                  {review.author_label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(review.created_at)}
                </span>
              </div>
              {review.comment ? (
                <p className="text-sm text-muted-foreground">
                  {review.comment}
                </p>
              ) : null}
              <Separator className="mt-3" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
