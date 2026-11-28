import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/shop-ui";
import { Card, Copy, Field, money, Title } from "@/components/ui";
import { cargoNumber, estimateCargo } from "@/lib/cargo-tariff";
import { usePalette } from "@/lib/palette";
import type { Shipping } from "@/lib/types";

const dimensionLabels = ["Урт (см)", "Өргөн (см)", "Өндөр (см)"];

export function CargoCalculator({ shipping }: { shipping: Shipping | null }) {
  const c = usePalette();
  const [mode, setMode] = useState<"dimensions" | "volume">("dimensions");
  const [weight, setWeight] = useState("");
  const [volume, setVolume] = useState("");
  const [sizes, setSizes] = useState(["", "", ""]);
  const tariff = shipping?.cargo_tariff;
  const cm = sizes.map(cargoNumber);
  const m3 = mode === "volume" ? cargoNumber(volume) :
    cm.every(n => n > 0) ? Number((cm.reduce((v, length) => v * length, 1) / 1_000_000).toFixed(9)) : NaN;
  const entered = !!weight.trim() && (mode === "volume" ? !!volume.trim() : sizes.every(value => !!value.trim()));
  const quote = estimateCargo(cargoNumber(weight), m3, tariff, shipping?.cny_rate);
  return <Card style={{ borderRadius: 20, gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon name="calculator" color={c.accentText} size={22} />
      <Title>Карго тооцоолуур</Title>
    </View>
    {tariff ? <>
      <Field label="Нийт жин (кг)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Жишээ: 1.2" maxLength={13} />
      <View style={{ flexDirection: "row", borderRadius: 12, padding: 3, gap: 4, backgroundColor: c.subtle }}>
        {([{ key: "dimensions", label: "Хэмжээ (см)" }, { key: "volume", label: "Эзлэхүүн (м³)" }] as const).map(option =>
          <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: mode === option.key }}
            onPress={() => setMode(option.key)} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 10, backgroundColor: mode === option.key ? c.surface : c.subtle }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: mode === option.key ? c.accentText : c.muted }}>{option.label}</Text>
          </Pressable>)}
      </View>
      {mode === "volume"
        ? <Field label="Нийт эзлэхүүн (м³)" value={volume} onChangeText={setVolume} keyboardType="decimal-pad" placeholder="Жишээ: 0.03" maxLength={13} />
        : <View style={{ flexDirection: "row", gap: 6 }}>
          {dimensionLabels.map((label, index) => <View key={label} style={{ flex: 1, minWidth: 0 }}>
            <Field label={label} value={sizes[index]} onChangeText={value => setSizes(old => old.map((item, i) => i === index ? value : item))} keyboardType="decimal-pad" placeholder="0" maxLength={10} />
          </View>)}
        </View>}
      <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.accentSurface, padding: 12, borderRadius: 12, gap: 4 }}>
        <Text style={{ color: c.accentText, fontWeight: "700" }}>Урьдчилсан тээврийн үнэ</Text>
        {quote ? <>
          <Text style={{ color: c.navy, fontSize: 25, fontWeight: "800" }}>≈ {money(quote.amount)}</Text>
          <Text style={{ color: c.ink, fontSize: 13 }}>{quote.category === "small" ? "Жижиг илгээмж" : quote.basis === "volume" ? "Том ачаа · эзлэхүүнээр" : "Том ачаа · жингээр"}</Text>
        </> : <Text style={{ color: c.muted, fontSize: 13 }}>{entered ? "Жин, хэмжээг зөв оруулна уу." : "Жин, хэмжээг оруулахад дүн гарна."}</Text>}
      </View>
      {tariff.version === 3 && <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
        {tariff.small_weight_limit_kg} кг-аас бага, {tariff.small_volume_limit_m3} м³ хүртэл бол эхэлсэн {tariff.small_step_kg} кг тутамд {money(tariff.small_step_mnt)}. Том ачаанд {tariff.large_per_m3_cny} ¥/м³ ба {tariff.large_per_tonne_cny.toLocaleString("en-US")} ¥/тонноор бодсон дүнгийн ихийг авна.
      </Text>}
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>Эцсийн дүнг агуулахад жин, хэмжээг тулгаж баталгаажуулна.</Text>
    </> : <Copy>Тарифын мэдээллийг одоогоор ачаалж чадсангүй.</Copy>}
  </Card>;
}
