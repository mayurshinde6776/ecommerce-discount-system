import { Order } from '../order/order.model';
import { DiscountCode } from '../discount/discount.model';
import { CartItem } from '../cart/cart.model';

// ─── Request ──────────────────────────────────────────────────────────────────

export interface CheckoutRequest {
  userId: string;
  /** Optional discount code to apply at checkout */
  discountCode?: string;
}

// ─── Response ─────────────────────────────────────────────────────────────────

export interface OrderItemSummary extends CartItem {
  lineTotal: number;
}

export interface CheckoutResponse {
  order: {
    id: string;
    userId: string;
    status: string;
    items: OrderItemSummary[];
    itemCount: number;
    subtotal: number;
    discount: number;
    discountCode?: string;
    total: number;
    createdAt: Date;
  };
  /** Present when this order triggered the every-5th-order loyalty reward */
  loyaltyCoupon?: {
    code: string;
    percentage: number;
    message: string;
  };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

export const toCheckoutResponse = (
  order: Order,
  loyaltyCoupon?: DiscountCode,
): CheckoutResponse => {
  const items: OrderItemSummary[] = order.items.map((item) => ({
    ...item,
    lineTotal: parseFloat((item.price * item.quantity).toFixed(2)),
  }));

  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    order: {
      id: order.id,
      userId: order.userId,
      status: order.status,
      items,
      itemCount,
      subtotal: order.subtotal,
      discount: order.discount,
      ...(order.discountCode && { discountCode: order.discountCode }),
      total: order.total,
      createdAt: order.createdAt,
    },
    ...(loyaltyCoupon && {
      loyaltyCoupon: {
        code: loyaltyCoupon.code,
        percentage: loyaltyCoupon.percentage,
        message: `🎉 You earned a ${loyaltyCoupon.percentage}% loyalty coupon for your next order!`,
      },
    }),
  };
};
