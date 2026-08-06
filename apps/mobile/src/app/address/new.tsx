import { useState } from "react";
import { router } from "expo-router";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { AddressForm } from "../../components/address/AddressForm";
import { AddressService } from "../../lib/services/address.service";
import { useAddressStore } from "../../store/address.store";
import { toast } from "../../store/toast.store";
import { getErrorMessage } from "../../lib/utils/errors";
import type { AddressData } from "@repo/zod-schema/index";

export default function NewAddress() {
  const [submitting, setSubmitting] = useState(false);
  const fetchAddresses = useAddressStore((s) => s.fetchAddresses);

  const onSubmit = async (data: AddressData) => {
    setSubmitting(true);
    try {
      await AddressService.create(data);
      toast.success("Address added");
      await fetchAddresses();
      router.back();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not add address"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Add Address" />
      <AddressForm submitting={submitting} onSubmit={onSubmit} />
    </ScreenContainer>
  );
}
