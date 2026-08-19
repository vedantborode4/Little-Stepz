import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createAddressSchema, type AddressData } from "@repo/zod-schema/index";

import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { colors } from "../../theme/tokens";
import type { Address } from "../../lib/services/address.service";
import { PhoneVerifyField } from "./PhoneVerifyField";

interface AddressFormProps {
  initial?: Partial<Address>;
  submitting?: boolean;
  onSubmit: (data: AddressData) => void;
}

export function AddressForm({ initial, submitting, onSubmit }: AddressFormProps) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressData>({
    // createAddressSchema uses .default()/.transform(), so its zod input/output
    // types differ; cast the resolver to bridge RHF's input/output generics.
    resolver: zodResolver(createAddressSchema) as any,
    defaultValues: {
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      address: initial?.address ?? "",
      city: initial?.city ?? "",
      state: initial?.state ?? "",
      pincode: initial?.pincode ?? "",
      country: initial?.country ?? "India",
      isDefault: initial?.isDefault ?? false,
    },
  });

  const isDefault = watch("isDefault");
  const phone = watch("phone");
  const [phoneVerified, setPhoneVerified] = useState(false);

  // `initial` is undefined when adding, so a new address always needs verification.
  const phoneChanged = phone !== initial?.phone;

  const field = (
    name: keyof AddressData,
    label: string,
    extra?: object
  ) => (
    <Controller
      control={control}
      name={name as any}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={label}
          value={value != null ? String(value) : ""}
          onChangeText={onChange}
          onBlur={onBlur}
          error={(errors as any)[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {field("name", "Full name", { placeholder: "Recipient's full name" })}

      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, value } }) => (
          <PhoneVerifyField
            value={value ?? ""}
            onChange={(v) => {
              onChange(v);
              setPhoneVerified(false);
            }}
            // An unchanged number on an existing address is already trusted — only a
            // new or changed one has to be proven, mirroring the server rule.
            verified={!phoneChanged || phoneVerified}
            required={phoneChanged}
            onVerified={() => setPhoneVerified(true)}
            error={errors.phone?.message}
          />
        )}
      />
      {field("address", "Address", { multiline: true, placeholder: "House no., Street, Area" })}
      {field("city", "City", { placeholder: "City" })}
      {field("state", "State", { placeholder: "State" })}
      {field("pincode", "Pincode", { keyboardType: "numeric", placeholder: "6-digit pincode" })}
      {field("country", "Country", { placeholder: "Country" })}

      <Pressable className="flex-row items-center gap-2" onPress={() => setValue("isDefault", !isDefault)}>
        <Ionicons name={isDefault ? "checkbox" : "square-outline"} size={22} color={isDefault ? colors.primary : colors.muted} />
        <Text className="text-text">Set as default address</Text>
      </Pressable>

      <Button
        label="Save Address"
        loading={submitting}
        // Blocked in the UI as well as on the server, so the user gets inline
        // guidance instead of a 400 after filling the whole form.
        disabled={phoneChanged && !phoneVerified}
        onPress={handleSubmit(onSubmit)}
      />
    </ScrollView>
  );
}
