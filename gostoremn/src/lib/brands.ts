import logos from "./brand-logos.json";
export const brandGroups = [
  { id: "all", label: "Бүгд" },
  { id: "sport", label: "Спорт" },
  { id: "fashion", label: "Хувцас" },
  { id: "tech", label: "Технологи" },
  { id: "home", label: "Гэр, тоглоом" },
] as const;
export type BrandGroup = typeof brandGroups[number]["id"];
export type Brand = { id: keyof typeof logos; name: string; group: Exclude<BrandGroup, "all"> };
export const brands: Brand[] = [
  { id: "nike", name: "Nike", group: "sport" },
  { id: "adidas", name: "adidas", group: "sport" },
  { id: "puma", name: "Puma", group: "sport" },
  { id: "newbalance", name: "New Balance", group: "sport" },
  { id: "uniqlo", name: "UNIQLO", group: "fashion" },
  { id: "zara", name: "ZARA", group: "fashion" },
  { id: "hm", name: "H&M", group: "fashion" },
  { id: "thenorthface", name: "The North Face", group: "sport" },
  { id: "sony", name: "Sony", group: "tech" },
  { id: "xiaomi", name: "Xiaomi", group: "tech" },
  { id: "lego", name: "LEGO", group: "home" },
  { id: "ikea", name: "IKEA", group: "home" },
];
export { logos };
