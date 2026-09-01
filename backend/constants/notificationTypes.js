/**
 * Centralized notification category and event type constants.
 * All notification code must import from here — never use raw strings.
 */

const NOTIFICATION_CATEGORIES = {
  ORDER:     "ORDER",
  PAYMENT:   "PAYMENT",
  SHIPPING:  "SHIPPING",
  DELIVERY:  "DELIVERY",
  WISHLIST:  "WISHLIST",
  STOCK:     "STOCK",
  PROMOTION: "PROMOTION",
  CART:      "CART",
};

const NOTIFICATION_TYPES = {
  // ORDER
  ORDER_CONFIRMED:  "ORDER_CONFIRMED",
  ORDER_CANCELLED:  "ORDER_CANCELLED",
  ORDER_RETURNED:   "ORDER_RETURNED",

  // PAYMENT
  PAYMENT_SUCCESS:     "PAYMENT_SUCCESS",
  PAYMENT_SUCCESSFUL:  "PAYMENT_SUCCESS",  // alias used in PaymentRoutes
  PAYMENT_FAILED:      "PAYMENT_FAILED",
  REFUND_INITIATED:    "REFUND_INITIATED",
  REFUND_COMPLETED:    "REFUND_COMPLETED",

  // SHIPPING
  ORDER_PACKED:    "ORDER_PACKED",
  ORDER_SHIPPED:   "ORDER_SHIPPED",
  ORDER_IN_TRANSIT: "ORDER_IN_TRANSIT",

  // DELIVERY
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  ORDER_DELIVERED:  "ORDER_DELIVERED",
  DELIVERY_FAILED:  "DELIVERY_FAILED",

  // WISHLIST
  WISHLIST_PRICE_DROP: "WISHLIST_PRICE_DROP",

  // STOCK
  PRODUCT_BACK_IN_STOCK: "PRODUCT_BACK_IN_STOCK",
  VARIANT_BACK_IN_STOCK: "VARIANT_BACK_IN_STOCK",

  // PROMOTION
  PROMOTIONAL_CAMPAIGN: "PROMOTIONAL_CAMPAIGN",

  // CART / SCHEDULED
  CART_ABANDONED: "CART_ABANDONED",
};

// Maps each type to its preference field on NotificationPreference
const TYPE_TO_PREFERENCE = {
  ORDER_CONFIRMED:       "orderNotifications",
  ORDER_CANCELLED:       "orderNotifications",
  ORDER_RETURNED:        "orderNotifications",
  PAYMENT_SUCCESS:       "paymentNotifications",
  PAYMENT_SUCCESSFUL:    "paymentNotifications",
  PAYMENT_FAILED:        "paymentNotifications",
  REFUND_INITIATED:      "paymentNotifications",
  REFUND_COMPLETED:      "paymentNotifications",
  ORDER_PACKED:          "shippingNotifications",
  ORDER_SHIPPED:         "shippingNotifications",
  ORDER_IN_TRANSIT:      "shippingNotifications",
  OUT_FOR_DELIVERY:      "deliveryNotifications",
  ORDER_DELIVERED:       "deliveryNotifications",
  DELIVERY_FAILED:       "deliveryNotifications",
  WISHLIST_PRICE_DROP:   "wishlistNotifications",
  PRODUCT_BACK_IN_STOCK: "stockNotifications",
  VARIANT_BACK_IN_STOCK: "stockNotifications",
  PROMOTIONAL_CAMPAIGN:  "promotionNotifications",
  CART_ABANDONED:        "cartNotifications",
};

module.exports = { NOTIFICATION_CATEGORIES, NOTIFICATION_TYPES, TYPE_TO_PREFERENCE };
