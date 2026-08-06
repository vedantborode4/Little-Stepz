import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Rating } from "../ui/Rating";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ReviewService } from "../../lib/services/review.service";
import { qk } from "../../lib/api/query-client";
import { useAuthStore } from "../../store/auth.store";
import { toast } from "../../store/toast.store";
import { formatDate } from "../../lib/utils/format";
import { colors } from "../../theme/tokens";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

export function ReviewSection({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: qk.productReviews(productId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => ReviewService.getByProduct(productId, pageParam),
    getNextPageParam: (last) => {
      const p = last.pagination;
      return p && p.page < p.pages ? p.page + 1 : undefined;
    },
  });

  const reviews = useMemo(() => data?.pages.flatMap((p) => p.reviews) ?? [], [data]);
  const first = data?.pages[0];
  const total = first?.pagination?.total ?? first?.total ?? reviews.length;
  const average = first?.averageRating ?? (reviews.length
    ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
    : 0);

  // Breakdown from loaded reviews (mirrors the web client-side computation).
  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1 star … index 4 = 5 star
    reviews.forEach((r) => {
      const i = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
      counts[i] += 1;
    });
    return counts;
  }, [reviews]);
  const loadedCount = reviews.length;

  const mutation = useMutation({
    mutationFn: () => ReviewService.create({ productId, rating, comment }),
    onSuccess: () => {
      toast.success("Review submitted");
      setComment("");
      setRating(5);
      qc.invalidateQueries({ queryKey: qk.productReviews(productId) });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Could not submit review");
    },
  });

  return (
    <View className="gap-3">
      <Text className="text-xl font-anton uppercase tracking-wide text-text">Customer Reviews</Text>

      {/* Summary */}
      {total > 0 ? (
        <Card className="flex-row gap-4">
          <View className="items-center justify-center px-2">
            <Text className="text-3xl font-jakarta-bold text-text">{average.toFixed(1)}</Text>
            <Rating value={Math.round(average)} size={14} />
            <Text className="mt-1 text-xs text-muted">{total} {total === 1 ? "review" : "reviews"}</Text>
          </View>
          <View className="flex-1 justify-center gap-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = breakdown[star - 1];
              const pct = loadedCount ? (count / loadedCount) * 100 : 0;
              return (
                <View key={star} className="flex-row items-center gap-2">
                  <Text className="w-3 text-[11px] text-muted">{star}</Text>
                  <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <View style={{ width: `${pct}%` }} className="h-full rounded-full bg-primary" />
                  </View>
                  <Text className="w-5 text-right text-[11px] text-muted">{count}</Text>
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {/* Write a review */}
      {isAuthenticated ? (
        <Card className="gap-2">
          <Text className="font-jakarta-medium text-text">Write a review</Text>
          <View className="flex-row items-center gap-3">
            <Rating value={rating} editable size={24} onChange={setRating} />
            <Text className="text-sm text-muted">{RATING_WORDS[rating]}</Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience"
            placeholderTextColor={colors.muted}
            multiline
            className="min-h-16 rounded-lg border border-border bg-surface p-3 text-text"
            textAlignVertical="top"
          />
          <Button
            label="Submit Review"
            loading={mutation.isPending}
            disabled={rating < 1}
            onPress={() => mutation.mutate()}
          />
        </Card>
      ) : (
        <Pressable onPress={() => router.push("/(auth)/signin")}>
          <Card className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Sign in to write a review</Text>
            <Text className="text-sm font-jakarta-semibold text-primary">Sign in</Text>
          </Card>
        </Pressable>
      )}

      {/* List */}
      {isLoading ? (
        <Text className="text-muted">Loading reviews…</Text>
      ) : reviews.length === 0 ? (
        <Text className="text-muted">No reviews yet. Be the first!</Text>
      ) : (
        <>
          {reviews.map((r) => (
            <Card key={r.id} className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-jakarta-medium text-text">
                  {r.user?.name ?? r.author?.name ?? "Customer"}
                </Text>
                <Rating value={r.rating} />
              </View>
              {r.comment ? <Text className="text-sm text-text">{r.comment}</Text> : null}
              <Text className="text-xs text-muted">{formatDate(r.createdAt)}</Text>
            </Card>
          ))}
          {hasNextPage ? (
            <Button
              label="Load More Reviews"
              variant="outline"
              loading={isFetchingNextPage}
              onPress={() => fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </View>
  );
}
