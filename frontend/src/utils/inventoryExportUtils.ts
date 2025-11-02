import type { Product, Category, Warehouse } from '../types';

// ==================== FUNCIONES DE EXPORTACIÓN PARA PRODUCTOS ====================

/**
 * Exporta productos a CSV
 */
export const exportProductsToCSV = (products: Product[], filename: string = 'productos'): void => {
  // Definir encabezados
  const headers = ['ID', 'Nombre', 'SKU', 'Categoría', 'Bodega', 'Precio', 'Stock'];
  
  // Convertir datos a filas CSV
  const rows = products.map(product => [
    product.id.toString(),
    product.name,
    product.sku || 'Sin SKU',
    product.category_name || 'Sin categoría',
    product.warehouse_name || 'Sin bodega',
    `$${Number(product.price).toLocaleString('es-CL')}`,
    product.quantity.toString()
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
 * Exporta productos a Excel
 */
export const exportProductsToExcel = (products: Product[], filename: string = 'productos'): void => {
  // Crear HTML para Excel
  const headers = ['ID', 'Nombre', 'SKU', 'Categoría', 'Bodega', 'Precio', 'Stock'];
  
  const rows = products.map(product => [
    product.id.toString(),
    product.name,
    product.sku || 'Sin SKU',
    product.category_name || 'Sin categoría',
    product.warehouse_name || 'Sin bodega',
    `$${Number(product.price).toLocaleString('es-CL')}`,
    product.quantity.toString()
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
 * Exporta productos a PDF
 */
export const exportProductsToPDF = (products: Product[]): void => {
  // Crear contenido HTML para el PDF
  const headers = ['ID', 'Nombre', 'SKU', 'Categoría', 'Bodega', 'Precio', 'Stock'];
  
  const rows = products.map(product => [
    product.id.toString(),
    product.name,
    product.sku || 'Sin SKU',
    product.category_name || 'Sin categoría',
    product.warehouse_name || 'Sin bodega',
    `$${Number(product.price).toLocaleString('es-CL')}`,
    product.quantity.toString()
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
      <title>Catálogo de Productos - ${new Date().toLocaleDateString('es-CL')}</title>
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
      <h1>Catálogo de Productos</h1>
      <div class="info">
        <p>Fecha de exportación: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}</p>
        <p>Total de productos: ${products.length}</p>
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
        <p>Rep Drill - Sistema de Gestión de Inventario</p>
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

// ==================== FUNCIONES DE EXPORTACIÓN PARA CATEGORÍAS ====================

/**
 * Exporta categorías a CSV
 */
export const exportCategoriesToCSV = (categories: Category[], filename: string = 'categorias'): void => {
  // Definir encabezados
  const headers = ['ID', 'Nombre', 'Descripción'];
  
  // Convertir datos a filas CSV
  const rows = categories.map(category => [
    category.id.toString(),
    category.name,
    category.description || 'Sin descripción'
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
 * Exporta categorías a Excel
 */
export const exportCategoriesToExcel = (categories: Category[], filename: string = 'categorias'): void => {
  // Crear HTML para Excel
  const headers = ['ID', 'Nombre', 'Descripción'];
  
  const rows = categories.map(category => [
    category.id.toString(),
    category.name,
    category.description || 'Sin descripción'
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
 * Exporta categorías a PDF
 */
export const exportCategoriesToPDF = (categories: Category[]): void => {
  // Crear contenido HTML para el PDF
  const headers = ['ID', 'Nombre', 'Descripción'];
  
  const rows = categories.map(category => [
    category.id.toString(),
    category.name,
    category.description || 'Sin descripción'
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
      <title>Categorías de Productos - ${new Date().toLocaleDateString('es-CL')}</title>
      <style>
        @page {
          size: A4;
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
      <h1>Categorías de Productos</h1>
      <div class="info">
        <p>Fecha de exportación: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}</p>
        <p>Total de categorías: ${categories.length}</p>
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
        <p>Rep Drill - Sistema de Gestión de Inventario</p>
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

// ==================== FUNCIONES DE EXPORTACIÓN PARA BODEGAS ====================

/**
 * Exporta bodegas a CSV
 */
export const exportWarehousesToCSV = (warehouses: Warehouse[], filename: string = 'bodegas'): void => {
  // Definir encabezados
  const headers = ['ID', 'Nombre', 'Ubicación'];
  
  // Convertir datos a filas CSV
  const rows = warehouses.map(warehouse => [
    warehouse.id.toString(),
    warehouse.name,
    warehouse.location || 'Sin ubicación'
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
 * Exporta bodegas a Excel
 */
export const exportWarehousesToExcel = (warehouses: Warehouse[], filename: string = 'bodegas'): void => {
  // Crear HTML para Excel
  const headers = ['ID', 'Nombre', 'Ubicación'];
  
  const rows = warehouses.map(warehouse => [
    warehouse.id.toString(),
    warehouse.name,
    warehouse.location || 'Sin ubicación'
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
 * Exporta bodegas a PDF
 */
export const exportWarehousesToPDF = (warehouses: Warehouse[]): void => {
  // Crear contenido HTML para el PDF
  const headers = ['ID', 'Nombre', 'Ubicación'];
  
  const rows = warehouses.map(warehouse => [
    warehouse.id.toString(),
    warehouse.name,
    warehouse.location || 'Sin ubicación'
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
      <title>Bodegas - ${new Date().toLocaleDateString('es-CL')}</title>
      <style>
        @page {
          size: A4;
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
      <h1>Bodegas</h1>
      <div class="info">
        <p>Fecha de exportación: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}</p>
        <p>Total de bodegas: ${warehouses.length}</p>
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
        <p>Rep Drill - Sistema de Gestión de Inventario</p>
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
