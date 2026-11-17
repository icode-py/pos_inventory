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
    const qty = parseInt(item.quantity) || 0;
    const price = parseFloat(item.product?.price || item.price_at_sale || 0);
    lines.push(`${qty} x ${item.product?.name || 'Item'}  ${naira(qty * price)}`);
  });

  lines.push('--------------------------');
  lines.push(`Total: ${naira(sale.total_amount || sale.total)}`);
  paymentLines(sale).forEach(([label, amount]) => lines.push(`${label}: ${naira(amount)}`));

  if (sale.customer) {
    const earned = Math.floor(parseFloat(sale.total_amount || sale.total || 0) / 100);
    const current = parseInt(sale.customer.loyalty_points) || 0;
    lines.push(`Loyalty points: +${earned} (total ${current + earned})`);
  }

  lines.push('--------------------------');
  lines.push(store?.receipt_footer || 'Thank you for your business!');
  return lines.join('\n');
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
