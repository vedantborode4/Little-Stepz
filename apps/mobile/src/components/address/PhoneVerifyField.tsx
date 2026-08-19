import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Input } from "../ui/Input";
import { PhoneService } from "../../lib/services/phone.service";
import { getErrorMessage } from "../../lib/utils/errors";
import { toast } from "../../store/toast.store";
import { colors } from "../../theme/tokens";

interface Props {
  value: string;
  onChange: (v: string) => void;
  verified: boolean;
  onVerified: () => void;
  error?: string;
  /** False when editing an address whose phone hasn't changed. */
  required?: boolean;
}

const PHONE_RE = /^[6-9]\d{9}$/;

/**
 * Phone input with inline OTP verification.
 *
 * Uses only built-in TextInput props for autofill — no native module, so this stays
 * Expo Go compatible (see apps/mobile/AGENTS.md). Notably NOT react-native-otp-verify,
 * which needs the Android SMS Retriever API plus an 11-char app hash in the message
 * body, which would also break the registered DLT template.
 */
export function PhoneVerifyField({
  value,
  onChange,
  verified,
  onVerified,
  error,
  required = true,
}: Props) {
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    setCodeSent(false);
    setCode("");
    setOtpError(null);
  }, [value]);

  const send = async () => {
    if (!PHONE_RE.test(value)) {
      setOtpError("Enter a valid 10-digit mobile number");
      return;
    }
    setSending(true);
    setOtpError(null);
    try {
      const res = await PhoneService.sendOtp(value);
      if (res.alreadyVerified) {
        onVerified();
        toast.success("This number is already verified");
        return;
      }
      setCodeSent(true);
      setCooldown(res.resendAfterSeconds ?? 60);
      toast.success("Verification code sent");
    } catch (e: any) {
      setOtpError(getErrorMessage(e, "Couldn't send the code"));
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    setOtpError(null);
    try {
      await PhoneService.verifyOtp(value, code);
      setCodeSent(false);
      setCode("");
      onVerified();
      toast.success("Phone number verified");
    } catch (e: any) {
      setOtpError(getErrorMessage(e, "That code isn't right"));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            label="Phone"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            value={value}
            onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, 10))}
            error={otpError ?? error}
          />
        </View>

        {verified ? (
          <View className="mb-3 flex-row items-center gap-1">
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text className="text-sm text-primary font-jakarta-semibold">Verified</Text>
          </View>
        ) : required ? (
          <Pressable
            onPress={send}
            disabled={sending || cooldown > 0}
            className="mb-3 rounded-xl bg-primary px-4 py-3"
          >
            <Text className="text-sm font-jakarta-semibold text-white">
              {sending ? "Sending…" : cooldown > 0 ? `${cooldown}s` : codeSent ? "Resend" : "Verify"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {codeSent && !verified ? (
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
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
                setOtpError(null);
              }}
            />
          </View>
          <Pressable
            onPress={verify}
            disabled={verifying}
            className="mb-3 rounded-xl bg-primary px-4 py-3"
          >
            <Text className="text-sm font-jakarta-semibold text-white">
              {verifying ? "Checking…" : "Confirm"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!verified && required && !codeSent && !otpError ? (
        <Text className="text-xs text-muted">
          We&apos;ll text a code to confirm this is the number our courier can reach.
        </Text>
      ) : null}
    </View>
  );
}
