const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Plain-text receipt, suitable for WhatsApp / SMS / any share target. */
export function buildReceiptText(sale, store) {
  if (!sale) return '';
  const items = sale.items || [];
  const lines = [];

  lines.push(store?.name || 'Receipt');
  if (store?.tagline) lines.push(store.tagline);
  if (store?.phone) lines.push(`Tel: ${store.phone}`);
  if (store?.address) lines.push(store.address);
  lines.push('--------------------------');
  lines.push(`Date: ${sale.timestamp || new Date().toLocaleString()}`);
  if (sale.customer?.name) lines.push(`Customer: ${sale.customer.name}`);
  lines.push('--------------------------');

  items.forEach((item) => {
    lines.push(`${lineQuantity(item)} x ${item.product?.name || 'Item'}  ${naira(lineTotal(item))}`);
  });

  lines.push('--------------------------');
  if (Number(sale.points_discount) > 0) lines.push(`Points discount: -${naira(sale.points_discount)}`);
  lines.push(`Total: ${naira(sale.total_amount || sale.total)}`);
  paymentLines(sale).forEach(([label, amount]) => lines.push(`${label}: ${naira(amount)}`));

  if (sale.customer) {
    const earned = sale.points_earned ?? Math.floor(parseFloat(sale.total_amount || sale.total || 0) / 100);
    const used = parseInt(sale.points_redeemed) || 0;
    const current = parseInt(sale.customer.loyalty_points) || 0;
    lines.push(`Loyalty points: ${used ? `-${used} used, ` : ''}+${earned} earned (total ${current - used + earned})`);
  }

  lines.push('--------------------------');
  lines.push(store?.receipt_footer || 'Thank you for your business!');
  return lines.join('\n');
}

/** What a receipt line actually cost: the charged amount, not quantity x single price,
 * so carton prices and discounts show correctly. */
export function lineTotal(item) {
  const qty = parseInt(item.quantity) || 0;
  if (item.line_total != null) return Number(item.line_total);
  if (item.price_at_sale != null) return Math.round(qty * parseFloat(item.price_at_sale) * 100) / 100;
  return qty * (parseFloat(item.product?.price) || 0);
}

/** "2 ctn + 3" for carton products, otherwise the plain quantity. */
export function lineQuantity(item) {
  const qty = parseInt(item.quantity) || 0;
  const pack = item.product?.is_bulk_product && Number(item.product.bulk_quantity) > 1 ? Number(item.product.bulk_quantity) : 0;
  if (!pack || qty < pack) return String(qty);
  const cartons = Math.floor(qty / pack);
  const rest = qty % pack;
  return `${qty} (${cartons} ctn${rest ? ` + ${rest}` : ''})`;
}

/** Nigerian numbers: 0803... -> 234803...; numbers already in international form are kept. */
export function toWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return digits;
}

/** The payment part of a receipt as [label, amount] rows, by how the customer paid. */
export function paymentLines(sale) {
  const num = (v) => parseFloat(v) || 0;
  const paid = num(sale.paid_amount ?? sale.paidAmount);
  const change = num(sale.change_given ?? sale.changeAmount);
  const transfer = num(sale.transfer_amount);
  const card = num(sale.card_amount);
  switch (sale.payment_method) {
    case 'TRANSFER': return [['Paid by transfer', paid]];
    case 'POS': return [['Paid by POS card', paid]];
    case 'SPLIT': {
      const rows = [];
      if (transfer) rows.push(['Transfer', transfer]);
      if (card) rows.push(['POS card', card]);
      const cash = paid - transfer - card;
      if (cash) rows.push(['Cash', cash]);
      if (change) rows.push(['Change', change]);
      return rows;
    }
    default: return [['Paid (cash)', paid], ['Change', change]];
  }
}
