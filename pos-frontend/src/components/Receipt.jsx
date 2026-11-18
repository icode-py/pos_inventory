import React, { forwardRef } from "react";
import { lineQuantity, lineTotal, paymentLines } from "../utils/receiptText";
import { pointsEarned } from "../utils/loyalty";

const Receipt = forwardRef(({ sale, store }, ref) => {
  if (!sale) return null;

  // Safely extract values with proper fallbacks
  const total = parseFloat(sale.total_amount || sale.total || 0);
  const items = sale.items || [];
  const customer = sale.customer;
  
  // Points follow the store's own rule (Settings → Loyalty), the same one the server uses
  const used = parseInt(sale.points_redeemed) || 0;
  const loyaltyPointsEarned = sale.points_earned ?? pointsEarned(total, store);
  const currentCustomerPoints = customer ? parseInt(customer.loyalty_points) || 0 : 0;
  const totalPointsAfterSale = currentCustomerPoints - used + loyaltyPointsEarned;

  return (
    <div ref={ref} style={{
      width: '58mm',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.2',
      color: '#000',
      backgroundColor: '#fff',
    }}>
      <h2 style={{
        textAlign: 'center',
        margin: '5px 0',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        {store?.name || 'My Store'}
      </h2>
      <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '10px' }}>
        {store?.tagline || 'Point of Sale'}
      </p>
      {store?.phone && (
        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '10px' }}>
          Tel: {store.phone}
        </p>
      )}
      {store?.address && (
        <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '10px' }}>
          {store.address}
        </p>
      )}
      
      <hr style={{ border: '1px dashed #000', margin: '8px 0' }} />
      
      <p style={{ margin: '2px 0', fontSize: '10px' }}>
        <strong>Date:</strong> {sale.timestamp || new Date().toLocaleString()}
      </p>
      
      {/* Offline Indicator */}
      {sale.isOffline && (
        <p style={{ 
          margin: '2px 0', 
          color: '#ff6b00',
          fontWeight: 'bold',
          fontSize: '9px',
          textAlign: 'center'
        }}>
          ⚠️ OFFLINE SALE - PENDING SYNC
        </p>
      )}
      
      {/* Customer Info */}
      {customer && (
        <>
          <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ marginBottom: '6px', fontSize: '10px' }}>
            <div style={{ fontWeight: 'bold' }}>Customer:</div>
            <div>{customer.name || 'Unknown'}</div>
            <div>{customer.phone || 'No phone'}</div>
            <div>Points: {currentCustomerPoints}</div>
          </div>
        </>
      )}
      
      <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
      
      {/* Items */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontWeight: 'bold',
          borderBottom: '1px solid #000',
          paddingBottom: '2px',
          marginBottom: '4px',
          fontSize: '10px'
        }}>
          <span>ITEM</span>
          <span>AMOUNT</span>
        </div>
        
        {items.map((item, i) => {
          const productName = item.product?.name || 'Unknown Product';
          const itemTotal = lineTotal(item);
          
          return (
            <div key={i} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '3px',
              fontSize: '9px'
            }}>
              <span style={{ flex: 2 }}>
                {lineQuantity(item)}x {productName.length > 20 
                  ? productName.substring(0, 20) + '...' 
                  : productName}
              </span>
              <span style={{ flex: 1, textAlign: 'right' }}>
                ₦{itemTotal.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      
      <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
      
      {/* Totals */}
      <div style={{ fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <strong>Subtotal:</strong>
          <strong>₦{total.toFixed(2)}</strong>
        </div>
        {Number(sale.points_discount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Points discount:</span>
            <span>-₦{Number(sale.points_discount).toFixed(2)}</span>
          </div>
        )}
        {paymentLines(sale).map(([label, amount]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>{label}:</span>
            <span>₦{amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
      
      {/* Loyalty Points Earned */}
      {customer && (
        <>
          <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '9px' }}>
            <div style={{ fontWeight: 'bold' }}>LOYALTY POINTS</div>
            {used > 0 && <div>Used: -{used} (₦{Number(sale.points_discount || 0).toFixed(2)} off)</div>}
            <div>Earned: +{loyaltyPointsEarned}</div>
            <div>Total: {totalPointsAfterSale}</div>
          </div>
        </>
      )}
      
      {/* Offline Sale ID */}
      {sale.isOffline && sale.offline_id && (
        <>
          <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '8px', color: '#666' }}>
            <div>Offline ID: {sale.offline_id}</div>
            <div>Will sync when online</div>
          </div>
        </>
      )}
      
      <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
      <p style={{ textAlign: 'center', margin: '5px 0', fontSize: '10px', fontWeight: 'bold' }}>
        {store?.receipt_footer || 'Thank you for your business!'}
      </p>
      <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '8px', color: '#666' }}>
        Receipt #{sale.localReceiptId || sale.offline_id || 'ONLINE'}
      </p>
    </div>
  );
});

Receipt.displayName = "Receipt";
export default Receipt;