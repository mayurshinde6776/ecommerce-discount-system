import { randomUUID } from 'crypto';
import { Order, OrderStatus, CreateOrderInput } from './order.model';

/**
 * In-memory Order store backed by a Map<orderId, Order>.
 *
 * Also maintains a secondary index (userId → orderId[]) so that
 * per-user lookups are O(k) instead of O(n).
 */
export class OrderStore {
  private readonly orders = new Map<string, Order>();

  /** Secondary index: userId → set of orderIds */
  private readonly userIndex = new Map<string, Set<string>>();

  // ─── Write Operations ─────────────────────────────────────────────────────

  create(input: CreateOrderInput): Order {
    const now = new Date();
    const order: Order = {
      id: randomUUID(),
      userId: input.userId,
      items: input.items.map((i) => ({ ...i })), // shallow clone for snapshot integrity
      subtotal: input.subtotal,
      discount: input.discount,
      total: input.total,
      ...(input.discountCode && { discountCode: input.discountCode }),
      status: OrderStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(order.id, order);

    // Update secondary index
    if (!this.userIndex.has(order.userId)) {
      this.userIndex.set(order.userId, new Set());
    }
    this.userIndex.get(order.userId)!.add(order.id);

    return order;
  }

  updateStatus(orderId: string, status: OrderStatus): Order | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.status = status;
    order.updatedAt = new Date();
    return order;
  }

  // ─── Read Operations ──────────────────────────────────────────────────────

  findById(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  findByUserId(userId: string): Order[] {
    const ids = this.userIndex.get(userId);
    if (!ids) return [];
    return [...ids].map((id) => this.orders.get(id)!).filter(Boolean);
  }

  findByStatus(status: OrderStatus): Order[] {
    return [...this.orders.values()].filter((o) => o.status === status);
  }

  getAll(): Order[] {
    return [...this.orders.values()];
  }

  get size(): number {
    return this.orders.size;
  }
}

/** Singleton store instance */
export const orderStore = new OrderStore();
