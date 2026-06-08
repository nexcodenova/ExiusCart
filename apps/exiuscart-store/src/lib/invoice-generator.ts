import jsPDF from 'jspdf';

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

interface InvoiceData {
  orderNumber: string;
  date: Date;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  shop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    vatNumber: string;
    tradeLicense: string;
  };
}

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header Background
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Shop Name (White on Blue)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.shop.name, margin, 25);

  // Invoice Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('TAX INVOICE', pageWidth - margin, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`#${data.orderNumber}`, pageWidth - margin, 28, { align: 'right' });
  doc.text(formatDate(data.date), pageWidth - margin, 36, { align: 'right' });

  y = 55;

  // Shop Details & Customer Details (Two Columns)
  doc.setTextColor(...textColor);
  doc.setFontSize(10);

  // Left Column - Shop Details
  doc.setFont('helvetica', 'bold');
  doc.text('From:', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.setTextColor(...mutedColor);
  doc.text(data.shop.address, margin, y);
  y += 5;
  doc.text(`Phone: ${data.shop.phone}`, margin, y);
  y += 5;
  doc.text(`Email: ${data.shop.email}`, margin, y);
  y += 5;
  doc.text(`TRN: ${data.shop.vatNumber}`, margin, y);
  y += 5;
  doc.text(`License: ${data.shop.tradeLicense}`, margin, y);

  // Right Column - Customer Details
  const rightColX = pageWidth / 2 + 10;
  let yRight = 55;
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', rightColX, yRight);
  doc.setFont('helvetica', 'normal');
  yRight += 6;
  doc.setTextColor(...mutedColor);
  if (data.customer?.name) {
    doc.text(data.customer.name, rightColX, yRight);
    yRight += 5;
  }
  if (data.customer?.phone) {
    doc.text(`Phone: ${data.customer.phone}`, rightColX, yRight);
    yRight += 5;
  }
  if (!data.customer?.name && !data.customer?.phone) {
    doc.text('Walk-in Customer', rightColX, yRight);
  }

  y = Math.max(y, yRight) + 15;

  // Items Table Header
  doc.setFillColor(249, 250, 251);
  doc.rect(margin, y, contentWidth, 10, 'F');

  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  const colWidths = {
    item: contentWidth * 0.45,
    qty: contentWidth * 0.12,
    price: contentWidth * 0.2,
    total: contentWidth * 0.23,
  };

  doc.text('Item', margin + 3, y + 7);
  doc.text('Qty', margin + colWidths.item + 3, y + 7);
  doc.text('Unit Price', margin + colWidths.item + colWidths.qty + 3, y + 7);
  doc.text('Total', margin + colWidths.item + colWidths.qty + colWidths.price + 3, y + 7);

  y += 12;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);

  data.items.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;

    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(249, 250, 251);
    }
    doc.rect(margin, y - 4, contentWidth, 10, 'F');

    // Item name (truncate if too long)
    const itemName = item.name.length > 35 ? item.name.substring(0, 35) + '...' : item.name;
    doc.text(itemName, margin + 3, y + 2);
    doc.text(item.quantity.toString(), margin + colWidths.item + 3, y + 2);
    doc.text(`${item.price.toFixed(2)} AED`, margin + colWidths.item + colWidths.qty + 3, y + 2);
    doc.text(`${itemTotal.toFixed(2)} AED`, margin + colWidths.item + colWidths.qty + colWidths.price + 3, y + 2);

    y += 10;
  });

  y += 5;

  // Separator Line
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;

  // Summary Section (Right Aligned)
  const summaryX = pageWidth - margin - 80;
  const valueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', summaryX, y);
  doc.setTextColor(...textColor);
  doc.text(`${data.subtotal.toFixed(2)} AED`, valueX, y, { align: 'right' });

  if (data.discount > 0) {
    y += 7;
    doc.setTextColor(...mutedColor);
    doc.text('Discount:', summaryX, y);
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`-${data.discount.toFixed(2)} AED`, valueX, y, { align: 'right' });
  }

  y += 7;
  doc.setTextColor(...mutedColor);
  doc.text('VAT (5%):', summaryX, y);
  doc.setTextColor(...textColor);
  doc.text(`${data.vat.toFixed(2)} AED`, valueX, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.line(summaryX - 10, y, pageWidth - margin, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('Total:', summaryX, y);
  doc.text(`${data.total.toFixed(2)} AED`, valueX, y, { align: 'right' });

  y += 15;

  // Payment Method
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(summaryX - 10, y - 5, 90, 15, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text(`Payment Method: ${data.paymentMethod.toUpperCase()}`, summaryX - 5, y + 4);

  // Footer
  const footerY = pageHeight - 30;

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);

  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
  doc.text('For any queries, please contact us at the details mentioned above.', pageWidth / 2, footerY + 5, { align: 'center' });

  // ExiusCart branding
  doc.setFontSize(8);
  doc.text('Powered by ExiusCart', pageWidth / 2, footerY + 12, { align: 'center' });

  // Save the PDF
  doc.save(`Invoice_${data.orderNumber}.pdf`);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate a thermal receipt (58mm/80mm)
export function generateThermalReceipt(data: InvoiceData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // 80mm width receipt
  });

  const pageWidth = 80;
  const margin = 5;
  let y = 10;

  // Shop Name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.shop.name, pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(data.shop.address, pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.text(`Tel: ${data.shop.phone}`, pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.text(`TRN: ${data.shop.vatNumber}`, pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setDrawColor(0);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Order #: ${data.orderNumber}`, margin, y);
  y += 4;
  doc.text(`Date: ${formatDate(data.date)}`, margin, y);

  if (data.customer?.name || data.customer?.phone) {
    y += 4;
    doc.text(`Customer: ${data.customer.name || ''} ${data.customer.phone || ''}`, margin, y);
  }

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  // Items
  data.items.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    const itemName = item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name;

    doc.text(itemName, margin, y);
    y += 4;
    doc.text(`  ${item.quantity} x ${item.price.toFixed(2)}`, margin, y);
    doc.text(`${itemTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  });

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Totals
  doc.text('Subtotal:', margin, y);
  doc.text(`${data.subtotal.toFixed(2)} AED`, pageWidth - margin, y, { align: 'right' });

  if (data.discount > 0) {
    y += 4;
    doc.text('Discount:', margin, y);
    doc.text(`-${data.discount.toFixed(2)} AED`, pageWidth - margin, y, { align: 'right' });
  }

  y += 4;
  doc.text('VAT (5%):', margin, y);
  doc.text(`${data.vat.toFixed(2)} AED`, pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', margin, y);
  doc.text(`${data.total.toFixed(2)} AED`, pageWidth - margin, y, { align: 'right' });

  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Paid by: ${data.paymentMethod.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.text('Thank you for shopping with us!', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(7);
  doc.text('Powered by ExiusCart', pageWidth / 2, y, { align: 'center' });

  doc.save(`Receipt_${data.orderNumber}.pdf`);
}

/**
 * Generate thermal receipt as HTML string.
 * Used by Electron desktop app for silent printing without PDF download.
 */
export function generateThermalReceiptHTML(data: InvoiceData): string {
  const rows = data.items
    .map((item) => {
      const name = item.name.length > 24 ? item.name.substring(0, 24) + '...' : item.name;
      return `
        <tr>
          <td colspan="2" class="item-name">${name}</td>
        </tr>
        <tr>
          <td class="item-qty">${item.quantity} x ${item.price.toFixed(2)} AED</td>
          <td class="item-total">${(item.price * item.quantity).toFixed(2)} AED</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="receipt-header">
      <div class="shop-name">${data.shop.name}</div>
      <div class="shop-detail">${data.shop.address}</div>
      <div class="shop-detail">Tel: ${data.shop.phone}</div>
      <div class="shop-detail">TRN: ${data.shop.vatNumber}</div>
    </div>
    <div class="divider">--------------------------------</div>
    <div class="section-title">TAX INVOICE</div>
    <table>
      <tr><td>Order #:</td><td class="text-right">${data.orderNumber}</td></tr>
      <tr><td>Date:</td><td class="text-right">${formatDate(data.date)}</td></tr>
      ${data.customer?.name ? `<tr><td>Customer:</td><td class="text-right">${data.customer.name}</td></tr>` : ''}
      ${data.customer?.phone ? `<tr><td>Phone:</td><td class="text-right">${data.customer.phone}</td></tr>` : ''}
    </table>
    <div class="divider">--------------------------------</div>
    <table>${rows}</table>
    <div class="divider">--------------------------------</div>
    <table>
      <tr><td>Subtotal:</td><td class="text-right">${data.subtotal.toFixed(2)} AED</td></tr>
      ${data.discount > 0 ? `<tr><td>Discount:</td><td class="text-right">-${data.discount.toFixed(2)} AED</td></tr>` : ''}
      <tr><td>VAT (5%):</td><td class="text-right">${data.vat.toFixed(2)} AED</td></tr>
    </table>
    <div class="divider">================================</div>
    <table>
      <tr class="total-row"><td>TOTAL:</td><td class="text-right">${data.total.toFixed(2)} AED</td></tr>
    </table>
    <div class="divider">================================</div>
    <div class="payment-method">Paid by: ${data.paymentMethod.toUpperCase()}</div>
    <div class="divider">--------------------------------</div>
    <div class="receipt-footer">
      <div>Thank you for shopping with us!</div>
      <div class="powered-by">Powered by ExiusCart</div>
    </div>
  `;
}
