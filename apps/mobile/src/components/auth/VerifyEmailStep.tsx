import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { ScreenContainer } from "../layout/ScreenContainer";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { AuthService } from "../../lib/services/auth.service";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import type { AuthResponse } from "../../types/auth";

interface Props {
  email: string;
  expiresInMinutes: number;
  resendAfterSeconds: number;
  /** Re-POSTs step 1, which supersedes the outstanding code. */
  onResend: () => Promise<{ resendAfterSeconds: number }>;
  onVerified: (res: AuthResponse) => Promise<void> | void;
  onBack: () => void;
}

/**
 * Step 2 of signup. Rendered inside the signup screen rather than as its own route:
 * the pending payload holds a plaintext password, and expo-router serialises route
 * params into navigation state.
 */
export function VerifyEmailStep({
  email,
  expiresInMinutes,
  resendAfterSeconds,
  onResend,
  onVerified,
  onBack,
}: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(resendAfterSeconds);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const submit = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await AuthService.verifySignupOtp({ email, code });
      await onVerified(res);
    } catch (err: any) {
      // Inline, next to the field — a wrong code is not a toast.
      setError(getErrorMessage(err, "This code is invalid or has expired"));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const meta = await onResend();
      setCooldown(meta.resendAfterSeconds);
      setCode("");
      setError(null);
      toast.success("New code sent");
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Couldn't resend the code"));
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-jakarta-bold text-text">Confirm your email</Text>
          <Text className="mt-1 mb-8 text-base text-muted">
            We sent a 6-digit code to {email}. It expires in {expiresInMinutes} minutes.
          </Text>

          <Input
            label="6-digit code"
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            // "one-time-code" is iOS-only; Android needs "sms-otp".
            autoComplete={Platform.select({ ios: "one-time-code", android: "sms-otp" })}
            textContentType="oneTimeCode"
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, ""));
              setError(null);
            }}
            error={error ?? undefined}
          />

          <View className="mt-7">
            <Button label="Verify email" loading={submitting} onPress={submit} />
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-muted">Didn&apos;t get it? </Text>
            <Pressable onPress={resend} disabled={cooldown > 0 || resending}>
              <Text
                className={
                  cooldown > 0 || resending
                    ? "font-jakarta-semibold text-muted"
                    : "font-jakarta-semibold text-primary"
                }
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={onBack} className="mt-6">
            <Text className="text-center text-muted">← Use a different email</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
