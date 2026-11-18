// One place for the store's loyalty and stock rules, so the till, receipts, customers and
// settings always agree with the server.

export function loyaltyRules(store) {
  return {
    enabled: store?.loyalty_enabled !== false,
    amountPerPoint: Number(store?.loyalty_amount_per_point) || 100, // naira spent to earn 1 point
    pointValue: Number(store?.loyalty_point_value) || 1, // naira off for 1 point
    silver: Number(store?.loyalty_silver_points) || 500,
    gold: Number(store?.loyalty_gold_points) || 2000,
  };
}

export function pointsEarned(amountPaid, store) {
  const r = loyaltyRules(store);
  return r.enabled && r.amountPerPoint > 0 ? Math.floor(Number(amountPaid || 0) / r.amountPerPoint) : 0;
}

export function loyaltyTier(points, store) {
  const r = loyaltyRules(store);
  const p = Number(points || 0);
  if (p >= r.gold) return { label: "Gold", color: "#F5B700", next: null, progress: 100 };
  if (p >= r.silver) return { label: "Silver", color: "#8D99AE", next: { label: "Gold", needed: r.gold - p }, progress: ((p - r.silver) / (r.gold - r.silver)) * 100 };
  return { label: "Bronze", color: "#CD7F32", next: { label: "Silver", needed: r.silver - p }, progress: (p / r.silver) * 100 };
}

export const lowStockLevel = (store) => Number(store?.low_stock_threshold) || 10;
