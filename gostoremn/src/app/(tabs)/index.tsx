import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  TextInput,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconButton } from "@/components/shop-ui";
import { brands, departments } from "@/lib/departments";
import { api, catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button, Busy, Copy, ErrorBox, colors, money } from "@/components/ui";
type Results = {
  products: Product[];
  more: boolean;
  revalidate?: boolean;
  stale?: boolean;
};
function Shop({ initialQuery }: { initialQuery: string }) {
  const inset = useSafeAreaInsets();
  const [photoMenu, setPhotoMenu] = useState(false);
  const nextPageLock = useRef(false);
  const { shipping, error: bootError, refresh } = useStore(),
    { width } = useWindowDimensions(),
    columns = width >= 800 ? 4 : 2;
  const [draft, setDraft] = useState(initialQuery),
    [query, setQuery] = useState(initialQuery || "storage box"),
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
        if (g === generation.current) {
          setBusy(false);
          nextPageLock.current = false;
        }
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

  const nextPage = () => {
    if (!busy && more && !error && !nextPageLock.current) {
      nextPageLock.current = true;
      setPage((x) => x + 1);
    }
  };
  const orderBy = (value: string) => {
    setPage(1);
    setSort(value);
    setItems([]);
    setRetry((x) => x + 1);
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          backgroundColor: "white",
          paddingTop: inset.top,
          paddingHorizontal: 12,
          paddingBottom: 9,
          gap: 5,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 23,
              fontWeight: "900",
              color: colors.orange,
              fontStyle: "italic",
            }}
          >
            GOStore
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <Text style={{ fontSize: 17, fontWeight: "800" }}>
              Танд зориулсан
            </Text>
            <IconButton
              name="message"
              label="Захиалгын мэдэгдлүүд"
              onPress={() => router.push("/notifications")}
            />
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 2,
            borderColor: colors.orange,
            borderRadius: 25,
            paddingLeft: 12,
            paddingRight: 3,
            height: 48,
            gap: 7,
          }}
        >
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            accessibilityLabel="Бараа хайх"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => search(draft)}
            returnKeyType="search"
            placeholder="Нэр, брэндээр хайх"
            placeholderTextColor="#858585"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 15,
              color: colors.ink,
              height: 44,
            }}
          />
          {shipping?.image_search_enabled && (
            <IconButton
              name="camera"
              label="Зургаар хайх"
              onPress={() => setPhotoMenu(true)}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Хайх"
            disabled={uploading}
            onPress={() => search(draft)}
            style={{
              backgroundColor: colors.orange,
              borderRadius: 22,
              height: 38,
              paddingHorizontal: 17,
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.ink }}>Хайх</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        ref={list}
        key={columns}
        numColumns={columns}
        data={items}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 8, paddingBottom: 20, gap: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        onEndReached={nextPage}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 14,
                paddingVertical: 12,
                flexDirection: "row",
                flexWrap: "wrap",
                rowGap: 10,
              }}
            >
              {departments.map((d) => (
                <Pressable
                  accessibilityRole="button"
                  key={d.query}
                  accessibilityLabel={d.name}
                  onPress={() => search(d.query)}
                  style={{
                    width: "20%",
                    alignItems: "center",
                    gap: 5,
                    minHeight: 68,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 15,
                      backgroundColor: d.color,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{d.icon}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.ink }}>
                    {d.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Хүргэлтийн нөхцөл харах"
              onPress={() => router.push("/help")}
              style={{
                backgroundColor: "#fff0e6",
                borderRadius: 12,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="box" color="#c94100" size={20} />
              <Text
                style={{
                  fontSize: 12,
                  color: "#9c3500",
                  flex: 1,
                  fontWeight: "600",
                }}
              >
                Эрээн → Улаанбаатар · Захиалгаа нэг дор хяна
              </Text>
              <Icon name="chevron" color="#c94100" size={15} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                {
                  title: "Өдөр тутмын сонголт",
                  subtitle: "Гэрээ илүү тухтай",
                  q: "home storage",
                  emoji: "🛋️",
                  bg: "#ffefe8",
                },
                {
                  title: "Өөрийн хэв маяг",
                  subtitle: "Хувцас · Гутал · Цүнх",
                  q: "clothing",
                  emoji: "👟",
                  bg: "#fff6df",
                },
              ].map((p) => (
                <Pressable
                  accessibilityRole="button"
                  key={p.q}
                  onPress={() => search(p.q)}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    backgroundColor: p.bg,
                    padding: 12,
                    minHeight: 88,
                  }}
                >
                  <Text style={{ fontWeight: "800", fontSize: 14 }}>
                    {p.title}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 3,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: "#7b6257", flex: 1 }}>
                      {p.subtitle}
                    </Text>
                    <Text style={{ fontSize: 32 }}>{p.emoji}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 10,
                gap: 8,
              }}
            >
              <Text style={{ fontWeight: "700", fontSize: 13 }}>
                Дэлхийн брэндүүд
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 7 }}
              >
                {brands.map((b) => (
                  <Pressable
                    accessibilityRole="button"
                    key={b}
                    onPress={() => search(b)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 12,
                      justifyContent: "center",
                      borderRadius: 8,
                      backgroundColor: "#f7f7f7",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600" }}>{b}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "white",
                borderRadius: 10,
              }}
            >
              {[
                ["default", "Санал болгох"],
                ["price", "Үнэ ↑"],
                ["-price", "Үнэ ↓"],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === value }}
                  onPress={() => orderBy(value)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderBottomWidth: 2,
                    borderBottomColor:
                      sort === value ? colors.orange : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: sort === value ? "700" : "400",
                      color: sort === value ? "#c44000" : colors.ink,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!!image && (
              <Button
                title="Зурагт хайлтыг цэвэрлэх"
                secondary
                onPress={() => search("storage box")}
              />
            )}
            {uploading && <Busy />}
            {stale && <Copy>Мэдээллийг шинэчилж байна…</Copy>}
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
              maxWidth: columns === 4 ? "25%" : "50%",
              backgroundColor: "white",
              borderRadius: 11,
              overflow: "hidden",
            }}
          >
            <Image
              source={p.image || undefined}
              contentFit="cover"
              recyclingKey={p.id}
              transition={160}
              style={{ width: "100%", aspectRatio: 1 }}
            />
            <View style={{ padding: 9, gap: 5 }}>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: colors.ink,
                  minHeight: 36,
                }}
              >
                {p.name}
              </Text>
              <Text
                selectable
                style={{ fontWeight: "800", fontSize: 21, color: "#d84500" }}
              >
                {p.mnt
                  ? money(p.mnt)
                  : p.approx_mnt
                    ? "≈ " + money(p.approx_mnt)
                    : "Үнэ шалгах"}
              </Text>
              <Text style={{ fontSize: 10, color: colors.muted }}>
                Хүргэлт тусдаа · Хувилбар сонгох
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ paddingVertical: 12, gap: 8 }}>
            {busy ? (
              <Busy />
            ) : more ? (
              <Button title="Дараагийн бараанууд" onPress={nextPage} />
            ) : !items.length && !error ? (
              <Copy>Бараа олдсонгүй. Өөр нэрээр хайгаарай.</Copy>
            ) : null}
            <Text
              style={{ fontSize: 11, textAlign: "center", color: colors.muted }}
            >
              Эцсийн үнэ, хүргэлтийг захиалахын өмнө шалгана.
            </Text>
          </View>
        }
      />
      <Modal
        visible={photoMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoMenu(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000055",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Зурагт хайлтыг хаах"
            onPress={() => setPhotoMenu(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: "white",
              padding: 20,
              paddingBottom: Math.max(inset.bottom, 16) + 16,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 19, fontWeight: "700" }}>
              Зургаар хайх
            </Text>
            <Copy>Таалагдсан барааныхаа зургийг сонгоорой.</Copy>
            <Button
              title="Зургийн сангаас сонгох"
              onPress={() => {
                setPhotoMenu(false);
                void photo(false);
              }}
            />
            <Button
              title="Камер"
              secondary
              onPress={() => {
                setPhotoMenu(false);
                void photo(true);
              }}
            />
            <Button
              title="Хаах"
              secondary
              onPress={() => setPhotoMenu(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
export default function ShopRoute() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const query = typeof q === "string" ? q : "";
  return <Shop key={query} initialQuery={query} />;
}
