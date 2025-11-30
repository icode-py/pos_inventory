import React, { forwardRef } from "react";

const Receipt = forwardRef(({ sale }, ref) => {
  if (!sale) return null;

  // Safely extract values with proper fallbacks
  const total = parseFloat(sale.total_amount || sale.total || 0);
  const paidAmount = parseFloat(sale.paid_amount || sale.paidAmount || 0);
  const changeAmount = parseFloat(sale.change_given || sale.changeAmount || 0);
  const items = sale.items || [];
  const customer = sale.customer;
  
  // Calculate loyalty points (1 point per ₦100 spent)
  const loyaltyPointsEarned = Math.floor(total / 100);
  const currentCustomerPoints = customer ? parseInt(customer.loyalty_points) || 0 : 0;
  const totalPointsAfterSale = currentCustomerPoints + loyaltyPointsEarned;

  return (
    <div ref={ref} style={{
      width: '58mm',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.2'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        margin: '5px 0', 
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        HOLO SUPERMARKET
      </h2>
      <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '10px' }}>
        Modern Point of Sale
      </p>
      
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
          const quantity = parseInt(item.quantity) || 0;
          const price = parseFloat(item.product?.price || item.price_at_sale || 0);
          const itemTotal = quantity * price;
          
          return (
            <div key={i} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '3px',
              fontSize: '9px'
            }}>
              <span style={{ flex: 2 }}>
                {quantity}x {productName.length > 20 
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
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Paid:</span>
          <span>₦{paidAmount.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Change:</span>
          <span>₦{changeAmount.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Loyalty Points Earned */}
      {customer && (
        <>
          <hr style={{ border: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '9px' }}>
            <div style={{ fontWeight: 'bold' }}>LOYALTY POINTS</div>
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
        Thank you for your business!
      </p>
      <p style={{ textAlign: 'center', margin: '2px 0', fontSize: '8px', color: '#666' }}>
        Receipt #{sale.localReceiptId || sale.offline_id || 'ONLINE'}
      </p>
    </div>
  );
});

Receipt.displayName = "Receipt";
export default Receipt;