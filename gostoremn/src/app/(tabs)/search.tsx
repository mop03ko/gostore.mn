import { useCallback, useRef, useState } from "react";
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Icon, IconButton } from "@/components/shop-ui";
import { Button, Busy, ErrorBox } from "@/components/ui";
import { categories } from "@/components/discovery";
import { usePalette } from "@/lib/palette";
import { useStore } from "@/lib/store";
import { uploadSearchPhoto } from "@/lib/image-search";

export default function Search() {
  const colors = usePalette(), inset = useSafeAreaInsets(), { shipping } = useStore();
  const { width, height } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false), [foreground, setForeground] = useState(true);
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false), [cameraError, setCameraError] = useState("");
  const camera = useRef<CameraView>(null), lock = useRef(false), active = useRef(false);
  useFocusEffect(useCallback(() => {
    active.current = true; setFocused(true); setCameraReady(false); setCameraError("");
    setForeground(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", state => {
      setForeground(state === "active"); setCameraReady(false);
    });
    return () => { active.current = false; setFocused(false); subscription.remove(); };
  }, []));
  const enabled = !!shipping?.image_search_enabled;
  const changeMode = (next: "photo" | "text") => {
    setCameraReady(false);
    setCameraError("");
    setMode(next);
  };
  const submit = () => {
    if (query.trim()) router.navigate({ pathname: "/", params: { q: query.trim(), image: "", photo: "" } });
  };
  async function photo(gallery: boolean) {
    if (lock.current || !enabled) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let asset;
      if (gallery) {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        if (result.canceled) return;
        asset = result.assets[0];
      } else {
        if (!cameraReady || !camera.current) return;
        asset = await camera.current.takePictureAsync({ quality: 0.8 });
      }
      if (!asset) return;
      const image = await uploadSearchPhoto(asset);
      if (active.current) router.navigate({ pathname: "/", params: { image, q: "", photo: "" } });
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  const photographic = mode === "photo" && enabled;
  return <View testID="search-screen" style={{ flex: 1, backgroundColor: photographic ? "#19172c" : colors.surface }}>
    {focused && <StatusBar style={photographic || colors.dark ? "light" : "dark"} />}
    {photographic && permission?.granted && focused && foreground && !cameraError &&
      <CameraView ref={camera} facing="back" style={StyleSheet.absoluteFill} onCameraReady={() => setCameraReady(true)} onMountError={() => setCameraError("Камер нээгдэхгүй байна. Зургийн сангаас сонгох боломжтой.")} />}
    <View style={{ paddingTop: inset.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: photographic ? "#19172c99" : colors.surface }}>
      <Text accessibilityRole="header" style={{ color: photographic ? "white" : colors.navy, fontWeight: "800", fontSize: 22 }}>Бараа хайх</Text>
      <IconButton name="help" label="Хайлтын тусламж" color={photographic ? "white" : colors.navy} onPress={() => router.push("/help")} />
    </View>
    {photographic ? <View style={{ flex: 1, padding: 20, justifyContent: "space-between" }}>
      <View style={{ flex: 1, justifyContent: "center", gap: 20 }}>
        {permission?.granted ? <><View pointerEvents="none" style={{ alignSelf: "center", width: Math.min(width - 80, height * 0.32, 360), aspectRatio: 1, borderRadius: 28, borderWidth: 2, borderColor: "#ffffff99" }} /><Text style={s.hint}>Бараагаа хүрээнд багтааж зураг аваарай</Text></> : <View style={{ alignSelf: "center" }}><Icon name="camera" color="white" size={64} /></View>}
        {!permission?.granted && <View style={{ gap: 10 }}><Text style={s.hint}>Камер нээх зөвшөөрөл өгнө үү. Эсвэл доороос бэлэн зураг сонгоорой.</Text><Button title={permission?.canAskAgain === false ? "Тохиргоо нээх" : "Камер нээх"} onPress={() => { void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission()).catch(e => setError(e.message)); }} /></View>}
        {!!cameraError && <Text style={s.hint}>{cameraError}</Text>}
      </View>
      {!!error && <View style={{ backgroundColor: colors.surface, borderRadius: 12 }}><ErrorBox message={error} /></View>}
      {busy && <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12 }}><Busy /><Text style={{ color: colors.ink, textAlign: "center" }}>Төстэй бараа хайж байна…</Text></View>}
      <View style={s.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Зургийн сангаас сонгох" disabled={busy} onPress={() => void photo(true)} style={s.side}><Icon name="grid" color="white" size={27} /><Text style={s.white}>Зургийн сан</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Зураг авч хайх" accessibilityState={{ disabled: busy || !cameraReady }} disabled={busy || !cameraReady} onPress={() => void photo(false)} style={[s.shutter, { opacity: cameraReady && !busy ? 1 : 0.4 }]}><View style={s.shutterInner} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => changeMode("text")} style={s.side}><Icon name="search" color="white" size={27} /><Text style={s.white}>Нэрээр хайх</Text></Pressable>
      </View>
    </View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.orange, borderRadius: 28, paddingLeft: 16, paddingRight: 4 }}>
        <TextInput accessibilityLabel="Хайх барааны нэр" placeholder="Барааны нэр, брэнд эсвэл холбоос" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} onSubmitEditing={submit} returnKeyType="search" style={{ color: colors.ink, flex: 1, minWidth: 0, minHeight: 48 }} />
        <IconButton name="search" label="Хайх" onPress={submit} />
      </View>
      {enabled && <Button title="Камераар болон зургаар хайх" onPress={() => changeMode("photo")} />}
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.navy }}>Хайж эхлэх санаанууд</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{categories.slice(0, 12).map(c => <Pressable accessibilityRole="button" key={c.id} onPress={() => router.navigate({ pathname: "/", params: { q: c.query, image: "" } })} style={{ backgroundColor: colors.subtle, borderRadius: 24, paddingHorizontal: 16, minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.ink }}>{c.name}</Text></Pressable>)}</View>
      {!enabled && <Text style={{ color: colors.muted }}>Зурагт хайлт одоогоор идэвхгүй байна. Барааны нэрээр хайх боломжтой.</Text>}
    </ScrollView>}
    {enabled && <View style={{ flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 12 }}>{(["photo", "text"] as const).map(m => <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => { if (m !== mode) changeMode(m); }} style={{ minHeight: 44, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: mode === m ? colors.orange : "transparent" }}><Text style={{ color: photographic ? "white" : colors.ink, fontWeight: mode === m ? "800" : "400" }}>{m === "photo" ? "ЗУРГААР" : "НЭРЭЭР"}</Text></Pressable>)}</View>}
  </View>;
}
const s = StyleSheet.create({
  hint: { color: "white", textAlign: "center", fontSize: 14, lineHeight: 21, backgroundColor: "#19172cbb", padding: 12, borderRadius: 12 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, gap: 12 },
  side: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#19172c99", borderRadius: 16 },
  white: { color: "white", fontSize: 12 }, shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "white", padding: 5 },
  shutterInner: { flex: 1, borderRadius: 40, backgroundColor: "white" },
});
