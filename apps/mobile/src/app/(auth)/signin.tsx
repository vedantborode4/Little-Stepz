import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SigninSchema, type SigninData } from "@repo/zod-schema/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SocialAuth } from "../../components/auth/SocialAuth";
import { useAuth } from "../../hooks/useAuth";
import { AuthService } from "../../lib/services/auth.service";
import { toast } from "../../store/toast.store";

export default function SignIn() {
  const { login } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [submitting, setSubmitting] = useState(false);

  // Set when the account exists but was created through Google/Apple, so there is no
  // password to check. Shown as a notice with a route forward rather than a field
  // error — retyping the password can never fix it.
  const [oauthOnly, setOauthOnly] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm<SigninData>({
    resolver: zodResolver(SigninSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: SigninData) => {
    setSubmitting(true);
    setOauthOnly(null);
    try {
      const res = await AuthService.signIn(data);
      await login(res);
      // Return to where the user was sent from (e.g. guest checkout), else home.
      router.replace((redirect as any) || "/(tabs)/home");
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || "Invalid email or password";
      if (err?.response?.data?.code === "PASSWORD_NOT_SET") {
        setOauthOnly(msg);
      } else if (/invalid|incorrect|password|credential/i.test(msg)) {
        setError("password", { message: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          <Text className="text-3xl font-jakarta-bold text-text">Welcome back</Text>
          <Text className="mt-1 mb-8 text-base text-muted">Sign in to continue shopping</Text>

          {oauthOnly ? (
            <View className="mb-4 gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <Text className="text-sm text-text">{oauthOnly}</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/forgot-password",
                    params: { email: getValues("email") ?? "" },
                  })
                }
              >
                <Text className="text-sm font-jakarta-semibold text-primary">Set a password →</Text>
              </Pressable>
            </View>
          ) : null}

          <View className="gap-4">
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
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password"
                  placeholder="••••••••"
                  secure
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />
          </View>

          <View className="mt-3 items-end">
            <Link href="/(auth)/forgot-password" className="text-sm font-jakarta-semibold text-primary">
              Forgot password?
            </Link>
          </View>

          <View className="mt-7">
            <Button label="Sign In" loading={submitting} onPress={handleSubmit(onSubmit)} />
          </View>

          <SocialAuth redirectTo={(redirect as string) || "/(tabs)/home"} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-muted">Don&apos;t have an account? </Text>
            <Link href="/(auth)/signup" className="font-jakarta-semibold text-primary">
              Sign up
            </Link>
          </View>

          {/* Escape hatch — a guest sent here from a gated action (affiliate, wishlist,
              checkout) otherwise has no way back to browsing except the OS back button,
              which does nothing when sign-in is the first screen in the stack. */}
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
