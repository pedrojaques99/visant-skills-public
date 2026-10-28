import { redirect } from "next/navigation";
export async function redirectToCheckout() {
  const cart = { checkoutUrl: "https://shop.example.com/checkouts/1" };
  redirect(cart.checkoutUrl);
}
