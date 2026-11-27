import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import type { DimensionValue } from "react-native";

const flakes = [
  { left: "7%", top: "8%", size: 3, start: 0.03, drift: 11, fall: 96 },
  { left: "21%", top: "23%", size: 2, start: 0.12, drift: -7, fall: 108 },
  { left: "39%", top: "6%", size: 3, start: 0.08, drift: 12, fall: 120 },
  { left: "56%", top: "32%", size: 4, start: 0.04, drift: -9, fall: 87 },
  { left: "73%", top: "12%", size: 2, start: 0.16, drift: 9, fall: 113 },
  { left: "90%", top: "21%", size: 3, start: 0.06, drift: -12, fall: 103 },
] satisfies { left: DimensionValue; top: DimensionValue; size: number; start: number; drift: number; fall: number }[];

export function NewYearMotion({ active }: { active: boolean }) {
  const [allowsMotion, setAllowsMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const played = useRef(false);
  useEffect(() => {
    let mounted = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      changed = true;
      setAllowsMotion(!enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted && !changed) setAllowsMotion(!enabled);
    }).catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!active || !allowsMotion || played.current) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 7200,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    const frame = requestAnimationFrame(() => {
      played.current = true;
      animation.start();
    });
    return () => {
      cancelAnimationFrame(frame);
      animation.stop();
      if (played.current) progress.setValue(1);
    };
  }, [active, allowsMotion, progress]);

  if (!allowsMotion) return null;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      aria-hidden style={StyleSheet.absoluteFill} testID="home-new-year-motion">
      <View style={styles.snow}>
        {flakes.map(({ left, top, size, start, drift, fall }) => (
          <Animated.View key={left} testID="home-new-year-flake" style={[styles.flake, {
            left, top, width: size, height: size,
            opacity: progress.interpolate({ inputRange: [start, start + 0.12, 0.72, 1], outputRange: [0, 0.65, 0.65, 0], extrapolate: "clamp" }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [start, 1], outputRange: [0, drift], extrapolate: "clamp" }) },
              { translateY: progress.interpolate({ inputRange: [start, 1], outputRange: [0, fall], extrapolate: "clamp" }) },
            ],
          }]} />
        ))}
      </View>
      <View style={styles.ribbon}>
        <Animated.View testID="home-new-year-shine" style={[styles.glow, {
          opacity: progress.interpolate({ inputRange: [0.1, 0.17, 0.28], outputRange: [0, 0.45, 0], extrapolate: "clamp" }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0.1, 0.28], outputRange: [-22, 22], extrapolate: "clamp" }) },
            { rotate: "-12deg" },
          ],
        }]}>
          <View style={styles.glowCore} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  snow: { position: "absolute", top: 0, right: 0, bottom: 0, width: "48%", overflow: "hidden" },
  flake: { position: "absolute", borderRadius: 3, backgroundColor: "#fff6ee" },
  ribbon: { position: "absolute", top: "33%", right: "17%", width: "19%", height: 18, borderRadius: 9, overflow: "hidden" },
  glow: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#fff4d33b" },
  glowCore: { width: "42%", height: 7, borderRadius: 4, backgroundColor: "#fff4d387" },
});
