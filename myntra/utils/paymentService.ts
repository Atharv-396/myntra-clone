/**
 * paymentService.ts
 * Cashfree Payment Gateway client API integration
 */

import axios from "axios";
import BASE_URL from "@/config/api";

export interface CashfreeOrderResponse {
  success: boolean;
  orderId: string;
  cfOrderId?: string;
  paymentSessionId: string;
  orderAmount: number;
  orderCurrency: string;
  environment: "SANDBOX" | "PRODUCTION";
  transactionId?: string;
  isSimulated?: boolean;
}

export interface VerifyPaymentPayload {
  orderId: string;
  userId: string;
  shippingAddress: string;
  paymentMethod?: string;
  paymentId?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  orderId: string;
  transactionId?: string;
  total: number;
  paymentStatus?: string;
}

export interface TransactionDetailsResponse {
  success: boolean;
  transactionId: string;
  orderId: any;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  createdAt: string;
}

/**
 * Step 1: Create Cashfree Order on Backend
 */
export const createCashfreePaymentOrder = async (
  userId: string,
  shippingAddress: string,
  customerPhone?: string
): Promise<CashfreeOrderResponse> => {
  const res = await axios.post(`${BASE_URL}/payment/cashfree/create-order`, {
    userId,
    shippingAddress,
    customerPhone,
  });
  return res.data;
};

/**
 * Step 2: Verify Cashfree Payment on Backend & Place Order
 */
export const verifyCashfreePayment = async (
  payload: VerifyPaymentPayload
): Promise<VerifyPaymentResponse> => {
  const res = await axios.post(`${BASE_URL}/payment/cashfree/verify`, payload);
  return res.data;
};

/**
 * Check Cashfree order status from PG
 */
export const getCashfreeOrderStatus = async (orderId: string) => {
  const res = await axios.get(`${BASE_URL}/payment/cashfree/status/${orderId}`);
  return res.data;
};

/**
 * Lookup Transaction details by Transaction ID or Order ID
 */
export const getTransactionDetails = async (
  transactionId: string
): Promise<TransactionDetailsResponse> => {
  const res = await axios.get(`${BASE_URL}/payment/transaction/${transactionId}`);
  return res.data;
};
