import React, { forwardRef } from "react";

const Receipt = forwardRef(({ sale }, ref) => {
  return (
    <div ref={ref} style={{
      width: '58mm',
      padding: '10px',
      fontFamily: 'monospace',
      visibility: sale ? 'visible' : 'hidden'
    }}>
      {sale && (
        <>
          <h2 style={{ textAlign: 'center' }}>HOLO-SUPERMARKET</h2>
          <p>Date: {new Date().toLocaleString()}</p>
          <hr />
          
          {sale.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.quantity}x {item.product.name}</span>
              <span>₦{(parseFloat(item.product.price) * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>Total:</strong>
            <strong>₦{parseFloat(sale.total).toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Paid:</span>
            <span>₦{parseFloat(sale.paidAmount).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Change:</span>
            <span>₦{(parseFloat(sale.paidAmount) - parseFloat(sale.total)).toFixed(2)}</span>
          </div>
          <hr />
          <p style={{ textAlign: 'center' }}>Thank you!</p>
        </>
      )}
    </div>
  );
});

Receipt.displayName = "Receipt";
export default Receipt;
