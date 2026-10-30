import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { api, catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import {
  Button,
  Busy,
  Card,
  Copy,
  ErrorBox,
  Field,
  Title,
  colors,
  money,
} from "@/components/ui";
const brands = [
  "Nike",
  "adidas",
  "Puma",
  "New Balance",
  "UNIQLO",
  "ZARA",
  "H&M",
  "The North Face",
  "Sony",
  "Xiaomi",
  "LEGO",
  "IKEA",
];
const categories = [
  ["Бүгд", "storage box"],
  ["Хувцас", "clothing"],
  ["Гутал", "shoes"],
  ["Цүнх", "bag"],
  ["Гэр ахуй", "home storage"],
  ["Гоо сайхан", "beauty"],
  ["Тоглоом", "toys"],
];
type Results = {
  products: Product[];
  more: boolean;
  revalidate?: boolean;
  stale?: boolean;
};
export default function Shop() {
  const { shipping, error: bootError, refresh } = useStore(),
    { width } = useWindowDimensions(),
    columns = width >= 800 ? 4 : 2;
  const [draft, setDraft] = useState(""),
    [query, setQuery] = useState("storage box"),
    [sort, setSort] = useState("default"),
    [image, setImage] = useState(""),
    [page, setPage] = useState(1),
    [items, setItems] = useState<Product[]>([]),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [retry, setRetry] = useState(0),
    [uploading, setUploading] = useState(false);
  const generation = useRef(0),
    list = useRef<FlatList<Product>>(null);
  useEffect(() => {
    const g = ++generation.current,
      controller = new AbortController();
    // Start a new cancellable network request when search parameters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    setError("");
    const params: Record<string, string | number> = {
      q: query,
      page,
      limit: 12,
      sort,
      ...(image ? { image } : {}),
    };
    void (async () => {
      try {
        let r = await catalog<Results>(
          "supplier-search",
          params,
          controller.signal,
        );
        if (g !== generation.current) return;
        setItems((prev) =>
          page === 1
            ? r.products
            : [
                ...prev,
                ...r.products.filter((p) => !prev.some((v) => v.id === p.id)),
              ],
        );
        setMore(r.more);
        setStale(!!r.revalidate || !!r.stale);
        if (r.revalidate && !image) {
          r = await catalog<Results>(
            "supplier-search",
            { ...params, refresh: 1 },
            controller.signal,
          );
          if (g !== generation.current) return;
          setItems((prev) =>
            page === 1
              ? r.products
              : [
                  ...prev.filter((p) => !r.products.some((v) => v.id === p.id)),
                  ...r.products,
                ],
          );
          setMore(r.more);
          setStale(false);
        }
      } catch (e) {
        if (!controller.signal.aborted && g === generation.current)
          setError((e as Error).message);
      } finally {
        if (g === generation.current) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [query, page, sort, image, retry]);
  const search = (value: string) => {
    setPage(1);
    setImage("");
    setQuery(value.trim() || "storage box");
    setDraft(value);
    setItems([]);
    setRetry((x) => x + 1);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };
  async function photo(camera: boolean) {
    setUploading(true);
    setError("");
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      )
        throw Error("Камер ашиглах зөвшөөрөл шаардлагатай.");
      const result = await (
        camera
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync
      )({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0],
        resized = await manipulateAsync(
          asset.uri,
          [
            {
              resize:
                asset.width >= asset.height ? { width: 800 } : { height: 800 },
            },
          ],
          { compress: 0.8, format: SaveFormat.JPEG },
        );
      const form = new FormData();
      if (process.env.EXPO_OS === "web") {
        const blob = await (await fetch(resized.uri)).blob();
        form.append("image", blob, "search.jpg");
      } else
        form.append("image", {
          uri: resized.uri,
          type: "image/jpeg",
          name: "search.jpg",
        } as unknown as Blob);
      const r = await api<{ image: string }>("supplier-image-upload", form);
      setPage(1);
      setItems([]);
      setImage(r.image);
      setRetry((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <FlatList
      ref={list}
      key={columns}
      numColumns={columns}
      data={items}
      keyExtractor={(p) => p.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 10 }}
      columnWrapperStyle={{ gap: 10 }}
      style={{ backgroundColor: colors.bg }}
      ListHeaderComponent={
        <View style={{ gap: 14, marginBottom: 10 }}>
          <Card
            style={{ backgroundColor: colors.navy, borderColor: colors.navy }}
          >
            <Text style={{ color: "white", fontSize: 25, fontWeight: "800" }}>
              Сонголт нэг дор.
            </Text>
            <Text style={{ color: "#d6dff3", lineHeight: 22 }}>
              Бараагаа сонгоод, захиалгаа Эрээнээс Улаанбаатар хүртэл хянаарай.
            </Text>
          </Card>
          <Field
            label="Бараа хайх"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => search(draft)}
            returnKeyType="search"
            placeholder="Нэр эсвэл брэндээр хайх"
          />
          <Button
            title="Хайх"
            onPress={() => search(draft)}
            disabled={uploading}
          />
          {shipping?.image_search_enabled && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={uploading ? "Зураг уншиж байна…" : "Зургаар хайх"}
                  secondary
                  disabled={uploading}
                  onPress={() => void photo(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Камер"
                  secondary
                  disabled={uploading}
                  onPress={() => void photo(true)}
                />
              </View>
            </View>
          )}
          <Title>Дэлхийн брэндүүд</Title>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {brands.map((b) => (
              <Pressable
                accessibilityRole="button"
                key={b}
                onPress={() => search(b)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "white",
                  borderColor: colors.line,
                  borderWidth: 1,
                }}
              >
                <Text style={{ color: colors.navy, fontWeight: "600" }}>
                  {b}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {categories.map(([label, q]) => (
              <Button
                key={q}
                title={label}
                secondary={query !== q}
                onPress={() => search(q)}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              title="Санал болгох"
              secondary={sort !== "default"}
              onPress={() => {
                setPage(1);
                setSort("default");
                setItems([]);
                setRetry((x) => x + 1);
              }}
            />
            <Button
              title="Үнэ өсөхөөр"
              secondary={sort !== "price"}
              onPress={() => {
                setPage(1);
                setSort("price");
                setItems([]);
                setRetry((x) => x + 1);
              }}
            />
          </View>
          {!!image && (
            <Button
              title="Зурагт хайлтыг цэвэрлэх"
              secondary
              onPress={() => search("storage box")}
            />
          )}
          <Copy>
            Үнэ нь хүргэлтгүй лавлах дүн. Сонгосон хувилбар, хүргэлтийг төлөхөөс
            өмнө шалгана.
          </Copy>
          {stale && <Copy>Өмнөх мэдээллийг шинэчилж байна…</Copy>}
          <ErrorBox
            message={bootError}
            retry={() => void refresh().catch(() => {})}
          />
          <ErrorBox message={error} retry={() => setRetry((x) => x + 1)} />
        </View>
      }
      renderItem={({ item: p }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={p.name}
          onPress={() =>
            router.push({ pathname: "/product/[id]", params: { id: p.id } })
          }
          style={{
            flex: 1,
            maxWidth: `${100 / columns}%`,
            backgroundColor: "white",
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <Image
            source={p.image || undefined}
            contentFit="cover"
            style={{ width: "100%", aspectRatio: 1 }}
          />
          <View style={{ padding: 12, gap: 8 }}>
            <Text
              numberOfLines={2}
              style={{ lineHeight: 20, color: colors.ink, minHeight: 40 }}
            >
              {p.name}
            </Text>
            <Text
              style={{ fontWeight: "800", fontSize: 17, color: colors.navy }}
            >
              {p.mnt
                ? money(p.mnt)
                : p.approx_mnt
                  ? "≈ " + money(p.approx_mnt)
                  : "Үнэ шалгах"}
            </Text>
          </View>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={{ gap: 12, marginTop: 12 }}>
          {busy ? (
            <Busy />
          ) : more ? (
            <Button
              title="Дараагийн бараанууд"
              onPress={() => setPage((x) => x + 1)}
            />
          ) : !items.length && !error ? (
            <Copy>Бараа олдсонгүй. Өөр нэрээр хайгаарай.</Copy>
          ) : null}
          <Button
            title="Хүргэлт, үйлчилгээний тухай"
            secondary
            onPress={() => router.push("/help")}
          />
        </View>
      }
    />
  );
}
