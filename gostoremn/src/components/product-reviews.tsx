import { useCallback, useRef, useState, type ReactNode } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { usePalette } from "@/lib/palette";
import { useStore } from "@/lib/store";
import { readReviews, reviewPhotoUrl, type ProductReview, type ReviewPage } from "@/lib/reviews";
import { Busy, Button, Copy, ErrorBox, Field } from "./ui";

function ReviewModal({ children, title, close, busy = false }: { children: ReactNode; title: string; close: () => void; busy?: boolean }) {
  const colors = usePalette(), inset = useSafeAreaInsets();
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) close(); }}>
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg, paddingTop: inset.top, paddingBottom: inset.bottom }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}><Text accessibilityRole="header" style={{ flex: 1, fontSize: 20, fontWeight: "700", color: colors.ink }}>{title}</Text><Button title="Хаах" secondary disabled={busy} onPress={close} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>{children}</ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function ReviewEditor({ productId, mine, close, saved }: { productId: string; mine: ProductReview | null; close: () => void; saved: () => void }) {
  const colors = usePalette();
  const [rating, setRating] = useState(mine?.rating || 0), [comment, setComment] = useState(mine?.comment || "");
  const [photos, setPhotos] = useState<string[]>([]), [removePhotos, setRemovePhotos] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  async function pick(camera: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (photos.length >= 3) throw Error("3 хүртэл зураг оруулна уу.");
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw Error("Камерын зөвшөөрөл өгөх эсвэл сангаас зураг сонгоно уу.");
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 3 - photos.length, quality: 0.9 });
      if (result.canceled) return;
      if (result.assets.length + photos.length > 3) throw Error("3 хүртэл зураг сонгоно уу.");
      const next: string[] = [];
      for (const asset of result.assets) {
        const context = ImageManipulator.manipulate(asset.uri);
        if (Math.max(asset.width, asset.height) > 1200) context.resize(asset.width >= asset.height ? { width: 1200 } : { height: 1200 });
        const rendered = await context.renderAsync();
        const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
        next.push(image.uri);
      }
      setPhotos(previous => [...previous, ...next]);
    } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  async function submit() {
    if (lock.current) return;
    if (!rating) { setError("1–5 одоор үнэлнэ үү."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("product", productId); body.append("rating", String(rating)); body.append("comment", comment);
      if (removePhotos) body.append("remove_photos", "1");
      for (const uri of photos) {
        if (Platform.OS === "web") body.append("photos[]", await (await fetch(uri)).blob(), "review.jpg");
        else body.append("photos[]", { uri, type: "image/jpeg", name: "review.jpg" } as unknown as Blob);
      }
      await api("review-save", body); saved();
    } catch (e) { setError((e as Error).message); } finally { lock.current = false; setBusy(false); }
  }
  const previous = !removePhotos && !photos.length ? mine?.photos || [] : [];
  return <ReviewModal title={mine ? "Миний үнэлгээг засах" : "Үнэлгээ өгөх"} close={close} busy={busy}>
    {mine?.status === "hidden" && <Copy>Энэ сэтгэгдлийг админ нуусан байна. Засах нь дахин нийтлэхгүй.</Copy>}
    <Text style={{ color: colors.ink, fontWeight: "600" }}>Таны үнэлгээ</Text>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityLabel={`${n} од`} accessibilityState={{ selected: rating === n, disabled: busy }} disabled={busy} onPress={() => setRating(n)} testID={`review-star-${n}`} style={{ minHeight: 52, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: rating >= n ? colors.accentSurface : colors.subtle }}><Text style={{ fontSize: 26, color: rating >= n ? colors.accentText : colors.muted }}>★</Text></Pressable>)}</View>
    <Field label="Сэтгэгдэл" testID="review-comment" value={comment} onChangeText={setComment} multiline maxLength={2000} editable={!busy} placeholder="Барааны чанар, хэмжээ, хэрэглээ…" style={{ minHeight: 120, textAlignVertical: "top" }} />
    <Text style={{ color: colors.muted }}>{comment.length} / 2000</Text>
    <View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Button title="Зураг сонгох" secondary disabled={busy || photos.length >= 3} onPress={() => { void pick(false); }} testID="review-pick" /></View><View style={{ flex: 1 }}><Button title="Зураг авах" secondary disabled={busy || photos.length >= 3} onPress={() => { void pick(true); }} /></View></View>
    <Copy>3 хүртэл зураг. Шинэ зураг сонговол өмнөх зургуудыг солино.</Copy>
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{photos.map((uri, i) => <View key={uri} style={{ width: 90, gap: 4 }}><Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 10 }} contentFit="cover" /><Button title="Хасах" secondary disabled={busy} onPress={() => setPhotos(p => p.filter((_, at) => at !== i))} /></View>)}{previous.map(uri => <Image key={uri} source={{ uri: reviewPhotoUrl(uri) }} style={{ width: 90, height: 90, borderRadius: 10 }} contentFit="cover" />)}</View>
    {!!mine?.photos.length && !photos.length && <Button title={removePhotos ? "Өмнөх зургуудыг үлдээх" : "Өмнөх зургуудыг арилгах"} secondary disabled={busy} onPress={() => setRemovePhotos(v => !v)} />}
    <Copy>Өөрийн авсан зураг, бараанд хамаарах сэтгэгдэл оруулна уу. Хувийн мэдээлэл, доромжлол, хууль бус болон ил задгай агуулга нийтлэхгүй.</Copy>
    <ErrorBox message={error} /><Button title={busy ? "Боловсруулж байна…" : "Үнэлгээг хадгалах"} disabled={busy} onPress={() => { void submit(); }} testID="review-save" />
  </ReviewModal>;
}

