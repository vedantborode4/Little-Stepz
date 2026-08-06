import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { resetPasswordSchema } from "@repo/zod-schema/index";
import { z } from "zod";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { AuthService } from "../../lib/services/auth.service";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

const formSchema = resetPasswordSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string().min(1, "Please confirm your password") })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPassword = watch("newPassword");
  const confirmPassword = watch("confirmPassword");
  const matches = !!newPassword && newPassword === confirmPassword;

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await AuthService.resetPassword({ token: token as string, newPassword: data.newPassword });
      toast.success("Password reset. Sign in with your new password.");
      router.replace("/(auth)/signin");
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || "Could not reset your password";
      if (/invalid|expired/i.test(msg)) {
        toast.error(msg);
        router.replace("/(auth)/forgot-password");
        return;
      }
      setError("newPassword", { message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="New password" onBack={() => router.replace("/(auth)/signin")} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-jakarta-bold text-text">Set a new password</Text>
          <Text className="mt-1 mb-8 text-base text-muted">
            At least 8 characters, with an uppercase, a lowercase and a number.
          </Text>

          <View className="gap-4">
            <Controller
              control={control}
              name="newPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="New password"
                  placeholder="••••••••"
                  secure
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.newPassword?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm new password"
                  placeholder="••••••••"
                  secure
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
            {matches && !errors.confirmPassword ? (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text className="text-xs text-success">Passwords match</Text>
              </View>
            ) : null}
          </View>

          <View className="mt-7">
            <Button
              label="Reset password"
              loading={submitting}
              disabled={!token}
              onPress={handleSubmit(onSubmit)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
