import { useLocalSearchParams } from "expo-router";
import { ProductReviews } from "@/components/product-reviews";
import { ErrorBox, Page } from "@/components/ui";
export default function ReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!/^[a-z0-9-]{1,60}$/.test(id || "")) return <Page><ErrorBox message="Барааны код буруу байна." /></Page>;
  return <ProductReviews key={id} productId={id} full />;
}
