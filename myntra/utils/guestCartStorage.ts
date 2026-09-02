/**
 * guestCartStorage.ts
 * Local cart storage for anonymous (guest) users.
 * Uses the same cross-platform pattern as storage.ts and recentlyViewedStorage.ts.
 * On login, these items are merged into the server cart via POST /bag/merge.
 */

const CART_KEY = "guestCart";

export interface GuestCartItem {
  productId: string;
  size: string;
  color: string;
  quantity: number;
  priceAtAdd: number;
  // Canonical long-form names (stored in SecureStore/localStorage)
  productName: string;
  productBrand: string;
  productImage: string;
  // Short-form aliases (added for bag.tsx rendering compatibility)
  name?: string;
  brand?: string;
  image?: string;
  addedAt: string;
}

const isWeb = typeof window !== "undefined" && typeof localStorage !== "undefined";

const readRaw = async (): Promise<string | null> => {
  if (isWeb) return localStorage.getItem(CART_KEY);
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(CART_KEY);
};

const writeRaw = async (value: string): Promise<void> => {
  if (isWeb) {
    localStorage.setItem(CART_KEY, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(CART_KEY, value);
  }
};

const removeRaw = async (): Promise<void> => {
  if (isWeb) {
    localStorage.removeItem(CART_KEY);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(CART_KEY);
  }
};

/** Read entire guest cart */
export const getGuestCart = async (): Promise<GuestCartItem[]> => {
  try {
    const raw = await readRaw();
    if (!raw) return [];
    return JSON.parse(raw) as GuestCartItem[];
  } catch {
    return [];
  }
};

/**
 * Add or update an item in the guest cart.
 * Same productId + size + color = update quantity (never duplicate).
 */
export const addToGuestCart = async (item: GuestCartItem): Promise<void> => {
  try {
    let cart = await getGuestCart();
    const idx = cart.findIndex(
      (c) => c.productId === item.productId && c.size === item.size && c.color === item.color
    );
    if (idx !== -1) {
      cart[idx].quantity = Math.min(cart[idx].quantity + item.quantity, 10);
    } else {
      cart.push({ ...item, addedAt: new Date().toISOString() });
    }
    await writeRaw(JSON.stringify(cart));
  } catch (e) {
    console.log("addToGuestCart error:", e);
  }
};

/** Remove an item from the guest cart by productId + size + color */
export const removeFromGuestCart = async (
  productId: string,
  size: string,
  color: string
): Promise<void> => {
  try {
    let cart = await getGuestCart();
    cart = cart.filter(
      (c) => !(c.productId === productId && c.size === size && c.color === color)
    );
    await writeRaw(JSON.stringify(cart));
  } catch (e) {
    console.log("removeFromGuestCart error:", e);
  }
};

/** Update quantity for an item in the guest cart */
export const updateGuestCartQuantity = async (
  productId: string,
  size: string,
  color: string,
  quantity: number
): Promise<void> => {
  try {
    let cart = await getGuestCart();
    const idx = cart.findIndex(
      (c) => c.productId === productId && c.size === size && c.color === color
    );
    if (idx !== -1) {
      if (quantity < 1) {
        cart.splice(idx, 1); // remove if qty drops below 1
      } else {
        cart[idx].quantity = Math.min(quantity, 10);
      }
    }
    await writeRaw(JSON.stringify(cart));
  } catch (e) {
    console.log("updateGuestCartQuantity error:", e);
  }
};

/** Clear the entire guest cart (called after successful merge on login) */
export const clearGuestCart = async (): Promise<void> => {
  try {
    await removeRaw();
  } catch (e) {
    console.log("clearGuestCart error:", e);
  }
};
