import { usePalette } from "@/lib/palette";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  TextInput,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconButton, BrandLogo } from "@/components/shop-ui";
import { HomeDiscovery, DiscoveryCard } from "@/components/discovery";
import { catalog } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button, Busy, Copy, ErrorBox } from "@/components/ui";
type Results = {
  products: Product[];
  more: boolean;
  revalidate?: boolean;
  stale?: boolean;
};
function Shop({ initialQuery, initialImage = "" }: { initialQuery: string; initialImage?: string }) {
  const colors = usePalette();
  const inset = useSafeAreaInsets();
  const [searchMode, setSearchMode] = useState(!!initialQuery || !!initialImage);
  const nextPageLock = useRef(false);
  const { shipping, error: bootError, refresh } = useStore(),
    { width } = useWindowDimensions(),
    columns = width >= 800 ? 4 : 2;
  const [draft, setDraft] = useState(initialQuery),
    [query, setQuery] = useState(initialQuery || "__all__"),
    [sort, setSort] = useState("default"),
    [image, setImage] = useState(initialImage),
    [page, setPage] = useState(1),
    [items, setItems] = useState<Product[]>([]),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [retry, setRetry] = useState(0);
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
    setQuery(value.trim() || "__all__");
    setDraft(value);
    setItems([]);
    setRetry((x) => x + 1);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };
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
          backgroundColor: colors.surface,
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
              name="help"
              label="Тусламж"
              onPress={() => router.push("/help")}
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
            placeholderTextColor={colors.muted}
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
              onPress={() => router.navigate("/search")}
            />
          )}
          {searchMode && <IconButton name="close" label="Нүүр хуудас руу буцах" onPress={() => search("")} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Хайх"
            onPress={() => search(draft)}
            style={{
              backgroundColor: colors.orange,
              borderRadius: 22,
              height: 38,
              paddingHorizontal: 17,
              justifyContent: "center",
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.onPrimary }}>Хайх</Text>
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
            </>}
            {searchMode && <View testID="brand-result-heading" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: colors.surface }}>
              <View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{image ? "Зургаар хайсан бараа" : query}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>Таалагдсан бараагаа сонгоорой</Text></View>
            </View>}
            {!searchMode && <Text accessibilityRole="header" style={{ fontSize: 21, fontWeight: "800", color: colors.navy, padding: 5 }}>Танд таалагдаж магадгүй</Text>}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.surface,
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
                      color: sort === value ? colors.accentText : colors.ink,
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
                onPress={() => search("")}
              />
            )}
            {stale && <Copy>Мэдээллийг шинэчилж байна…</Copy>}
            <ErrorBox
              message={bootError}
              retry={() => void refresh().catch(() => {})}
            />
            <ErrorBox message={error} retry={() => setRetry((x) => x + 1)} />
          </View>
        }
        renderItem={({ item: p }) => (
          <View style={{ flex: 1, maxWidth: columns === 4 ? "25%" : "50%" }}><DiscoveryCard product={p} /></View>
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
    </View>
  );
}
export default function ShopRoute() {
  const { q, image } = useLocalSearchParams<{ q?: string; image?: string }>();
  const query = typeof q === "string" ? q : "";
  const token = typeof image === "string" ? image : "";
  return <Shop key={query + token} initialQuery={query} initialImage={token} />;
}
