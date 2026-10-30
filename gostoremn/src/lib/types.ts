export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
};
export type Variant = {
  id: string;
  label: string;
  cny: number | null;
  stock: number | null;
  image?: string;
};
export type Product = {
  id: string;
  name: string;
  image: string;
  images?: string[];
  cny: number | null;
  mnt: number | null;
  approx_mnt?: number;
  sellable?: boolean;
  min_qty: number;
  step: number;
  variants: Variant[];
  vendor_id?: string;
  vendor_name?: string;
  shop_rating?: number | null;
  brand?: string;
  ship_from?: string;
  ships_48h?: boolean;
  description?: string;
  attributes?: { name: string; value: string }[];
};
export type CartLine = {
  id: string;
  sku: string;
  name: string;
  image: string;
  variant: string;
  qty: number;
  cny: number;
  min_qty: number;
  step: number;
  stock: number | null;
};
export type Shipping = {
  cny_rate: number;
  service_percent: number;
  service_fee_mnt: number;
  image_search_enabled: boolean;
  pickup?: { name: string; address: string; phone: string; hours: string };
};
export type Quote = {
  total: number;
  breakdown: Record<string, number>;
  goods_cny: number;
  domestic_cny: number;
  vendors: number;
  cny_rate: number;
  service_percent: number;
  service_fee_mnt: number;
  domestic_later: boolean;
  payment_window_hours: number;
};
export type PricedLine = CartLine & { unit_cny: number; goods_cny: number };
export type Invoice = {
  state: string;
  qr_image?: string;
  urls?: { name: string; description: string; link: string }[];
};
export type Order = {
  id: string;
  title: string;
  status: string;
  amount: number;
  paid: boolean;
  demo: boolean;
  created: string;
  payment_due?: string;
  items?: PricedLine[];
  invoice?: Invoice;
  history?: { status: string; at: string }[];
  fulfillment?: { method: string };
  pickup_warehouse?: Shipping["pickup"];
  cargo?: {
    measurement?: { weight_kg: number; volume_m3: number };
    pickup_code?: string;
    issue_count?: number;
    photos?: { id: string; warehouse_name: string }[];
    freight_invoice?: Invoice;
    billing?: {
      finalized: boolean;
      total: number;
      paid: number;
      due: number;
      refund_due?: number;
      breakdown: Record<string, number>;
    };
  };
};
export type Address = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  address: string;
  is_default: boolean;
};
export type Notice = {
  id: number;
  order_id: string;
  kind: string;
  message: string;
  created: string;
  read_at: string | null;
};
