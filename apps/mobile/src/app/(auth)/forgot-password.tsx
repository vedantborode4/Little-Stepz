import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordData } from "@repo/zod-schema/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { AuthService } from "../../lib/services/auth.service";
import { toast } from "../../store/toast.store";

export default function ForgotPassword() {
  const [submitting, setSubmitting] = useState(false);

  // Sign-in sends OAuth-only accounts here to set their first password; carrying the
  // address over saves retyping it.
  const { email: presetEmail } = useLocalSearchParams<{ email?: string }>();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: { email: presetEmail ?? "" },
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    setSubmitting(true);
    try {
      await AuthService.forgotPassword(data);
      router.push({ pathname: "/(auth)/verify-code", params: { email: data.email } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not send the reset email");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Forgot password" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-jakarta-bold text-text">Forgot password?</Text>
          <Text className="mt-1 mb-8 text-base text-muted">
            Enter your email and we&apos;ll send you a 6-digit code to reset it.
          </Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />

          <View className="mt-7">
            <Button label="Send code" loading={submitting} onPress={handleSubmit(onSubmit)} />
          </View>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-muted">Remembered it? </Text>
            <Link href="/(auth)/signin" className="font-jakarta-semibold text-primary">
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
