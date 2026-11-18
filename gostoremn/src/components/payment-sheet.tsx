import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Button, Copy, ErrorBox, Row, money } from "@/components/ui";
import { bankLink } from "@/lib/cart";
import { usePalette } from "@/lib/palette";
import type { Invoice } from "@/lib/types";

type Bank = NonNullable<Invoice["urls"]>[number];

function BankTile({ bank, disabled, onPress }: { bank: Bank; disabled: boolean; onPress: () => void }) {
  const colors = usePalette();
  const [failed, setFailed] = useState(false);
  const name = bank.description || bank.name;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={name} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.tile, { opacity: pressed || disabled ? 0.6 : 1 }]}>
      {bank.logo?.startsWith("https://") && !failed ? (
        <Image source={bank.logo} style={styles.logo} contentFit="contain" onError={() => setFailed(true)} />
      ) : (
        <View style={[styles.logo, styles.fallback, { backgroundColor: colors.subtle }]}>
          <Text style={{ color: colors.navy, fontWeight: "700" }}>{name.slice(0, 2)}</Text>
        </View>
      )}
      <Text style={[styles.label, { color: colors.ink }]}>{name}</Text>
    </Pressable>
  );
}

type Props = {
  invoice?: Invoice; orderId: string; amount: number; freight: boolean;
  busy: boolean; error: string; remaining: string; onClose: () => void;
  onOpen: (link: string) => void; onCheck: () => void; onInvoice: () => void;
};

export function PaymentSheet({ invoice, orderId, amount, freight, busy, error, remaining, onClose, onOpen, onCheck, onInvoice }: Props) {
  const colors = usePalette();
  const banks = (invoice?.urls || []).filter(bank => bankLink(bank.link));
  const [showQR, setShowQR] = useState(false);
  const ready = invoice?.state === "ready";
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Буцах" onPress={onClose} style={styles.back}>
            <Text style={{ fontSize: 32, color: colors.ink }}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink }]}>Төлбөр төлөх</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.total}><Copy>Үнийн дүн</Copy><Text style={[styles.amount, { color: colors.ink }]}>{money(amount)}</Text></View>
          <Row label="Төлбөрийн төрөл" value={freight ? "Тээврийн үлдэгдэл" : "Эхний төлбөр"} />
          <Row label="Захиалгын код" value={orderId} />
          {!!remaining && <Row label="Үлдсэн хугацаа" value={remaining} />}
          <ErrorBox message={error} />
          {ready && banks.length > 0 && (
            <View style={[styles.grid, { backgroundColor: colors.surface }]}>
              {banks.map((bank, n) => <BankTile key={bank.link + n} bank={bank} disabled={busy} onPress={() => onOpen(bank.link)} />)}
            </View>
          )}
          {ready && !!invoice?.qr_image && <>
            {banks.length > 0 && <Button secondary title={showQR ? "QR код хаах" : "QR код харуулах"} onPress={() => setShowQR(!showQR)} />}
            {(showQR || !banks.length) && <Image accessibilityLabel="QPay QR" contentFit="contain" style={styles.qr}
              source={invoice.qr_image.startsWith("data:") ? invoice.qr_image : "data:image/png;base64," + invoice.qr_image} />}
          </>}
          {invoice && !ready && <Copy>Нэхэмжлэл боловсруулж байна.</Copy>}
          <Button disabled={busy} title={invoice ? "Төлбөр шалгах" : "QPay нэхэмжлэл авах"} onPress={invoice ? onCheck : onInvoice} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 56, alignItems: "center", justifyContent: "center" },
  back: { position: "absolute", left: 8, width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 19, fontWeight: "600" },
  content: { padding: 16, paddingBottom: 32, gap: 14, width: "100%", maxWidth: 620, alignSelf: "center" },
  total: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  amount: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", borderRadius: 24, paddingHorizontal: 4, paddingVertical: 10 },
  tile: { width: "25%", alignItems: "center", paddingHorizontal: 3, paddingVertical: 10, gap: 8 },
  logo: { width: 50, height: 50, borderRadius: 12 },
  fallback: { alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, textAlign: "center" },
  qr: { width: 248, maxWidth: "100%", height: 248, alignSelf: "center", backgroundColor: "white" },
});
