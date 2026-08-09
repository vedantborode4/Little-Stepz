import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { affiliatePayoutDetailsSchema } from "@repo/zod-schema/index";

import { ScreenContainer } from "../../components/layout/ScreenContainer";
import { AffiliateShell } from "../../features/affiliate/components/AffiliateShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAffiliateMe, useAffiliateStats } from "../../features/affiliate/hooks";
import { AffiliateService } from "../../features/affiliate/services/affiliate.service";
import { qk } from "../../lib/api/query-client";
import { formatPrice } from "../../lib/utils/format";
import { toast } from "../../store/toast.store";

export default function AffiliatePayout() {
  const me = useAffiliateMe();
  const stats = useAffiliateStats();
  const qc = useQueryClient();

  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [amount, setAmount] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasDetails = !!me.data?.payoutDetails?.accountNumber;

  useEffect(() => {
    const pd = me.data?.payoutDetails;
    if (pd) {
      setAccountHolder(pd.accountHolder ?? "");
      setAccountNumber(pd.accountNumber ?? "");
      setIfsc(pd.ifsc ?? "");
      setBankName(pd.bankName ?? "");
      setUpiId(pd.upiId ?? "");
    }
  }, [me.data]);

  const overview = (stats.data as any)?.overview ?? stats.data ?? {};
  const available = Number(overview.pendingEarnings ?? overview.pendingBalance ?? 0);
  const paidOut = Number(overview.paidOutBalance ?? 0);

  const saveDetails = async () => {
    const payload: Record<string, string> = { accountHolder, accountNumber, ifsc: ifsc.toUpperCase(), bankName };
    if (upiId.trim()) payload.upiId = upiId.trim();
    const parsed = affiliatePayoutDetailsSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fe[key]) fe[key] = issue.message;
      }
      setFieldErrors(fe);
      return;
    }
    setFieldErrors({});
    setSavingDetails(true);
    try {
      await AffiliateService.updatePayout(parsed.data);
      toast.success("Payout details saved");
      setEditing(false);
      qc.invalidateQueries({ queryKey: qk.affiliateMe });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save details");
    } finally {
      setSavingDetails(false);
    }
  };

  const maskAccount = (n: string) => (n.length > 4 ? `•••• ${n.slice(-4)}` : n);

  const withdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt < 100) return toast.error("Minimum withdrawal is ₹100");
    if (amt > available) return toast.error("Amount exceeds available balance");
    setWithdrawing(true);
    try {
      await AffiliateService.withdraw(amt);
      toast.success("Withdrawal requested");
      setAmount("");
      qc.invalidateQueries({ queryKey: qk.affiliateStats });
      qc.invalidateQueries({ queryKey: qk.affiliateCommissions });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not request withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <AffiliateShell active="payout">
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} showsVerticalScrollIndicator={false}>
          <View>
            <Text className="text-lg font-jakarta-bold text-text">Payout</Text>
            <Text className="text-xs text-muted">Manage your bank details and withdraw earnings</Text>
          </View>

          {/* Balance + withdraw */}
          <Card className="gap-4">
            <View>
              <Text className="text-sm text-muted">Available balance</Text>
              <Text className="text-2xl font-jakarta-bold text-text">{formatPrice(available)}</Text>
            </View>
            <View className="gap-2 border-t border-border pt-3">
              <Text className="font-jakarta-medium text-text">Request withdrawal</Text>
              <Input label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" />
              <Button label="Withdraw" loading={withdrawing} onPress={withdraw} disabled={available < 100} />
              <Text className="text-xs text-muted">Minimum ₹100 · Paid to your bank account within 3–5 days</Text>
            </View>
            <View className="flex-row justify-between border-t border-border pt-3">
              <Text className="text-sm text-muted">Total paid out</Text>
              <Text className="text-sm font-jakarta-semibold text-text">{formatPrice(paidOut)}</Text>
            </View>
          </Card>

          {/* Bank details */}
          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-jakarta-semibold text-text">Bank details</Text>
              {hasDetails && !editing ? (
                <Button label="Edit" variant="outline" fullWidth={false} onPress={() => setEditing(true)} className="px-4" />
              ) : null}
            </View>

            {hasDetails && !editing ? (
              <View className="gap-2">
                <Row label="Account holder" value={accountHolder || "—"} />
                <Row label="Account number" value={maskAccount(accountNumber)} />
                <Row label="IFSC" value={ifsc || "—"} />
                <Row label="Bank name" value={bankName || "—"} />
                {upiId ? <Row label="UPI ID" value={upiId} /> : null}
              </View>
            ) : (
              <>
                <Input label="Account holder" value={accountHolder} onChangeText={setAccountHolder} error={fieldErrors.accountHolder} />
                <Input label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" error={fieldErrors.accountNumber} />
                <Input label="IFSC" value={ifsc} onChangeText={(t) => setIfsc(t.toUpperCase())} autoCapitalize="characters" error={fieldErrors.ifsc} />
                <Input label="Bank name" value={bankName} onChangeText={setBankName} error={fieldErrors.bankName} />
                <Input label="UPI ID (optional)" value={upiId} onChangeText={setUpiId} autoCapitalize="none" keyboardType="email-address" error={fieldErrors.upiId} />
                <Button label="Save Details" loading={savingDetails} onPress={saveDetails} />
              </>
            )}
          </Card>
        </ScrollView>
      </AffiliateShell>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-jakarta-medium text-text">{value}</Text>
    </View>
  );
}
