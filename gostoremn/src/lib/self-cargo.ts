import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";

export type CargoAddress = { cargo_id: string; name: string; recipient: string; phone: string; address: string; label: string };
export type SelfCargoOrder = Order & {
  cargo_id?: string;
  warehouse: { label: string };
  warehouse_names?: { ulaanbaatar: string };
  inbound?: { numbers: { no: string; company: string }[] };
};
type SelfCargo = { delivery: CargoAddress; orders: SelfCargoOrder[] };

export function useSelfCargo(enabled = true) {
  const [data, setData] = useState<SelfCargo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<SelfCargo>("customer-self-cargo");
      if (current === generation.current) setData(result);
    } catch (e) {
      if (current === generation.current) {
        setData(null);
        setError((e as Error).message);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    void refresh();
    return () => { generation.current++; };
  }, [enabled, refresh]));
  return { data, error, loading, refresh };
}
