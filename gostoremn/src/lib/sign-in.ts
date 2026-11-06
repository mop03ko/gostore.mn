import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { validCart } from "@/lib/cart";
import type { Customer } from "@/lib/types";
export async function completeSignIn(customer: Customer, refresh: () => Promise<unknown>, next?: string) {
  const key="gostore-cart-"+customer.id;
  const guest=validCart(JSON.parse((await AsyncStorage.getItem("gostore-cart-guest"))||"[]"));
  const own=validCart(JSON.parse((await AsyncStorage.getItem(key))||"[]"));
  await AsyncStorage.setItem(key,JSON.stringify([...own,...guest.filter(g=>!own.some(i=>i.id===g.id&&i.sku===g.sku))].slice(0,30)));
  await AsyncStorage.removeItem("gostore-cart-guest");await refresh();
  const review=typeof next==="string"?next.match(/^\/reviews\/([a-z0-9-]{1,60})$/):null;
  if(review){router.replace({pathname:"/reviews/[id]",params:{id:review[1]}});return;}
  router.replace(next==="checkout"||next==="/checkout"?"/checkout":next==="/orders"?"/orders":next==="/addresses"?"/addresses":next==="/notifications"?"/notifications":"/account");
}