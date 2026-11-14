import { useWarehousePreference } from "@/components/warehouse-preference";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { catalog, siteOrigin } from "@/lib/api";
import { usePalette } from "@/lib/palette";
import { Button } from "@/components/ui";

// Promotional popup set on the admin «Мэдэгдэл илгээх» page: shown when the app opens on the home
// screen, at most once a day on this device for each popup (the website home page does the same).
type Promo = { id: string; title: string; text: string; image: string; button: string; link: string };
const seenKey = "gostore-promo-seen-v1";
let checked = false;
const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
};

// Site links open the matching app screen; anything else opens in the browser.
export function openPromoLink(link: string) {
  if (/^https:\/\//.test(link)) {
    void Linking.openURL(link);
    return;
  }
  if (!/^\/(?!\/)/.test(link)) return;
  const product = /^\/v\/((?:tb-)?\d{5,20})\/?(?:[?#].*)?$/.exec(link);
  const brand = /^\/brands?\/([a-z0-9-]{1,40})\/?$/.exec(link);
  const search = /^\/(?:search)?\?(?:.*&)?q=([^&#]*)/.exec(link);
  if (product) router.push({ pathname: "/product/[id]", params: { id: product[1] } });
  else if (brand) router.push({ pathname: "/brand/[id]", params: { id: brand[1] } });
  else if (/^\/official-stores\/?$/.test(link)) router.push("/official-stores");
  else if (/^\/cart\/?$/.test(link)) router.navigate("/cart");
  else if (/^\/help\/?$/.test(link)) router.push("/help");
  else if (search) {
    let q = search[1];
    try {
      q = decodeURIComponent(q.replace(/\+/g, " "));
    } catch {}
    router.navigate({ pathname: "/", params: { q } });
  } else void Linking.openURL(siteOrigin + link);
}

export function PromoPopup() {
  const { blocksPromo } = useWarehousePreference();
  const colors = usePalette();
  const [promo, setPromo] = useState<Promo | null>(null);
  const [ratio, setRatio] = useState(4 / 5);
  useEffect(() => {
    if (checked || blocksPromo) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const { popup } = await catalog<{ popup: Promo | null }>("promo-popup", {});
        if (!live) return;
        checked = true;
        if (!popup) return;
        const mark = popup.id + ":" + today();
        if ((await AsyncStorage.getItem(seenKey)) === mark) return;
        await AsyncStorage.setItem(seenKey, mark);
        if (live) setPromo(popup);
      } catch {}
    }, 1200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [blocksPromo]);
  if (!promo || blocksPromo) return null;
  const close = () => setPromo(null);
  const open = () => {
    const link = promo.link;
    close();
    if (link) openPromoLink(link);
  };
  const image = promo.image ? (/^https:\/\//.test(promo.image) ? promo.image : siteOrigin + promo.image) : "";
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Хаах" />
        <View
          style={[styles.card, { backgroundColor: colors.surface }]}
          accessibilityViewIsModal
          testID="promo-popup"
        >
          {image ? (
            <Pressable onPress={open} disabled={!promo.link} accessibilityRole={promo.link ? "link" : "image"} accessibilityLabel={promo.title || "Урамшуулал"}>
              <Image
                source={image}
                style={[styles.image, { aspectRatio: ratio }]}
                contentFit="cover"
                onLoad={(e) => {
                  const { width, height } = e.source;
                  if (width && height) setRatio(Math.min(2, Math.max(0.5, width / height)));
                }}
              />
            </Pressable>
          ) : null}
          {promo.title || promo.text || promo.link ? (
            <View style={[styles.copy, !image && { paddingTop: 56 }]}>
              {promo.title ? (
                <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
                  {promo.title}
                </Text>
              ) : null}
              {promo.text ? <Text style={[styles.text, { color: colors.muted }]}>{promo.text}</Text> : null}
              {promo.link ? <Button title={promo.button || "Дэлгэрэнгүй"} onPress={open} testID="promo-popup-open" /> : null}
            </View>
          ) : null}
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Хаах"
            hitSlop={8}
            style={styles.close}
            testID="promo-popup-close"
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,29,59,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 400, maxHeight: "86%", borderRadius: 20, overflow: "hidden" },
  image: { width: "100%", maxHeight: 460 },
  copy: { padding: 20, gap: 10 },
  title: { fontSize: 21, fontWeight: "700", lineHeight: 27 },
  text: { fontSize: 15, lineHeight: 22 },
  close: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15,29,59,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 26, lineHeight: 28 },
});
