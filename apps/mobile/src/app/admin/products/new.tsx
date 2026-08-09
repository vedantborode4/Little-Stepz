import { ScrollView } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { ProductForm } from "../../../features/admin/components/ProductForm";

export default function NewProduct() {
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="products" title="New Product">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <ProductForm
            onSaved={(p) => router.replace(`/admin/products/${p.id}`)}
          />
        </ScrollView>
      </AdminShell>
    </ScreenContainer>
  );
}
