import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import {
  RETURN_MAX_IMAGES,
  RETURN_MAX_VIDEOS,
  SELLER_FAULT_REASON_CODES,
  upiIdSchema,
  type ReturnMedia,
  type ReturnReasonCode,
} from "@repo/zod-schema/index";

import { Sheet } from "../ui/Sheet";
import { Button } from "../ui/Button";
import { QuantityStepper } from "../ui/QuantityStepper";
import {
  ReturnService,
  uploadReturnMedia,
  RETURN_REASONS,
  type OrderReturns,
  type ReturnQuote,
  type UploadSignature,
} from "../../lib/services/return.service";
import { formatPrice, formatDate } from "../../lib/utils/format";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

type Step = "items" | "details" | "review" | "done";

const BLOCK_COPY: Record<string, string> = {
  NOT_RETURNABLE: "Not returnable",
  ALREADY_RETURNED: "Already in a return",
};

export function ReturnItemsSheet({
  visible,
  orderId,
  data,
  onClose,
  onDone,
}: {
  visible: boolean;
  orderId: string;
  data: OrderReturns;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>("items");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReturnReasonCode | null>(null);
  const [description, setDescription] = useState("");
  const [upi, setUpi] = useState("");
  const [media, setMedia] = useState<ReturnMedia[]>([]);
  const [uploading, setUploading] = useState(0);
  const [quote, setQuote] = useState<ReturnQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const signature = useRef<UploadSignature | null>(null);
  // One key per opening of the sheet: a retried submit returns the same return.
  const idempotencyKey = useRef(Crypto.randomUUID());

  const reset = () => {
    setStep("items"); setQty({}); setReasonCode(null); setDescription(""); setUpi("");
    setMedia([]); setQuote(null); idempotencyKey.current = Crypto.randomUUID();
  };
  const close = () => { if (busy || uploading) return; reset(); onClose(); };
  const finish = () => { reset(); onDone(); };

  const selection = useMemo(
    () => Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
    [qty]
  );
  const reasons = data.isPreOrder ? RETURN_REASONS.filter((r) => SELLER_FAULT_REASON_CODES.includes(r.code)) : RETURN_REASONS;
  const images = media.filter((m) => m.type === "image").length;
  const videos = media.filter((m) => m.type === "video").length;
  const upiValid = !data.needsUpi || upiIdSchema.safeParse(upi).success;
  const detailsValid =
    reasonCode !== null &&
    (reasonCode !== "OTHER" || description.trim().length >= 10) &&
    images >= 1 &&
    uploading === 0 &&
    upiValid;

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.error("Allow photo access to attach evidence"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: RETURN_MAX_IMAGES + RETURN_MAX_VIDEOS - media.length,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.length) return;

    try {
      signature.current ??= await ReturnService.uploadSignature(orderId);
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't start the upload"));
      return;
    }
    const sig = signature.current;
    let imgCount = images;
    let vidCount = videos;

    for (const asset of result.assets) {
      const isVideo = asset.type === "video";
      if (isVideo) {
        if (vidCount >= RETURN_MAX_VIDEOS) { toast.error("Only one video can be attached"); continue; }
        if ((asset.fileSize ?? 0) > sig.limits.maxVideoBytes) { toast.error("Videos must be under 50 MB"); continue; }
        // expo-image-picker reports duration in milliseconds.
        if ((asset.duration ?? 0) / 1000 > sig.limits.maxVideoSeconds) { toast.error("Videos must be 60 seconds or shorter"); continue; }
        vidCount++;
      } else {
        if (imgCount >= RETURN_MAX_IMAGES) { toast.error(`Up to ${RETURN_MAX_IMAGES} photos`); continue; }
        if ((asset.fileSize ?? 0) > sig.limits.maxImageBytes) { toast.error("Photos must be under 10 MB"); continue; }
        imgCount++;
      }
      setUploading((n) => n + 1);
      uploadReturnMedia(asset, sig)
        .then((m) => setMedia((list) => [...list, m]))
        .catch(() => toast.error("A file couldn't be uploaded"))
        .finally(() => setUploading((n) => n - 1));
    }
  };

  const toReview = async () => {
    setBusy(true);
    try {
      setQuote(await ReturnService.quote(orderId, selection));
      setStep("review");
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't estimate your refund"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!reasonCode) return;
    setBusy(true);
    try {
      await ReturnService.create(orderId, {
        items: selection,
        reasonCode,
        description: description.trim() || undefined,
        media,
        refundUpiId: data.needsUpi ? upi.trim() : undefined,
        idempotencyKey: idempotencyKey.current,
      });
      setStep("done");
    } catch (e) {
      toast.error(getErrorMessage(e, "Couldn't submit your return"));
    } finally {
      setBusy(false);
    }
  };

  const itemName = (id: string) => data.items.find((i) => i.orderItemId === id)?.productName ?? "Item";
  const title =
    step === "items" ? "Select items to return"
      : step === "details" ? "Tell us what happened"
        : step === "review" ? "Review your return"
          : "Return requested";

  return (
    <Sheet visible={visible} onClose={step === "done" ? finish : close} title={title}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
          {step !== "items" && step !== "done" ? (
            <Pressable onPress={() => setStep(step === "review" ? "details" : "items")} className="flex-row items-center gap-1" hitSlop={6}>
              <Ionicons name="chevron-back" size={16} color={colors.muted} />
              <Text className="text-sm text-muted">Back</Text>
            </Pressable>
          ) : null}

          {step === "items" ? (
            <>
              {data.windowEndsAt ? (
                <Text className="text-xs text-muted">Return window closes {formatDate(data.windowEndsAt)}.</Text>
              ) : null}
              {data.items.map((item) => {
                const q = qty[item.orderItemId] ?? 0;
                const blocked = !item.returnable || item.remainingQuantity === 0;
                return (
                  <View
                    key={item.orderItemId}
                    className={`flex-row items-center gap-3 rounded-lg border p-3 ${q > 0 ? "border-primary bg-primary/5" : "border-border"}`}
                    style={blocked ? { opacity: 0.6 } : undefined}
                  >
                    <View className="h-12 w-12 overflow-hidden rounded-md bg-border">
                      {item.image ? <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text numberOfLines={2} className="text-sm font-jakarta-medium text-text">{item.productName}</Text>
                      {item.variantName ? <Text className="text-xs text-muted">{item.variantName}</Text> : null}
                      <Text className="text-xs text-muted">
                        {blocked ? BLOCK_COPY[item.blockedReason ?? ""] ?? "Not available" : `${item.remainingQuantity} of ${item.quantity} can be returned`}
                      </Text>
                    </View>
                    {!blocked ? (
                      <QuantityStepper
                        value={q}
                        min={0}
                        max={item.remainingQuantity}
                        onChange={(v) => setQty((s) => ({ ...s, [item.orderItemId]: v }))}
                      />
                    ) : null}
                  </View>
                );
              })}
              <Button label="Continue" disabled={selection.length === 0} onPress={() => setStep("details")} />
            </>
          ) : null}

          {step === "details" ? (
            <>
              <Text className="font-jakarta-semibold text-text">Reason</Text>
              {reasons.map((r) => {
                const on = reasonCode === r.code;
                return (
                  <Pressable key={r.code} onPress={() => setReasonCode(r.code)} className="flex-row items-center justify-between py-1.5">
                    <Text className={on ? "font-jakarta-semibold text-primary" : "text-text"}>{r.label}</Text>
                    <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.primary : colors.muted} />
                  </Pressable>
                );
              })}
              {data.isPreOrder ? (
                <Text className="text-xs text-muted">Pre-order items can be returned only if they arrive damaged, defective or incorrect.</Text>
              ) : null}

              <Text className="font-jakarta-semibold text-text">
                Details{reasonCode === "OTHER" ? " *" : " (optional)"}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the issue"
                placeholderTextColor={colors.muted}
                maxLength={2000}
                multiline
                textAlignVertical="top"
                className="min-h-20 rounded-lg border border-border bg-surface p-3 text-text"
              />
              {reasonCode === "OTHER" && description.trim().length < 10 ? (
                <Text className="text-xs text-warning">At least 10 characters ({description.trim().length}/10)</Text>
              ) : null}

              <Text className="font-jakarta-semibold text-text">Photos & video *</Text>
              <Text className="text-xs text-muted">
                At least one clear photo of the item (up to {RETURN_MAX_IMAGES}). An unboxing video up to 60 seconds helps us process damage claims faster.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {media.map((m) => (
                  <View key={m.publicId} className="h-16 w-16 overflow-hidden rounded-md border border-border bg-border">
                    {m.type === "image" ? (
                      <Image source={{ uri: m.url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center"><Ionicons name="videocam-outline" size={20} color={colors.muted} /></View>
                    )}
                    <Pressable
                      onPress={() => setMedia((list) => list.filter((x) => x.publicId !== m.publicId))}
                      hitSlop={6}
                      className="absolute right-0.5 top-0.5 h-5 w-5 items-center justify-center rounded-full bg-black/60"
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {Array.from({ length: uploading }).map((_, i) => (
                  <View key={`up-${i}`} className="h-16 w-16 items-center justify-center rounded-md border border-border">
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ))}
                {media.length + uploading < RETURN_MAX_IMAGES + RETURN_MAX_VIDEOS ? (
                  <Pressable onPress={pickMedia} className="h-16 w-16 items-center justify-center rounded-md border border-dashed border-border">
                    <Ionicons name="camera-outline" size={20} color={colors.muted} />
                    <Text className="text-[10px] text-muted">Add</Text>
                  </Pressable>
                ) : null}
              </View>

              {data.needsUpi ? (
                <>
                  <Text className="font-jakarta-semibold text-text">UPI ID for your refund *</Text>
                  <Text className="text-xs text-muted">{"Part of this order was paid in cash, so we'll send that refund to your UPI ID."}</Text>
                  <TextInput
                    value={upi}
                    onChangeText={setUpi}
                    placeholder="name@bank"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="rounded-lg border border-border bg-surface p-3 text-text"
                  />
                  {upi && !upiValid ? <Text className="text-xs text-warning">Enter a valid UPI ID (e.g. name@bank)</Text> : null}
                </>
              ) : null}

              <Button label="Review return" loading={busy} disabled={!detailsValid} onPress={toReview} />
            </>
          ) : null}

          {step === "review" && quote ? (
            <>
              <View className="rounded-lg border border-border">
                {quote.items.map((i) => (
                  <View key={i.orderItemId} className="flex-row justify-between border-b border-border px-3 py-2.5">
                    <Text numberOfLines={1} className="flex-1 pr-3 text-sm text-muted">{itemName(i.orderItemId)} × {i.quantity}</Text>
                    <Text className="text-sm font-jakarta-medium text-text">{formatPrice(i.amount)}</Text>
                  </View>
                ))}
                <View className="flex-row justify-between px-3 py-2.5">
                  <Text className="font-jakarta-semibold text-text">Estimated refund</Text>
                  <Text className="font-jakarta-bold text-text">{formatPrice(quote.estimatedRefund)}</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2 rounded-lg bg-warning/10 px-3 py-2">
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text className="flex-1 text-xs text-warning">
                  {"The refund is each item's share of what you paid after discounts, confirmed once the items reach us and pass inspection."}
                  {quote.shippingNote ? ` ${quote.shippingNote}` : ""}
                </Text>
              </View>
              <Button label="Submit return" loading={busy} onPress={submit} />
            </>
          ) : null}

          {step === "done" ? (
            <>
              <View className="flex-row items-start gap-2">
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <Text className="flex-1 text-sm text-muted">
                  {"We've received your request and will review it within 2–3 business days. Keep the items in their original packaging until they're collected."}
                </Text>
              </View>
              <Button label="Done" onPress={finish} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}
