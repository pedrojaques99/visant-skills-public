// Checkout handoff: the submit only redirects to the provider's hosted checkout.
import { redirectToCheckout } from "./actions";
export function CartModal() {
  return (
    <form action={redirectToCheckout}>
      <p>Taxes calculated at checkout</p>
      <button type="submit">Proceed to Checkout</button>
    </form>
  );
}
