/**
 * cartService.ts
 * All cart-related API calls in one place.
 * Reuses BASE_URL from config/api.ts.
 * Never contains UI logic — only data access.
 */

import axios from "axios";
import BASE_URL from "@/config/api";
import { GuestCartItem, clearGuestCart, getGuestCart } from "./guestCartStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartItem {
  _id: string;
  userId: string;
  productId: {
    _id: string;
    name: string;
    brand: string;
    price: number;
    discount?: string;
    images: string[];
    sizes: string[];
    stock?: number;
    maxPerOrder?: number;
    active?: boolean;
  };
  size: string;
  color: string;
  quantity: number;
  priceAtAdd: number;
  savedForLater: boolean;
  unavailable: boolean;
  unavailableReason?: string;
  createdAt: string;
}

export interface CartTotals {
  subtotal: number;
  shipping: number;
  grandTotal: number;
  itemCount: number;
  priceChanges: PriceChange[];
}

export interface PriceChange {
  itemId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  priceChanged: boolean;
}

export interface ValidateResult {
  canCheckout: boolean;
  totals: CartTotals;
  priceChanges: PriceChange[];
  warnings: StockWarning[];
  invalidItems: InvalidItem[];
}

export interface StockWarning {
  itemId: string;
  productName: string;
  requestedQty: number;
  availableStock: number;
  message: string;
}

export interface InvalidItem {
  itemId: string;
  productName: string;
  reason: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/** Fetch all cart items (cart + saved-for-later) for a user */
export const fetchCart = async (userId: string): Promise<CartItem[]> => {
  const res = await axios.get(`${BASE_URL}/bag/${userId}`);
  return res.data;
};

/** Add item to cart (handles duplicates via upsert on server) */
export const addToCart = async (
  userId: string,
  productId: string,
  size: string,
  color: string = "",
  quantity: number = 1
): Promise<CartItem> => {
  const res = await axios.post(`${BASE_URL}/bag`, {
    userId,
    productId,
    size,
    color,
    quantity,
  });
  return res.data;
};

/** Update quantity of a cart item */
export const updateCartQuantity = async (
  itemId: string,
  quantity: number
): Promise<CartItem> => {
  const res = await axios.patch(`${BASE_URL}/bag/${itemId}`, { quantity });
  return res.data;
};

/** Remove a single item from cart */
export const removeFromCart = async (itemId: string): Promise<void> => {
  await axios.delete(`${BASE_URL}/bag/${itemId}`);
};

/** Clear entire cart (in-cart items only) */
export const clearCart = async (userId: string): Promise<void> => {
  await axios.delete(`${BASE_URL}/bag/clear/${userId}`);
};

/** Fetch validated checkout summary from backend (single source of truth for checkout pricing) */
export interface CheckoutSummary {
  canCheckout: boolean;
  items: {
    _id: string;
    productId: string;
    name: string;
    brand: string;
    image: string;
    size: string;
    color: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  shipping: number;
  tax: number;
  taxRate: number;
  grandTotal: number;
  priceChanges: PriceChange[];
  warnings: StockWarning[];
  invalidItems: InvalidItem[];
}

export const fetchCheckoutSummary = async (userId: string): Promise<CheckoutSummary> => {
  const res = await axios.get(`${BASE_URL}/order/checkout-summary/${userId}`);
  return res.data;
};

/** Move cart item to Save for Later */
export const saveForLater = async (itemId: string): Promise<CartItem> => {
  const res = await axios.post(`${BASE_URL}/bag/save-for-later/${itemId}`);
  return res.data;
};

/** Move saved-for-later item back to cart */
export const moveToCart = async (itemId: string): Promise<CartItem> => {
  const res = await axios.post(`${BASE_URL}/bag/move-to-cart/${itemId}`);
  return res.data;
};

/** Merge guest cart items into logged-in user's cart. Clears local storage on success. */
export const mergeGuestCartAfterLogin = async (userId: string): Promise<void> => {
  try {
    const guestItems = await getGuestCart();
    if (guestItems.length === 0) return;

    const items = guestItems.map((item: GuestCartItem) => ({
      productId: item.productId,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    }));

    await axios.post(`${BASE_URL}/bag/merge`, { userId, items });
    await clearGuestCart();
  } catch (e) {
    console.log("mergeGuestCartAfterLogin error:", e);
    // Silent fail — don't block login
  }
};

/** Validate cart before checkout */
export const validateCart = async (userId: string): Promise<ValidateResult> => {
  const res = await axios.post(`${BASE_URL}/bag/validate`, { userId });
  return res.data;
};

/** Get cart totals */
export const fetchCartTotals = async (userId: string): Promise<CartTotals> => {
  const res = await axios.get(`${BASE_URL}/bag/totals/${userId}`);
  return res.data;
};
