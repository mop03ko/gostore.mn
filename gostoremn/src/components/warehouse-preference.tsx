import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { useGlobalSearchParams, usePathname } from "expo-router";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useStore } from "@/lib/store";
import { usePalette } from "@/lib/palette";
import type { PickupLocation } from "@/lib/types";
import { pickupLocations, readWarehousePreference, recommendWarehouse, warehousePreferenceKey } from "@/lib/warehouse-preference";
import { locateForWarehouse, WarehouseLocationError } from "@/lib/warehouse-location";
import { Button, Copy, ErrorBox, Title } from "./ui";

type Preference = { selected: PickupLocation | null; loaded: boolean; open: () => void; blocksPromo: boolean };
const Context = createContext<Preference | null>(null);
export function useWarehousePreference() {
  const value = use(Context);
  if (!value) throw Error("Warehouse preference unavailable");
  return value;
}
export function WarehousePreferenceProvider({ children }: { children: ReactNode }) {
  const { shipping, ready } = useStore();
  const pathname = usePathname(), params = useGlobalSearchParams();
  const [id, setId] = useState<string | null>(null), [loaded, setLoaded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false), [manual, setManual] = useState(false);
  const [storageError, setStorageError] = useState("");
  const locations = pickupLocations(shipping), selected = locations.find((p) => p.location === id) ?? null;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(warehousePreferenceKey).then(raw => { if (active) setId(readWarehousePreference(raw)); })
      .catch(() => { if (active) setStorageError("Өмнөх сонголтыг уншиж чадсангүй. Агуулахаа дахин сонгоорой."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  // Once per cold launch on home, never over a payment/auth deep link or on every resume.
  const home = pathname === "/" && !params.q && !params.image;
  const visible = manual || (!acknowledged && home && loaded && ready && locations.length > 0);
  const close = () => { setManual(false); setAcknowledged(true); };
  const save = async (location: string) => {
    if (!locations.some((p) => p.location === location)) throw Error("Энэ агуулах идэвхгүй болсон. Өөр агуулах сонгоно уу.");
    await AsyncStorage.setItem(warehousePreferenceKey, JSON.stringify({ version: 1, location }));
    setId(location); setStorageError(""); close();
  };
  return <Context value={{ selected, loaded, open: () => setManual(true), blocksPromo: visible || !loaded || !ready || (!acknowledged && locations.length > 0) }}>
    {children}
    {visible && <WarehouseSheet locations={locations} selected={selected} warning={storageError || (id && !selected ? "Өмнөх агуулах одоогоор сонгох боломжгүй байна." : "")} save={save} close={close} />}
  </Context>;
}

function WarehouseSheet({ locations, selected, warning, save, close }: { locations: PickupLocation[]; selected: PickupLocation | null; warning: string; save: (id: string) => Promise<void>; close: () => void }) {
  const c = usePalette();
  const [draft, setDraft] = useState(selected?.location ?? ""), [recommended, setRecommended] = useState("");
  const [error, setError] = useState(warning), [settings, setSettings] = useState(false), [locating, setLocating] = useState(false), [saving, setSaving] = useState(false);
  const generation = useRef(0), alive = useRef(true), saveLock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const choose = (id: string) => { generation.current++; setLocating(false); setDraft(id); setError(""); setSettings(false); };
  async function locate() {
    const request = ++generation.current; setLocating(true); setError(""); setSettings(false); setRecommended("");
    try {
      const position = await locateForWarehouse();
      if (!alive.current || generation.current !== request) return;
      const suggestion = recommendWarehouse(locations, position);
      if (suggestion) setRecommended(suggestion.location);
      else setError("Ойр хотын агуулахыг найдвартай санал болгож чадсангүй. Доороос сонгоорой.");
    } catch (e) {
      if (alive.current && generation.current === request) {
        setError(e instanceof WarehouseLocationError ? e.message : "Байршлыг авч чадсангүй. Агуулахаа гараар сонгоорой.");
        setSettings(e instanceof WarehouseLocationError && e.settings);
      }
    } finally { if (alive.current && generation.current === request) setLocating(false); }
  }
  async function confirm() {
    if (saveLock.current || !locations.some(p => p.location === draft)) return;
    saveLock.current = true; generation.current++; setLocating(false); setSaving(true); setError("");
    try { await save(draft); }
    catch { if (alive.current) setError("Сонголтыг хадгалж чадсангүй. Дахин оролдоно уу."); }
    finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }
  return <Modal transparent visible animationType="fade" onRequestClose={() => { if (!saving) close(); }}>
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "rgba(15,20,40,0.65)" }}>
      <View accessibilityViewIsModal testID="warehouse-picker" style={{ width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: 22, backgroundColor: c.surface, overflow: "hidden" }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={{ color: c.navy, fontSize: 22, fontWeight: "800" }}>Авах агуулахаа сонгоорой</Text>
          <Copy>{selected ? "Өмнөх сонголтоо хадгалах эсвэл өөр агуулах сонгож болно." : "Эрээнээс аль салбарт хүргүүлэхээ сонгоорой. Дараа нь сольж болно."}</Copy>
          <Button title={locating ? "Байршил тодорхойлж байна…" : "Ойр агуулах санал болгох"} secondary disabled={locating || saving} onPress={() => void locate()} testID="warehouse-locate" />
          <Copy>Байршлыг хадгалахгүй. Зөвшөөрөл өгөхгүйгээр гараар сонгож болно.</Copy>
          <ErrorBox message={error} />
          {settings && <Button title="Утасны тохиргоо нээх" secondary onPress={() => { void Linking.openSettings().catch(() => setError("Утасныхаа тохиргооноос байршлын зөвшөөрлийг өөрчилж болно.")); }} />}
          {locations.map(p => <Pressable key={p.location} testID={"warehouse-option-" + p.location} accessibilityRole="radio" aria-checked={draft === p.location} accessibilityState={{ checked: draft === p.location, disabled: saving }} accessibilityLabel={p.name + (recommended === p.location ? ". Байршлаар санал болгосон" : "")} disabled={saving} onPress={() => choose(p.location)} style={{ padding: 14, gap: 5, borderRadius: 14, borderWidth: 2, borderColor: draft === p.location ? c.orange : c.line, backgroundColor: draft === p.location ? c.accentSurface : c.subtle }}>
            <Text style={{ color: c.navy, fontWeight: "800", fontSize: 18 }}>{draft === p.location ? "✓ " : ""}{p.city || p.name}</Text>
            {recommended === p.location && <Text style={{ color: c.accentText, fontWeight: "700" }}>Байршлаар санал болгож байна</Text>}
            <Text style={{ color: c.ink, fontSize: 13, lineHeight: 19 }}>{p.address}</Text>
            {!!p.phone && <Text style={{ color: c.muted, fontSize: 13 }}>{p.phone}</Text>}
          </Pressable>)}
          {!!recommended && <Copy>Хотын байршлаар ойролцоолсон санал. Агуулахын яг зай, замын урт биш; авах газраа өөрөө сонгож батална.</Copy>}
          {!locations.length && <Copy>Агуулахын мэдээлэл одоогоор ирээгүй байна. Түр хаагаад дахин оролдоно уу.</Copy>}
        </ScrollView>
        <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderColor: c.line }}>
          <Button title={saving ? "Хадгалж байна…" : "Сонголтоо хадгалах"} disabled={saving || !locations.some(p => p.location === draft)} onPress={() => void confirm()} testID="warehouse-confirm" />
          <Button title={selected ? "Өмнөх сонголтоор үргэлжлүүлэх" : "Дараа сонгох"} secondary disabled={saving} onPress={close} />
          <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>Зөвхөн шинэ захиалгын авах газрыг сонгоно.</Text>
        </View>
      </View>
    </View>
  </Modal>;
}

export function WarehousePreferenceCard({ disabled = false }: { disabled?: boolean }) {
  const { selected, loaded, open } = useWarehousePreference(), c = usePalette();
  return <Pressable testID="warehouse-preference" accessibilityRole="button" accessibilityLabel={"Авах агуулах: " + (selected?.name ?? "Сонгоогүй") + ". Солих"} disabled={disabled || !loaded} onPress={open} style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.accentSurface, gap: 5, opacity: disabled ? 0.6 : 1 }}>
    <Text style={{ color: c.muted, fontSize: 12 }}>ТАНЫ АВАХ АГУУЛАХ</Text>
    <Title>{selected?.name ?? "Агуулахаа сонгох"}</Title>
    {selected && <Text style={{ color: c.ink, fontSize: 12, lineHeight: 18 }}>{selected.address}</Text>}
    <Text style={{ color: c.accentText, fontWeight: "700" }}>{selected ? "Агуулах солих →" : "Сонгох →"}</Text>
  </Pressable>;
}
