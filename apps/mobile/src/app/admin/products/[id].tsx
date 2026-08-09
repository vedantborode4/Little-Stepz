import { Alert, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenContainer } from "../../../components/layout/ScreenContainer";
import { AdminShell } from "../../../features/admin/components/AdminShell";
import { ProductForm } from "../../../features/admin/components/ProductForm";
import { VariantManager } from "../../../features/admin/components/VariantManager";
import { VariantMatrixGenerator } from "../../../features/admin/components/VariantMatrixGenerator";
import { ProductImageManager } from "../../../features/admin/components/ProductImageManager";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { AdminProductService } from "../../../features/admin/services/admin.services";
import { qk } from "../../../lib/api/query-client";
import { toast } from "../../../store/toast.store";

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: product, isLoading, isError, refetch } = useQuery({
    queryKey: qk.adminProduct(id),
    queryFn: () => AdminProductService.getProductById(id),
    enabled: !!id,
  });

  const reload = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin", "products-list"] });
  };

  const onDelete = () => {
    Alert.alert("Delete product", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await AdminProductService.deleteProduct(id);
            toast.success("Product deleted");
            qc.invalidateQueries({ queryKey: ["admin", "products-list"] });
            router.back();
          } catch {
            toast.error("Could not delete product");
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AdminShell active="products" title="Edit Product">
        {isLoading ? null : isError || !product ? (
          <EmptyState icon="cube-outline" title="Product not found" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 60 }}>
            <ProductForm product={product} onSaved={() => reload()} />
            <View className="h-px bg-border" />
            <VariantMatrixGenerator productId={product.id} options={product.options ?? []} onGenerated={reload} />
            <View className="h-px bg-border" />
            <VariantManager productId={product.id} variants={product.variants ?? []} onChange={reload} />
            <View className="h-px bg-border" />
            <ProductImageManager productId={product.id} images={product.images ?? []} onChange={reload} />
            <View className="h-px bg-border" />
            <Button label="Delete Product" variant="danger" onPress={onDelete} />
          </ScrollView>
        )}
      </AdminShell>
    </ScreenContainer>
  );
}
