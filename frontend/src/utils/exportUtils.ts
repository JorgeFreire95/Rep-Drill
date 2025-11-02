import type { Order, Payment } from '../types';

/**
 * Formatea una fecha a formato local
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CL', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Obtiene el nombre del estado en español
 */
const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    'PENDING': 'Pendiente',
    'CONFIRMED': 'Confirmada',
    'PROCESSING': 'En Proceso',
    'SHIPPED': 'Enviada',
    'DELIVERED': 'Entregada',
    'COMPLETED': 'Completada',
    'CANCELLED': 'Cancelada',
  };
  return statusLabels[status] || status;
};

/**
 * Exporta órdenes a CSV
 */
export const exportToCSV = (orders: Order[], filename: string = 'ordenes'): void => {
  // Definir encabezados
  const headers = ['Orden #', 'Cliente', 'Fecha', 'Total', 'Estado'];
  
  // Convertir datos a filas CSV
  const rows = orders.map(order => [
    `#${order.id}`,
    order.customer_name || `Cliente #${order.customer_id}`,
    formatDate(order.order_date),
    `$${Number(order.total).toLocaleString('es-CL')}`,
    getStatusLabel(order.status)
  ]);
  
  // Crear contenido CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Crear blob y descargar
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exporta órdenes a Excel (formato XLSX)
 */
export const exportToExcel = (orders: Order[], filename: string = 'ordenes'): void => {
  // Crear HTML para Excel
  const headers = ['Orden #', 'Cliente', 'Fecha', 'Total', 'Estado'];
  
  const rows = orders.map(order => [
    `#${order.id}`,
    order.customer_name || `Cliente #${order.customer_id}`,
    formatDate(order.order_date),
    `$${Number(order.total).toLocaleString('es-CL')}`,
    getStatusLabel(order.status)
  ]);
  
  // Crear tabla HTML
  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #4F46E5; color: white; padding: 10px; text-align: left; font-weight: bold; }
        td { border: 1px solid #ddd; padding: 8px; }
        tr:nth-child(even) { background-color: #f9fafb; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  // Crear blob y descargar
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exporta órdenes a PDF
 */
export const exportToPDF = (orders: Order[]): void => {
  // Crear contenido HTML para el PDF
  const headers = ['Orden #', 'Cliente', 'Fecha', 'Total', 'Estado'];
  
  const rows = orders.map(order => [
    `#${order.id}`,
    order.customer_name || `Cliente #${order.customer_id}`,
    formatDate(order.order_date),
    `$${Number(order.total).toLocaleString('es-CL')}`,
    getStatusLabel(order.status)
  ]);
  
  // Crear HTML para imprimir
  const printWindow = window.open('', '', 'height=600,width=800');
  
  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes para exportar a PDF');
    return;
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Órdenes de Venta - ${new Date().toLocaleDateString('es-CL')}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 20mm;
        }
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        h1 {
          color: #4F46E5;
          text-align: center;
          margin-bottom: 20px;
        }
        .info {
          text-align: center;
          color: #6B7280;
          margin-bottom: 30px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #4F46E5;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #4F46E5;
        }
        td {
          padding: 10px;
          border: 1px solid #E5E7EB;
        }
        tr:nth-child(even) {
          background-color: #F9FAFB;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #6B7280;
          font-size: 12px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>Órdenes de Venta</h1>
      <div class="info">
        <p>Fecha de exportación: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}</p>
        <p>Total de órdenes: ${orders.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Rep Drill - Sistema de Gestión de Ventas</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// ==================== FUNCIONES DE EXPORTACIÓN PARA PAGOS ====================

/**
 * Formatea una fecha sin conversión de zona horaria
 */
const formatPaymentDate = (dateString: string): string => {
  const datePart = dateString.split('T')[0]; // "2025-10-19"
  const [year, month, day] = datePart.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
};

/**
 * Exporta pagos a CSV
 */
export const exportPaymentsToCSV = (payments: Payment[], filename: string = 'pagos'): void => {
  // Definir encabezados
  const headers = ['ID', 'Orden #', 'Monto', 'Método', 'Fecha'];
  
  // Convertir datos a filas CSV
  const rows = payments.map(payment => [
    `#${payment.id}`,
    `Orden #${payment.order}`,
    `$${parseFloat(payment.amount.toString()).toFixed(2)}`,
    payment.payment_method,
    formatPaymentDate(payment.payment_date)
  ]);
  
  // Crear contenido CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Crear blob y descargar
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exporta pagos a Excel (formato XLSX)
 */
export const exportPaymentsToExcel = (payments: Payment[], filename: string = 'pagos'): void => {
  // Crear HTML para Excel
  const headers = ['ID', 'Orden #', 'Monto', 'Método', 'Fecha'];
  
  const rows = payments.map(payment => [
    `#${payment.id}`,
    `Orden #${payment.order}`,
    `$${parseFloat(payment.amount.toString()).toFixed(2)}`,
    payment.payment_method,
    formatPaymentDate(payment.payment_date)
  ]);
  
  // Crear tabla HTML
  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #4F46E5; color: white; padding: 10px; text-align: left; font-weight: bold; }
        td { border: 1px solid #ddd; padding: 8px; }
        tr:nth-child(even) { background-color: #f9fafb; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  
  // Crear blob y descargar
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exporta pagos a PDF
 */
export const exportPaymentsToPDF = (payments: Payment[]): void => {
  // Crear contenido HTML para el PDF
  const headers = ['ID', 'Orden #', 'Monto', 'Método', 'Fecha'];
  
  const rows = payments.map(payment => [
    `#${payment.id}`,
    `Orden #${payment.order}`,
    `$${parseFloat(payment.amount.toString()).toFixed(2)}`,
    payment.payment_method,
    formatPaymentDate(payment.payment_date)
  ]);
  
  // Calcular total
  const total = payments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
  
  // Crear HTML para imprimir
  const printWindow = window.open('', '', 'height=600,width=800');
  
  if (!printWindow) {
    alert('Por favor, permite las ventanas emergentes para exportar a PDF');
    return;
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reporte de Pagos</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
        }
        h1 {
          color: #4F46E5;
          border-bottom: 2px solid #4F46E5;
          padding-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #4F46E5;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: bold;
        }
        td {
          border: 1px solid #ddd;
          padding: 10px;
        }
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .summary {
          margin-top: 20px;
          font-size: 16px;
          font-weight: bold;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <h1>Reporte de Pagos</h1>
      <p>Fecha de generación: ${new Date().toLocaleDateString('es-CL')}</p>
      
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="summary">
        <p>Total de pagos: ${payments.length}</p>
        <p>Monto total: $${total.toFixed(2)}</p>
      </div>
      
      <div class="footer">
        <p>Sistema de Gestión - Generado automáticamente</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
