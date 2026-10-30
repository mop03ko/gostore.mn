import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { validCart } from "./cart";
import type { CartLine, Customer, Shipping } from "./types";
type Boot = { customer: Customer | null; shipping: Shipping; qpay: boolean };
type Store = {
  customer: Customer | null;
  shipping: Shipping | null;
  qpay: boolean;
  ready: boolean;
  error: string;
  cart: CartLine[];
  cartReady: boolean;
  saveCart: (v: CartLine[]) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [cart, setCart] = useState<CartLine[]>([]),
    [loadedKey, setLoadedKey] = useState("");
  const owner = boot?.customer?.id || "guest",
    cartKey = "gostore-cart-" + owner,
    writes = useRef(Promise.resolve()),
    activeKey = useRef(cartKey);
  useEffect(() => {
    activeKey.current = cartKey;
  }, [cartKey]);
  const refresh = useCallback(async () => {
    try {
      const next = await api<Boot>("catalog");
      setBoot(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setReady(true);
    }
  }, []);
  // Initial asynchronous server hydration; no state is derived from another render here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(cartKey)
      .then((raw) => {
        if (active) {
          setCart(validCart(raw ? JSON.parse(raw) : []));
          setLoadedKey(cartKey);
        }
      })
      .catch(() => {
        if (active) {
          setCart([]);
          setLoadedKey(cartKey);
        }
      });
    return () => {
      active = false;
    };
  }, [cartKey]);
  const saveCart = useCallback(
    async (next: CartLine[]) => {
      const safe = validCart(next),
        key = cartKey;
      const pending = writes.current
        .catch(() => {})
        .then(() => AsyncStorage.setItem(key, JSON.stringify(safe)));
      writes.current = pending;
      await pending;
      if (activeKey.current === key) setCart(safe);
    },
    [cartKey],
  );
  const logout = useCallback(async () => {
    await api("customer-logout", {});
    setLoadedKey("");
    setCart([]);
    await refresh();
  }, [refresh]);
  return (
    <Context
      value={{
        customer: boot?.customer || null,
        shipping: boot?.shipping || null,
        qpay: boot?.qpay || false,
        ready,
        error,
        cart: loadedKey === cartKey ? cart : [],
        cartReady: loadedKey === cartKey,
        saveCart,
        refresh,
        logout,
      }}
    >
      {children}
    </Context>
  );
}
export function useStore() {
  const store = use(Context);
  if (!store) throw Error("Store unavailable");
  return store;
}
