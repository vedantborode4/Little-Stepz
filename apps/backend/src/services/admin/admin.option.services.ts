import { prisma } from "@repo/db/client";
import { ApiError } from "../../utils/api";
import { syncProductInStock } from "../../utils/inventory";

type MatrixInput = {
  options: { name: string; values: { value: string; swatchHex?: string | null }[] }[];
  defaults?: { price?: number; salePrice?: number; isOnSale?: boolean; stock?: number };
};

/**
 * Defines a product's option axes (Size, Color …) and auto-generates the variant
 * matrix — one variant per combination of option values. Idempotent: re-running
 * upserts the options/values and skips combinations that already map to an active
 * variant, so admins can add a value and regenerate without duplicating.
 */
export async function generateVariantMatrixService(productId: string, data: MatrixInput) {
  const { options, defaults } = data;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new ApiError(404, "Product not found");

    // Upsert every option + value, remembering each axis's ordered value ids.
    const axes: string[][] = [];
    const labelOf: Record<string, string> = {};

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const name = opt.name.trim();

      let option = await tx.productOption.findFirst({
        where: { productId, name, deletedAt: null },
        select: { id: true },
      });
      option = option
        ? (await tx.productOption.update({ where: { id: option.id }, data: { sortOrder: i }, select: { id: true } }))
        : (await tx.productOption.create({ data: { productId, name, sortOrder: i }, select: { id: true } }));

      const valueIds: string[] = [];
      for (let j = 0; j < opt.values.length; j++) {
        const v = opt.values[j]!;
        const value = v.value.trim();
        let ov = await tx.productOptionValue.findFirst({
          where: { optionId: option.id, value, deletedAt: null },
          select: { id: true },
        });
        ov = ov
          ? (await tx.productOptionValue.update({ where: { id: ov.id }, data: { swatchHex: v.swatchHex ?? null, sortOrder: j }, select: { id: true } }))
          : (await tx.productOptionValue.create({ data: { optionId: option.id, value, swatchHex: v.swatchHex ?? null, sortOrder: j }, select: { id: true } }));
        valueIds.push(ov.id);
        labelOf[ov.id] = value;
      }
      axes.push(valueIds);
    }

    // Existing active variants: their option-value sets (to skip) and their names.
    const existing = await tx.variant.findMany({
      where: { productId, deletedAt: null },
      select: { name: true, optionValues: { select: { optionValueId: true } } },
    });
    const existingKeys = new Set(
      existing.map((v) => v.optionValues.map((o) => o.optionValueId).sort().join("|"))
    );
    const usedNames = new Set(existing.map((v) => v.name.toLowerCase()));

    // Cartesian product across axes, preserving axis order for the derived name.
    let combos: string[][] = [[]];
    for (const axis of axes) {
      const next: string[][] = [];
      for (const combo of combos) for (const vid of axis) next.push([...combo, vid]);
      combos = next;
    }

    let created = 0;
    let skipped = 0;

    for (const combo of combos) {
      const key = [...combo].sort().join("|");
      if (existingKeys.has(key)) { skipped++; continue; }

      // Derive a unique display name from the value labels.
      let name = combo.map((id) => labelOf[id]).join(" / ");
      let n = 2;
      while (usedNames.has(name.toLowerCase())) name = `${combo.map((id) => labelOf[id]).join(" / ")} (${n++})`;
      usedNames.add(name.toLowerCase());

      await tx.variant.create({
        data: {
          productId,
          name,
          sortOrder: existing.length + created,
          price: defaults?.price ?? null,
          salePrice: defaults?.salePrice ?? null,
          isOnSale: defaults?.isOnSale ?? false,
          stock: defaults?.stock ?? 0,
          optionValues: { create: combo.map((optionValueId) => ({ optionValueId })) },
        },
      });
      existingKeys.add(key);
      created++;
    }

    await syncProductInStock(tx, productId);
    return { created, skipped, total: combos.length };
  });
}

/**
 * Removes an option axis and (via cascade) its values and every variant link.
 * The variants themselves are kept — they simply revert to plain named variants.
 */
export async function deleteOptionService(optionId: string) {
  const option = await prisma.productOption.findUnique({
    where: { id: optionId },
    select: { id: true },
  });
  if (!option) throw new ApiError(404, "Option not found");
  await prisma.productOption.delete({ where: { id: optionId } });
}
