import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { AdminProductService, type AdminMatrixBody, type AdminProductOption } from "../services/admin.services";
import { toast } from "../../../store/toast.store";
import { colors } from "../../../theme/tokens";

interface DraftValue { value: string; swatchHex: string }
interface DraftOption { name: string; values: DraftValue[] }

const onlyInt = (v: string) => v.replace(/[^0-9]/g, "");
const onlyDecimal = (v: string) => {
  const cleaned = v.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
};

export function VariantMatrixGenerator({
  productId,
  options = [],
  onGenerated,
}: {
  productId: string;
  options?: AdminProductOption[];
  onGenerated: () => void;
}) {
  const [draft, setDraft] = useState<DraftOption[]>([]);
  const [defPrice, setDefPrice] = useState("");
  const [defStock, setDefStock] = useState("");
  const [generating, setGenerating] = useState(false);

  const addOption = () => setDraft((d) => [...d, { name: "", values: [{ value: "", swatchHex: "" }] }]);
  const removeOption = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));
  const setOptionName = (i: number, name: string) => setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, name } : o)));
  const addValue = (i: number) => setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, values: [...o.values, { value: "", swatchHex: "" }] } : o)));
  const setValue = (i: number, j: number, patch: Partial<DraftValue>) =>
    setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, values: o.values.map((v, jdx) => (jdx === j ? { ...v, ...patch } : v)) } : o)));
  const removeValue = (i: number, j: number) =>
    setDraft((d) => d.map((o, idx) => (idx === i ? { ...o, values: o.values.filter((_, jdx) => jdx !== j) } : o)));

  const generate = async () => {
    const built: AdminMatrixBody["options"] = draft
      .map((o) => ({
        name: o.name.trim(),
        values: o.values.map((v) => ({ value: v.value.trim(), swatchHex: v.swatchHex.trim() || null })).filter((v) => v.value),
      }))
      .filter((o) => o.name && o.values.length);

    if (!built.length) return toast.error("Add at least one option with values");

    const defaults: AdminMatrixBody["defaults"] = {};
    if (defPrice) defaults.price = Number(defPrice);
    if (defStock) defaults.stock = Number(defStock);

    setGenerating(true);
    try {
      const res = await AdminProductService.generateVariantMatrix(productId, {
        options: built,
        defaults: Object.keys(defaults).length ? defaults : undefined,
      });
      toast.success(`${res.created} variant${res.created !== 1 ? "s" : ""} created${res.skipped ? `, ${res.skipped} existed` : ""}`);
      setDraft([]); setDefPrice(""); setDefStock("");
      onGenerated();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to generate variants");
    } finally {
      setGenerating(false);
    }
  };

  const removeExisting = async (optionId: string) => {
    try {
      await AdminProductService.deleteOption(optionId);
      toast.success("Option removed");
      onGenerated();
    } catch {
      toast.error("Could not remove option");
    }
  };

  return (
    <View className="gap-2">
      <Text className="font-jakarta-semibold text-text">Options & variant matrix</Text>

      {options.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {options.map((o) => (
            <View key={o.id} className="flex-row items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
              <Text className="text-xs font-jakarta-medium text-text">{o.name}: {o.values.map((v) => v.value).join(", ")}</Text>
              <Ionicons name="trash-outline" size={13} color={colors.danger} onPress={() => removeExisting(o.id)} />
            </View>
          ))}
        </View>
      ) : null}

      {draft.map((opt, i) => (
        <Card key={i} className="gap-2">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Input placeholder="Option name (e.g. Size, Color)" value={opt.name} onChangeText={(t) => setOptionName(i, t)} />
            </View>
            <Ionicons name="trash-outline" size={18} color={colors.danger} onPress={() => removeOption(i)} />
          </View>
          {opt.values.map((val, j) => (
            <View key={j} className="flex-row items-center gap-2">
              <View className="flex-1">
                <Input placeholder="Value (e.g. S, Red)" value={val.value} onChangeText={(t) => setValue(i, j, { value: t })} />
              </View>
              <View className="w-28">
                <Input placeholder="#hex" value={val.swatchHex} onChangeText={(t) => setValue(i, j, { swatchHex: t })} autoCapitalize="none" />
              </View>
              <Ionicons name="close-circle-outline" size={18} color={colors.muted} onPress={() => opt.values.length > 1 && removeValue(i, j)} />
            </View>
          ))}
          <Pressable onPress={() => addValue(i)} className="flex-row items-center gap-1.5">
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text className="text-sm font-jakarta-medium text-primary">Add value</Text>
          </Pressable>
        </Card>
      ))}

      <Pressable onPress={addOption} className="flex-row items-center gap-1.5">
        <Ionicons name="add" size={16} color={colors.primary} />
        <Text className="text-sm font-jakarta-medium text-primary">Add option (Size, Color…)</Text>
      </Pressable>

      {draft.length > 0 ? (
        <Card className="gap-2">
          <Text className="text-sm font-jakarta-medium text-text">Defaults for every generated variant</Text>
          <View className="flex-row gap-2">
            <View className="flex-1"><Input label="Default price" keyboardType="decimal-pad" value={defPrice} onChangeText={(t) => setDefPrice(onlyDecimal(t))} /></View>
            <View className="flex-1"><Input label="Default stock" keyboardType="number-pad" value={defStock} onChangeText={(t) => setDefStock(onlyInt(t))} /></View>
          </View>
          <Button label="Generate variants" loading={generating} onPress={generate} />
        </Card>
      ) : null}
    </View>
  );
}
