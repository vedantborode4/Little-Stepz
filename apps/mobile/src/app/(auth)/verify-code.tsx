import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifyResetCodeSchema, type VerifyResetCodeData } from "@repo/zod-schema/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { AuthService } from "../../lib/services/auth.service";
import { toast } from "../../store/toast.store";

export default function VerifyResetCode() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VerifyResetCodeData>({
    resolver: zodResolver(verifyResetCodeSchema),
    mode: "onChange",
    defaultValues: { email: (email as string) ?? "", code: "" },
  });

  const onSubmit = async (data: VerifyResetCodeData) => {
    setSubmitting(true);
    try {
      const { token } = await AuthService.verifyResetCode(data);
      router.replace({ pathname: "/(auth)/reset-password", params: { token } });
    } catch (err: any) {
      setError("code", {
        message: err?.response?.data?.message || "That code is invalid or has expired",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await AuthService.forgotPassword({ email: email as string });
      toast.success("New code sent");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not resend the code");
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Enter code" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-jakarta-bold text-text">Check your email</Text>
          <Text className="mt-1 mb-8 text-base text-muted">
            If an account exists for {email ?? "that address"}, we&apos;ve sent a 6-digit code.
            It expires in 15 minutes.
          </Text>

          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="6-digit code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, ""))}
                onBlur={onBlur}
                error={errors.code?.message}
              />
            )}
          />

          <View className="mt-7">
            <Button label="Continue" loading={submitting} onPress={handleSubmit(onSubmit)} />
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-muted">Didn&apos;t get it? </Text>
            <Pressable onPress={resend} disabled={resending}>
              <Text className="font-jakarta-semibold text-primary">
                {resending ? "Sending..." : "Resend code"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