export function ProductReviews({ productId, full = false }: { productId: string; full?: boolean }) {
  const colors = usePalette(), { customer } = useStore(), inset = useSafeAreaInsets();
  const [data, setData] = useState<ReviewPage | null>(null), [rows, setRows] = useState<ProductReview[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [editor, setEditor] = useState(false), [picture, setPicture] = useState(""), [action, setAction] = useState<{ kind: "delete" | "report" | "block"; review: ProductReview } | null>(null), [reason, setReason] = useState(""), [acting, setActing] = useState(false), [actionError, setActionError] = useState("");
  const state = useRef({ generation: 0, busy: false, page: 1, more: true });
  const load = useCallback(async (reset = false) => {
    const current = state.current;
    if (!reset && (current.busy || !current.more)) return;
    if (reset) { current.generation++; current.page = 1; }
    const generation = current.generation, page = current.page;
    current.busy = true; setLoading(true); setError("");
    try {
      const result = await readReviews(productId, page);
      if (current.generation !== generation) return;
      setData(result); setRows(previous => reset ? result.reviews : [...previous, ...result.reviews.filter(r => !previous.some(old => old.id === r.id))]); current.more = result.more; current.page = page + 1;
    } catch (e) { if (current.generation === generation) setError((e as Error).message); }
    finally { if (current.generation === generation) { current.busy = false; setLoading(false); } }
  }, [productId]);
  useFocusEffect(useCallback(() => { if (!customer?.id) { setEditor(false); setAction(null); } setData(null); setRows([]); void load(true); const current = state.current; return () => { current.generation++; current.busy = false; }; }, [load, customer?.id]));
  function requireLogin() {
    if (data?.authenticated) return true;
    router.push({ pathname: "/login", params: { next: `/reviews/${productId}` } }); return false;
  }
  function write() { if (!full) { router.push({ pathname: "/reviews/[id]", params: { id: productId } }); return; } if (requireLogin()) setEditor(true); }
  const actionLock = useRef(false);
  async function confirmAction() {
    if (!action || actionLock.current) return;
    if (action.kind === "report" && !reason.trim()) { setActionError("Шалтгаанаа бичнэ үү."); return; }
    actionLock.current = true; setActing(true); setActionError("");
    try { await api(`review-${action.kind}`, { id: action.review.id, ...(action.kind === "report" ? { reason: reason.trim() } : {}) }); setAction(null); await load(true); }
    catch (e) { setActionError((e as Error).message); } finally { actionLock.current = false; setActing(false); }
  }
  function openAction(kind: "delete" | "report" | "block", review: ProductReview) { if (!requireLogin()) return; setActionError(""); setReason(""); setAction({ kind, review }); }
  const card = (r: ProductReview) => <View testID="review-card" style={{ gap: 10, paddingVertical: 16, borderTopWidth: 1, borderColor: colors.line }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text style={{ color: colors.ink, fontWeight: "700" }}>{r.author}</Text><Text accessibilityLabel={`${r.rating} од`} style={{ color: colors.accentText }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text></View>
    <Text style={{ color: colors.muted, fontSize: 12 }}>{r.created.slice(0, 10)}</Text>{!!r.comment && <Text style={{ color: colors.ink, lineHeight: 22 }}>{r.comment}</Text>}
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{r.photos.map((url, i) => <Pressable key={url} accessibilityRole="button" accessibilityLabel={`Сэтгэгдлийн ${i + 1}-р зургийг томруулах`} onPress={() => setPicture(reviewPhotoUrl(url))}><Image source={{ uri: reviewPhotoUrl(url) }} style={{ width: 82, height: 82, borderRadius: 8 }} contentFit="cover" cachePolicy="none" /></Pressable>)}</View>
    {full && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{r.mine ? <Button title="Устгах" secondary onPress={() => openAction("delete", r)} /> : <><Button title="Мэдээлэх" secondary onPress={() => openAction("report", r)} /><Button title="Хэрэглэгчийг нуух" secondary onPress={() => openAction("block", r)} /></>}</View>}
  </View>;
  const heading = <View style={{ gap: 12 }}><Text style={{ color: colors.ink, fontSize: 20, fontWeight: "700" }}>GOStore үнэлгээ</Text><Copy>Энэ бараанд GOStore хэрэглэгчдийн өгсөн үнэлгээ</Copy>{data && <Text style={{ color: colors.accentText, fontSize: 22, fontWeight: "700" }}>{data.average === null ? "Үнэлгээ хараахан алга" : `★ ${data.average.toFixed(1)} / 5`}<Text style={{ color: colors.muted, fontSize: 14 }}> · {data.total} үнэлгээ</Text></Text>}<Button title={data?.mine ? "Миний үнэлгээг засах" : "Үнэлгээ өгөх"} onPress={write} disabled={loading && !data} testID="review-write" />
    {full && data?.mine?.status === "hidden" && <><Copy>Таны сэтгэгдлийг админ нуусан байна.</Copy><Button title="Миний нуусан сэтгэгдлийг устгах" secondary onPress={() => openAction("delete", data.mine!)} /></>}
    {full && !!data?.blocked_count && <Button title="Нуусан хэрэглэгчдийг дахин харуулах" secondary disabled={loading} onPress={() => { void api("review-unblock-all", {}).then(() => load(true)).catch(e => setError(e.message)); }} />}
    <ErrorBox message={error} />{!!error && <Button title="Дахин оролдох" secondary onPress={() => { void load(true); }} />}</View>;
  const footer = <View style={{ gap: 12 }}>{loading && <Busy />}{!loading && !error && !rows.length && <Copy>Энэ бараанд анхны үнэлгээгээ өгөөрэй.</Copy>}{full && data?.more && <Button title="Бусад сэтгэгдлийг харах" secondary disabled={loading} onPress={() => { void load(); }} />}{!full && <Button title="Бүх сэтгэгдлийг харах" secondary onPress={() => router.push({ pathname: "/reviews/[id]", params: { id: productId } })} />}</View>;
  return <>{full ? <FlatList testID="reviews-list" data={rows} keyExtractor={r => r.id} renderItem={({ item }) => card(item)} ListHeaderComponent={heading} ListFooterComponent={footer} refreshing={loading && !!data} onRefresh={() => { void load(true); }} contentContainerStyle={{ padding: 16, paddingBottom: inset.bottom + 24, maxWidth: 820, width: "100%", alignSelf: "center" }} style={{ backgroundColor: colors.bg }} /> : <View style={{ gap: 12 }}>{heading}{rows.slice(0, 3).map(r => <View key={r.id}>{card(r)}</View>)}{footer}</View>}
    {editor && <ReviewEditor key={data?.mine?.id || "new"} productId={productId} mine={data?.mine || null} close={() => setEditor(false)} saved={() => { setEditor(false); void load(true); }} />}
    {!!picture && <ReviewModal title="Сэтгэгдлийн зураг" close={() => setPicture("")}><Image source={{ uri: picture }} style={{ width: "100%", height: 450 }} contentFit="contain" cachePolicy="none" /></ReviewModal>}
    {action && <ReviewModal title={action.kind === "delete" ? "Үнэлгээг устгах" : action.kind === "block" ? "Хэрэглэгчийг нуух" : "Сэтгэгдэл мэдээлэх"} close={() => setAction(null)} busy={acting}><Copy>{action.kind === "delete" ? "Таны үнэлгээ, сэтгэгдэл болон хавсаргасан зургууд устна." : action.kind === "block" ? "Энэ хэрэглэгчийн бүх сэтгэгдэл таны бүртгэлд харагдахгүй болно." : "Шалтгааныг админд илгээнэ."}</Copy>{action.kind === "report" && <Field label="Шалтгаан" value={reason} onChangeText={setReason} multiline maxLength={500} editable={!acting} />}<ErrorBox message={actionError} /><Button title={acting ? "Хадгалж байна…" : "Баталгаажуулах"} disabled={acting} onPress={() => { void confirmAction(); }} /></ReviewModal>}
  </>;
}
