import { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { SignupSchema, type SignupData } from "@repo/zod-schema/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SocialAuth } from "../../components/auth/SocialAuth";
import { useAuth } from "../../hooks/useAuth";
import { AuthService } from "../../lib/services/auth.service";
import { toast } from "../../store/toast.store";
import { getErrorMessage } from "../../lib/utils/errors";
import { VerifyEmailStep } from "../../components/auth/VerifyEmailStep";

// Client-only: add a Confirm Password field with a match check (client 5.6).
// confirmPassword is stripped before the request — the API only sees SignupData.
const SignupFormSchema = SignupSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type SignupFormData = z.infer<typeof SignupFormSchema>;

const PASSWORD_HINT = "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";

interface PendingSignup {
  payload: SignupData;
  expiresInMinutes: number;
  resendAfterSeconds: number;
}

export default function SignUp() {
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingSignup | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(SignupFormSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", referralCode: "" },
  });

  // Prefill referral code captured from a /ref deep link, if any.
  useEffect(() => {
    AsyncStorage.getItem("pending_referral_code").then((code) => {
      if (code) setValue("referralCode", code);
    });
  }, [setValue]);

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true);
    try {
      // Drop the client-only confirm field + empty optionals before sending.
      const { confirmPassword, ...rest } = data;
      const payload = {
        ...rest,
        referralCode: rest.referralCode || undefined,
      } as SignupData;

      // Emails a code; no account exists yet. The payload stays in component state —
      // it holds a plaintext password, so it must never reach AsyncStorage or a route
      // param (expo-router serialises those into navigation state).
      const meta = await AuthService.requestSignupOtp(payload);
      setPending({ payload, ...meta });
    } catch (err: any) {
      const code: string = err?.response?.data?.message || "";
      if (code === "EMAIL_ALREADY_REGISTERED") {
        setError("email", { message: getErrorMessage(err, "Could not create account") });
      } else {
        toast.error(getErrorMessage(err, "Could not create account"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onVerified = async (res: Awaited<ReturnType<typeof AuthService.verifySignupOtp>>) => {
    await login(res);
    // Cleared only now, not at step 1 — otherwise abandoning the OTP would lose the
    // referral attribution for anyone who retried later.
    await AsyncStorage.removeItem("pending_referral_code");
    router.replace("/(tabs)/home");
  };

  // Android hardware back must return to the details step, not leave the screen.
  useEffect(() => {
    if (!pending) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setPending(null);
      return true;
    });
    // RN 0.81 removed BackHandler.removeEventListener — use the subscription.
    return () => sub.remove();
  }, [pending]);

  if (pending) {
    return (
      <VerifyEmailStep
        email={pending.payload.email}
        expiresInMinutes={pending.expiresInMinutes}
        resendAfterSeconds={pending.resendAfterSeconds}
        onResend={() => AuthService.requestSignupOtp(pending.payload)}
        onVerified={onVerified}
        onBack={() => setPending(null)}
      />
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
          <View className="mb-6 items-center">
            <Image
              source={require("../../../assets/images/logo.webp")}
              style={{ width: 160, height: 64 }}
              contentFit="contain"
            />
          </View>
          <Text className="text-3xl font-jakarta-bold text-text">Create account</Text>
          <Text className="mt-1 mb-8 text-base text-muted">Join Little Stepz today</Text>

          <View className="gap-4">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Full name" placeholder="Jane Doe" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} />
              )}
            />
            <View>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input label="Password" placeholder="••••••••" secure value={value} onChangeText={onChange} onBlur={onBlur} error={errors.password?.message} />
                )}
              />
              {!errors.password ? (
                <Text className="mt-1 text-xs text-muted">{PASSWORD_HINT}</Text>
              ) : null}
            </View>
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Confirm password" placeholder="••••••••" secure value={value} onChangeText={onChange} onBlur={onBlur} error={errors.confirmPassword?.message} />
              )}
            />
            <Controller
              control={control}
              name="referralCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Referral code (optional)" placeholder="FRIEND20" autoCapitalize="characters" value={value ?? ""} onChangeText={onChange} onBlur={onBlur} error={errors.referralCode?.message} />
              )}
            />
          </View>

          <View className="mt-7">
            <Button label="Create Account" loading={submitting} onPress={handleSubmit(onSubmit)} />
          </View>

          <SocialAuth redirectTo="/(tabs)/home" />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-muted">Already have an account? </Text>
            <Link href="/(auth)/signin" className="font-jakarta-semibold text-primary">
              Sign in
            </Link>
          </View>

          {/* Escape hatch back to browsing — see the note in signin.tsx. */}
          <View className="mt-6 items-center">
            <Link href="/(tabs)/home" replace className="text-sm font-jakarta-medium text-muted">
              ← Continue shopping
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
