import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
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
import { Icon, IconButton, BrandLogo } from "@/components/shop-ui";
import { HomeDiscovery } from "@/components/discovery";
import { brands } from "@/lib/brands";
import { BrandMark, BrandShelf } from "@/components/brands";
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
function Shop({ initialQuery, initialPhoto = false }: { initialQuery: string; initialPhoto?: boolean }) {
  const inset = useSafeAreaInsets();
  const [photoMenu, setPhotoMenu] = useState(initialPhoto);
  const [searchMode, setSearchMode] = useState(!!initialQuery);
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
    setSearchMode(!!value.trim());
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
      setSearchMode(true);
      list.current?.scrollToOffset({ offset: 0, animated: true });
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
          <BrandLogo width={132} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", flexShrink: 1, color: colors.muted }}>
              {searchMode ? "Хайлтын үр дүн" : "Танд зориулсан"}
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
          {searchMode && <IconButton name="close" label="Нүүр хуудас руу буцах" onPress={() => search("")} />}
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
            {!searchMode && <>
            <HomeDiscovery onSearch={search} />
            <BrandShelf onSelect={search} />
            </>}
            {searchMode && <View testID="brand-result-heading" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "white" }}>
              {brands.filter(b => b.name.toLowerCase() === query.toLowerCase()).map(b => <BrandMark key={b.id} brand={b} size={38} />)}
              <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{image ? "Зургаар хайсан бараа" : query}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>Таалагдсан бараагаа сонгоорой</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Брэнд солих" onPress={() => router.push("/brands")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ fontSize: 12, color: "#b43f0a" }}>Брэндүүд ›</Text></Pressable>
            </View>}
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
  const { q, photo } = useLocalSearchParams<{ q?: string; photo?: string }>();
  const query = typeof q === "string" ? q : "";
  return <Shop key={query + (photo || "")} initialQuery={query} initialPhoto={photo === "1"} />;
}
