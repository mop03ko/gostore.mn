import type { Order } from "./types";
export const orderFilters = [
  { key: "all", label: "Бүгд" },
  { key: "unpaid", label: "Төлбөр хүлээж буй" },
  { key: "active", label: "Явцад байгаа" },
  { key: "completed", label: "Дууссан" },
  { key: "cancelled", label: "Цуцлагдсан" },
] as const;
export type OrderFilter = typeof orderFilters[number]["key"];
export function matchesOrderFilter(order: Order, filter: OrderFilter) {
  if (filter === "all") return true;
  if (filter === "completed" || filter === "cancelled") return order.status === filter;
  if (["completed", "cancelled"].includes(order.status)) return false;
  return filter === "unpaid" ? !order.paid : order.paid;
}
export const statusName = (s: string) =>
  ({
    new: "Шинэ",
    reviewing: "Шалгаж байна",
    quoted: "Төлбөр хүлээж байна",
    confirmed: "Баталгаажсан",
    shipping: "Хятадад тээвэрлэж байна",
    erenhot: "Эрээнд ирсэн",
    erenhot_ready: "Эрээнээс гарахад бэлэн",
    erenhot_dispatched: "Эрээнээс гарсан",
    zamyn_uud: "Замын-Үүдэд ирсэн",
    ulaanbaatar: "Улаанбаатарт ирсэн",
    ulaanbaatar_unsorted: "Агуулахад ангилж байна",
    ready_pickup: "Ирж авахад бэлэн",
    ready_delivery: "Хүргэлтэд бэлэн",
    out_for_delivery: "Хүргэлтэд гарсан",
    completed: "Дууссан",
    cancelled: "Цуцлагдсан",
  })[s] || s;
export const partName = (s: string) =>
  ({
    goods_mnt: "Барааны үнэ",
    domestic_mnt: "Хятад доторх хүргэлт",
    service_mnt: "Үйлчилгээний төлбөр",
    cargo_mnt: "Карго тээвэр",
    delivery_mnt: "Улаанбаатар хүргэлт",
    discount_mnt: "Хөнгөлөлт",
    insurance_mnt: "Даатгал",
    other_mnt: "Бусад",
  })[s] || s;
export const dateText = (v: string) =>
  new Date(v).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
