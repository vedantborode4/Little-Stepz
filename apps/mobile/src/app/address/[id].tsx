import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { Header } from "../../components/layout/Header";
import { AddressForm } from "../../components/address/AddressForm";
import { EmptyState } from "../../components/ui/EmptyState";
import { AddressService } from "../../lib/services/address.service";
import { useAddressStore } from "../../store/address.store";
import { toast } from "../../store/toast.store";
import { getErrorMessage } from "../../lib/utils/errors";
import type { AddressData, UpdateAddressData } from "@repo/zod-schema/index";

export default function EditAddress() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addresses, fetchAddresses } = useAddressStore();
  const existing = addresses.find((a) => a.id === id);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (data: AddressData) => {
    setSubmitting(true);
    try {
      await AddressService.update(id, data as UpdateAddressData);
      toast.success("Address updated");
      await fetchAddresses();
      router.back();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not update address"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Edit Address" />
      {existing ? (
        <AddressForm initial={existing} submitting={submitting} onSubmit={onSubmit} />
      ) : (
        <EmptyState title="Address not found" actionLabel="Go back" onAction={() => router.back()} />
      )}
    </ScreenContainer>
  );
}
