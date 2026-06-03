import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCachedAccessToken } from './firebase';

export const exportToGoogleSheets = async (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  const token = getCachedAccessToken();
  if (!token) {
    throw new Error('NOT_AUTHENTICATED');
  }

  // 1. Create a new Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: fileName
      }
    })
  });

  if (!createRes.ok) {
    const errorDetails = await createRes.text();
    throw new Error(`Gagal membuat spreadsheet: ${createRes.status} - ${errorDetails}`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;

  // 2. Format Data for the Sheet
  if (data.length === 0) return spreadsheet.spreadsheetUrl;

  const headers = Object.keys(data[0]);
  const rows = data.map(item => headers.map(h => item[h] || ''));
  const values = [headers, ...rows];

  // 3. Write Data to the First Sheet (usually 'Sheet1')
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: values
    })
  });

  if (!updateRes.ok) {
     const errorDetails = await updateRes.text();
     throw new Error(`Gagal menulis data ke spreadsheet: ${updateRes.status} - ${errorDetails}`);
  }

  return spreadsheet.spreadsheetUrl;
};

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1', title?: string) => {
  let ws;
  if (title) {
    ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: 'A1' });
    const dateStr = `Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`;
    XLSX.utils.sheet_add_aoa(ws, [[dateStr]], { origin: 'A2' });
    XLSX.utils.sheet_add_json(ws, data, { origin: 'A4', skipHeader: false });
  } else {
    ws = XLSX.utils.json_to_sheet(data);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportToPDF = (title: string, headers: string[][], data: any[][], fileName: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [215, 330] });
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  doc.setFontSize(10);
  const dateStr = `Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`;
  doc.text(dateStr, 14, 30);

  autoTable(doc, {
    startY: 35,
    head: headers,
    body: data,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
  });

  doc.save(`${fileName}.pdf`);
};

export const exportUnitDailyRecapPDF = (
  unitTitle: string, 
  subTitle: string,
  headers: string[][], 
  data: any[][], 
  fileName: string
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [215, 330] });
  
  // Header section
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header 1 (Blue background)
  doc.setFillColor(180, 198, 231); // Light blue
  doc.rect(14, 10, pageWidth - 28, 15, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(unitTitle.toUpperCase(), pageWidth / 2, 18, { align: 'center' });
  doc.text(subTitle.toUpperCase(), pageWidth / 2, 23, { align: 'center' });

  autoTable(doc, {
    startY: 25,
    head: headers,
    body: data,
    theme: 'grid',
    headStyles: { 
      fillColor: [252, 213, 180], // Light orange
      textColor: [0, 0, 0], 
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 3,
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      valign: 'middle'
    },
    columnStyles: {
      0: { fillColor: [252, 213, 180], halign: 'center' }, // NO
      1: { fillColor: [252, 213, 180], halign: 'center' }, // TANGGAL
      2: { fillColor: [255, 255, 0] }, // ITEM
      3: { fillColor: [255, 255, 0], halign: 'right' },
      4: { fillColor: [255, 255, 0], halign: 'right' },
      5: { fillColor: [255, 255, 0], halign: 'right' },
      6: { fillColor: [255, 255, 0], halign: 'right' },
      7: { fillColor: [255, 255, 0], halign: 'right' },
      8: { fillColor: [255, 255, 0], halign: 'right' },
      9: { fillColor: [180, 198, 231] }, // NOTES
    },
    margin: { left: 14, right: 14 }
  });

  doc.save(`${fileName}.pdf`);
};

export const exportTataBogaIncomePDF = (
  title: string, 
  headers: string[][], 
  data: any[][], 
  footerRow: any[], 
  fileName: string
) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [215, 330] });
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 22);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const padZero = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}, ${padZero(now.getHours())}.${padZero(now.getMinutes())}.${padZero(now.getSeconds())}`;
  doc.text(`Tanggal Unduh: ${dateStr}`, 14, 30);

  autoTable(doc, {
    startY: 35,
    head: headers,
    body: data,
    foot: [footerRow],
    theme: 'grid',
    headStyles: { 
      fillColor: [15, 23, 42], 
      textColor: [255, 255, 255], 
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      valign: 'middle'
    },
    footStyles: {
      fillColor: [15, 23, 42], 
      textColor: [255, 255, 255], 
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'right',
      valign: 'middle'
    },
    styles: { 
      fontSize: 8, 
      cellPadding: 4,
      valign: 'top',
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.5
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 25 }, // Waktu
      1: { halign: 'left', cellWidth: 120 }, // Deskripsi Audit
      2: { halign: 'left', cellWidth: 20 }, // Pelanggan
      3: { halign: 'left', cellWidth: 15 }, // Kamar
      4: { halign: 'right' }, // Tunai
      5: { halign: 'right' }, // Transfer
      6: { halign: 'right' }, // Bon
      7: { halign: 'right' }, // Total Bruto
      8: { halign: 'right' }, // Peng.
      9: { halign: 'right' }  // Bersih
    },
    didParseCell: function (dataCell) {
      if (dataCell.section === 'foot') {
        if (dataCell.column.index === 0) {
          dataCell.cell.text = ['Konsolidasi Harian'];
          dataCell.cell.colSpan = 4;
          dataCell.cell.styles.halign = 'left';
        }
      }
    }
  });

  doc.save(`${fileName}.pdf`);
};

export const exportTataBogaIncomeExcel = (
  data: any[], 
  footerRow: any, 
  fileName: string, 
  sheetName: string = 'Sheet1'
) => {
  const rows = data.map(item => ({
    'Waktu': item.waktu,
    'Deskripsi Audit': item.deskripsi,
    'Pelanggan': item.pelanggan,
    'Kamar': item.kamar,
    'Tunai': item.tunai,
    'Transfer': item.transfer,
    'Bon': item.bon,
    'Total Bruto': item.totalBruto,
    'Peng.': item.peng,
    'Bersih': item.bersih
  }));

  rows.push({
    'Waktu': 'Konsolidasi Harian',
    'Deskripsi Audit': '',
    'Pelanggan': '',
    'Kamar': '',
    'Tunai': footerRow.tunai,
    'Transfer': footerRow.transfer,
    'Bon': footerRow.bon,
    'Total Bruto': footerRow.totalBruto,
    'Peng.': footerRow.peng,
    'Bersih': footerRow.bersih
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
