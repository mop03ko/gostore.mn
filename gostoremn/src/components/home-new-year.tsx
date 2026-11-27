import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useIsFocused } from "expo-router";
import { NewYearMotion } from "./new-year-motion";

// The New Year artwork runs from November 28 through January 8 in Ulaanbaatar.
const start = Date.parse("2026-11-28T00:00:00+08:00");
const end = Date.parse("2027-01-09T00:00:00+08:00");

function visible() {
  const now = Date.now();
  return now >= start && now < end;
}

export function HomeNewYear({ visiblePage }: { visiblePage: boolean }) {
  const focused = useIsFocused();
  const [artReady, setArtReady] = useState(false);
  const [active, setActive] = useState(visible);
  useEffect(() => {
    const refresh = () => setActive(visible());
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  if (!active) return null;

  return (
    <View style={styles.banner} testID="home-new-year">
      <Image
        accessible={false}
        source={require("../../assets/images/new-year-gifts.webp")}
        contentFit="cover"
        contentPosition="right"
        onDisplay={() => setArtReady(true)}
        style={styles.art}
      />
      <NewYearMotion active={artReady && focused && visiblePage} />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Шинэ жилийн{"\n"}бэлгээ сонгоорой
        </Text>
        <Pressable
          accessibilityRole="link"
          testID="home-new-year-catalog"
          onPress={() => router.navigate("/(tabs)/categories")}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={styles.ctaLabel}>Бараа үзэх <Text aria-hidden>→</Text></Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "relative",
    justifyContent: "center",
    minHeight: 144,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#0a1731",
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  art: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "62%",
  },
  content: {
    alignItems: "flex-start",
    width: "64%",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 9,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  cta: {
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#ffad7d",
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  pressed: {
    backgroundColor: "#ffc8a8",
  },
  ctaLabel: {
    color: "#151c31",
    fontSize: 13,
    fontWeight: "800",
  },
});
