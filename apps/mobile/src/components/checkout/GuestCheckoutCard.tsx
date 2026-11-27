import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { guestCheckoutStartSchema } from "@repo/zod-schema/index";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { GuestCheckoutService } from "../../lib/services/guest-checkout.service";
import { getErrorMessage } from "../../lib/utils/errors";
import { useGuestSessionStore } from "../../store/guestSession.store";
import { colors } from "../../theme/tokens";

const errorCode = (err: unknown): string | undefined =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

/**
 * Checkout without an account: name, email and phone, confirmed by an SMS code. The code
 * proves the number the courier will call; the guest session it unlocks lasts for this
 * checkout only (it lives in memory and expires).
 */
export function GuestCheckoutCard() {
  const startSession = useGuestSessionStore((s) => s.start);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: "" }));
    setError(null);
    setAccountExists(false);
    if (key !== "name") {
      setCodeSent(false);
      setCode("");
    }
  };

  const sendCode = async () => {
    const parsed = guestCheckoutStartSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path[0];
        if (typeof key === "string" && !next[key]) next[key] = i.message;
      });
      setFieldErrors(next);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const res = await GuestCheckoutService.start(parsed.data);
      setCodeSent(true);
      setCooldown(res.resendAfterSeconds ?? 30);
    } catch (err) {
      if (errorCode(err) === "ACCOUNT_EXISTS") setAccountExists(true);
      else setError(getErrorMessage(err, "We couldn't send the code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code we sent you");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const parsed = guestCheckoutStartSchema.parse(form);
      const res = await GuestCheckoutService.verify({ email: parsed.email, phone: parsed.phone, code });
      startSession(res.accessToken, { name: parsed.name, email: res.user.email, phone: parsed.phone });
    } catch (err) {
      setError(getErrorMessage(err, "That code didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="person-outline" size={18} color={colors.primary} />
        <Text className="text-base font-jakarta-bold text-text">Continue as guest</Text>
      </View>
      <Text className="text-sm text-muted">
        No account needed. We&apos;ll email your order details and a link to track it.
      </Text>

      <Input
        placeholder="Full name"
        value={form.name}
        onChangeText={(v) => update("name", v)}
        autoComplete="name"
        error={fieldErrors.name}
      />
      <Input
        placeholder="Email"
        value={form.email}
        onChangeText={(v) => update("email", v.trim())}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <Input
        placeholder="10-digit mobile number"
        value={form.phone}
        onChangeText={(v) => update("phone", v.replace(/\D/g, "").slice(0, 10))}
        keyboardType="number-pad"
        autoComplete="tel"
        error={fieldErrors.phone}
      />
      {codeSent ? (
        <Input
          placeholder="6-digit code from SMS"
          value={code}
          onChangeText={(v) => {
            setCode(v.replace(/\D/g, "").slice(0, 6));
            setError(null);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
        />
      ) : null}

      {accountExists ? (
        <View className="gap-2 rounded-xl bg-primary/5 p-3">
          <Text className="text-sm text-text">You already have an account with this email. Sign in to continue.</Text>
          <Button
            label="Sign In"
            variant="outline"
            onPress={() => router.push({ pathname: "/(auth)/signin", params: { redirect: "/checkout" } })}
          />
        </View>
      ) : null}
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}

      {codeSent ? (
        <View className="gap-2">
          <Button label="Verify & Continue" loading={busy} disabled={busy} onPress={verify} />
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            variant="outline"
            disabled={busy || cooldown > 0}
            onPress={sendCode}
          />
        </View>
      ) : (
        <Button label="Send Verification Code" loading={busy} disabled={busy} onPress={sendCode} />
      )}
      <Text className="text-xs text-muted">We&apos;ll text a code to confirm the number our courier can reach.</Text>
    </Card>
  );
}
