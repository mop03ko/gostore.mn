import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Print from "expo-print";
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";
import { bridge } from "./lib/bridge";
const policy = require("./lib/navigation.cjs");
const config = Constants.expoConfig?.extra;
const variant = config?.variant;
if (!["admin", "warehouse"].includes(variant))
  throw Error("Missing staff app variant");
const startUrl =
  variant === "admin"
    ? "https://gostore.mn/admin/"
    : "https://gostore.mn/warehouse/ulaanbaatar/";

function StaffApp() {
  const web = useRef<WebView<{}>>(null),
    lastUrl = useRef(startUrl),
    scanBusy = useRef(false),
    printing = useRef(false);
  const [authenticated, setAuthenticated] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [canBack, setCanBack] = useState(false),
    [scanner, setScanner] = useState(false),
    [privacy, setPrivacy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setPrivacy(state !== "active");
      if (state === "background") setScanner(false);
    });
    return () => subscription.remove();
  }, []);
  function navigate(page: string) {
    if (authenticated && variant === "admin")
      web.current?.injectJavaScript(
        `document.querySelector('button[data-page="${page}"]')?.click();true;`,
      );
  }
  function reload() {
    Alert.alert(
      "Хуудсыг шинэчлэх үү?",
      "Хадгалаагүй өөрчлөлт алдагдаж болно. Илгээсэн үйлдлийн үр дүнг эхлээд шалгаарай.",
      [
        { text: "Болих", style: "cancel" },
        {
          text: "Шинэчлэх",
          onPress: () => {
            setError(false);
            setLoading(true);
            web.current?.reload();
          },
        },
      ],
    );
  }
  async function openScanner() {
    if (!authenticated) return;
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      Alert.alert(
        "Камерын эрх шаардлагатай",
        "Тохиргооноос камерын эрхийг зөвшөөрнө үү.",
        [
          { text: "Болих", style: "cancel" },
          { text: "Тохиргоо", onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    scanBusy.current = false;
    setScanner(true);
  }
  function scanned(value: string) {
    if (scanBusy.current) return;
    scanBusy.current = true;
    const code = policy.scan(value);
    setScanner(false);
    if (!code) {
      Alert.alert(
        "GOStore код олдсонгүй",
        "GS- захиалгын эсвэл GB- багцын кодыг уншуулна уу.",
      );
      return;
    }
    if (!authenticated || !policy.panel(lastUrl.current, variant)) return;
    web.current?.injectJavaScript(
      `(()=>{const input=document.getElementById('scan-code');if(input){input.value=${JSON.stringify(code)};document.getElementById('scan-form')?.requestSubmit();}})();true;`,
    );
  }
  async function message(event: WebViewMessageEvent) {
    if (!policy.panel(event.nativeEvent.url, variant)) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "state" && typeof data.authenticated === "boolean") {
        setAuthenticated(data.authenticated);
        return;
      }
      if (
        data.type === "print" &&
        variant === "warehouse" &&
        authenticated &&
        !printing.current &&
        typeof data.html === "string" &&
        data.html.length < 2000000
      ) {
        printing.current = true;
        try {
          await Print.printAsync({ html: data.html });
        } catch {
          Alert.alert("Хэвлэх", "Хэвлэх үйлдэл дууссангүй. Дахин оролдоно уу.");
        } finally {
          printing.current = false;
        }
      }
    } catch {
      /* Ignore unknown web messages. */
    }
  }
  function allow(request: WebViewNavigation & { isTopFrame?: boolean }) {
    if (request.isTopFrame === false) return true;
    const url = request.url;
    if (url === "about:blank") return true;
    if (policy.panel(url, variant) || policy.photo(url, variant)) return true;
    if (request.navigationType === "click" && policy.external(url))
      void Linking.openURL(url).catch(() =>
        Alert.alert("Холбоос", "Холбоос нээх боломжгүй."),
      );
    return false;
  }
  const tabs =
    variant === "admin"
      ? [
          ["overview", "Хяналт"],
          ["orders", "Захиалга"],
          ["products", "Бараа"],
          ["warehouse", "Агуулах"],
        ]
      : [];
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.brand}>
          <Text style={s.title}>{config?.title}</Text>
          <Text style={s.subtitle}>{config?.subtitle}</Text>
        </View>
        <Pressable
          accessibilityLabel="Хуудсыг шинэчлэх"
          style={s.action}
          onPress={reload}
        >
          <Text style={s.actionText}>↻</Text>
        </Pressable>
      </View>
      <View style={s.body}>
        <WebView<{}>
          ref={web}
          source={{ uri: startUrl }}
          originWhitelist={["https://*", "about:*"]}
          onShouldStartLoadWithRequest={allow}
          onMessage={message}
          injectedJavaScript={bridge}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          cacheEnabled={false}
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="prompt"
          applicationNameForUserAgent={"GOStoreStaff/" + variant + "/1.0.0"}
          onNavigationStateChange={(state) => {
            lastUrl.current = state.url;
            setCanBack(state.canGoBack);
          }}
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          onHttpError={(e) => {
            if (policy.panel(e.nativeEvent.url, variant)) {
              setLoading(false);
              setError(true);
            }
          }}
          onContentProcessDidTerminate={() => {
            setAuthenticated(false);
            setError(true);
            setLoading(false);
          }}
          setSupportMultipleWindows={false}
          onOpenWindow={(e) => {
            if (policy.external(e.nativeEvent.targetUrl))
              void Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
          }}
          style={s.web}
        />
        {loading && (
          <View pointerEvents="none" style={s.loading}>
            <ActivityIndicator color="#FA641B" />
            <Text style={s.muted}>Ачаалж байна…</Text>
          </View>
        )}
        {error && (
          <View style={s.error}>
            <Text style={s.errorTitle}>Холболт тасарлаа</Text>
            <Text style={s.errorBody}>
              Интернэтээ шалгаад дахин холбоно уу. Өмнөх үйлдэл илгээгдсэн бол
              үр дүнг шалгаж байж давтана.
            </Text>
            <Pressable
              style={s.primary}
              onPress={() => {
                setError(false);
                web.current?.reload();
              }}
            >
              <Text style={s.primaryText}>Дахин холбогдох</Text>
            </Pressable>
          </View>
        )}
      </View>
      <View style={s.nav}>
        {tabs.map(([id, title]) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            disabled={!authenticated}
            style={[s.tab, !authenticated && s.disabled]}
            onPress={() => navigate(id)}
          >
            <Text style={s.tabText}>{title}</Text>
          </Pressable>
        ))}
        {variant === "warehouse" && (
          <>
            <Pressable
              accessibilityRole="button"
              style={[s.tab, !canBack && s.disabled]}
              disabled={!canBack}
              onPress={() => web.current?.goBack()}
            >
              <Text style={s.tabText}>← Буцах</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[s.scan, !authenticated && s.disabled]}
              disabled={!authenticated}
              onPress={() => void openScanner()}
            >
              <Text style={s.primaryText}>QR уншуулах</Text>
            </Pressable>
          </>
        )}
      </View>
      <Modal
        visible={scanner}
        animationType="slide"
        onRequestClose={() => setScanner(false)}
      >
        <SafeAreaView style={s.scanner}>
          <View style={s.scanHeader}>
            <Text style={s.scanTitle}>Захиалга эсвэл багцын QR</Text>
            <Pressable style={s.action} onPress={() => setScanner(false)}>
              <Text style={s.primaryText}>Хаах</Text>
            </Pressable>
          </View>
          {scanner && permission?.granted && (
            <CameraView
              style={s.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "code128", "code39"],
              }}
              onBarcodeScanned={(r) => scanned(r.data)}
            />
          )}
          <Text style={s.scanHint}>
            Код унших нь мэдээллийг нээнэ. Хүлээн авалт, илгээлтийг агуулахын
            хуудсанд батална.
          </Text>
        </SafeAreaView>
      </Modal>
      {privacy && (
        <View style={s.privacy}>
          <Text style={s.privacyTitle}>{config?.title}</Text>
          <Text style={s.muted}>Ажлын мэдээлэл хамгаалагдсан</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StaffApp />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecf2",
  },
  brand: { flex: 1 },
  title: { fontSize: 19, fontWeight: "800", color: "#262263" },
  subtitle: { fontSize: 12, color: "#68748a", marginTop: 3 },
  action: {
    minWidth: 46,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 29, color: "#262263" },
  body: { flex: 1 },
  web: { flex: 1 },
  loading: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  muted: { fontSize: 13, color: "#68748a" },
  error: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#f5f6fa",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  errorTitle: { fontSize: 23, fontWeight: "700", color: "#262263" },
  errorBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginVertical: 18,
    color: "#56627b",
  },
  primary: { padding: 16, backgroundColor: "#262263", borderRadius: 14 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  nav: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: "#e9ecf2",
  },
  tab: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#f3f5fa",
  },
  tabText: { fontSize: 13, fontWeight: "700", color: "#262263" },
  disabled: { opacity: 0.4 },
  scan: {
    flex: 2,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262263",
    borderRadius: 12,
  },
  scanner: { flex: 1, backgroundColor: "#17152f" },
  scanHeader: { padding: 14, flexDirection: "row", alignItems: "center" },
  scanTitle: { flex: 1, color: "#fff", fontSize: 18, fontWeight: "700" },
  camera: { flex: 1 },
  scanHint: { color: "#fff", padding: 22, fontSize: 15, lineHeight: 23 },
  privacy: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#f5f6fa",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  privacyTitle: {
    fontSize: 25,
    color: "#262263",
    fontWeight: "800",
    marginBottom: 10,
  },
});
