import { useState, useEffect, useMemo, Fragment } from 'react';
import { sheetsdb } from '../../lib/sheetsdb';
import { Category, Transaction, Expense, PaymentMethod, UserProfile, UserRole } from '../../types';
import { FileText, Calendar, Download, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, Trash2, Edit2, X, Check } from 'lucide-react';
import { MONTHS } from '../../constants';
import { exportToExcel, exportToPDF, exportUnitDailyRecapPDF, exportTataBogaIncomePDF, exportTataBogaIncomeExcel } from '../../lib/exportUtils';

interface ReportsProps {
  category: Category;
  userProfile: UserProfile | null;
}

const formatRupiahUnit = (num: number | string) => {
  if (num === undefined || num === null || num === '') return '';
  const numStr = num.toString().replace(/[^0-9]/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function Reports({ category, userProfile }: ReportsProps) {
  const [reportType, setReportType] = useState<'income' | 'income_summary' | 'expense' | 'monthly'>('income');
  const [summaryCategoryFilter, setSummaryCategoryFilter] = useState<'SEMUA' | 'MAKANAN' | 'MINUMAN' | 'GORENGAN'>('SEMUA');
  const getLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [filterType, setFilterType] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState(getLocalDate().slice(0, 7));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let start: Date, end: Date;
    
    if (filterType === 'daily') {
      const [y, m, d] = selectedDate.split('-').map(Number);
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
      end = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      const [y, m] = selectedMonth.split('-').map(Number);
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
    }

    const unsubT = sheetsdb.subscribeTransactions((allTs) => {
      const filtered = allTs.filter(t => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= start && d <= end && t.categoryId === category.id;
      });
      setTransactions(filtered);
      setLoading(false);
    });

    const unsubE = sheetsdb.subscribeExpenses((allEs) => {
      const filtered = allEs.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= start && d <= end && e.categoryId === category.id;
      });
      setExpenses(filtered);
    });

    return () => {
      unsubT();
      unsubE();
    };
  }, [category.id, selectedDate, selectedMonth, filterType]);

  const totalBruto = transactions.reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalNetto = totalBruto - totalExpense;
  const totalBon = transactions.filter(t => t.paymentMethod === PaymentMethod.BON).reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  
  const handleExportDailyRecap = async () => {
    let y, m;
    if (filterType === 'daily') {
      [y, m] = selectedDate.split('-').map(Number);
    } else {
      [y, m] = selectedMonth.split('-').map(Number);
    }
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0, 23, 59, 59, 999);
    
    setLoading(true);
    try {
      const allTs = sheetsdb.getTransactionsList().filter((t) => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= firstDay && d <= lastDay && t.categoryId === category.id;
      });
      const allEs = sheetsdb.getExpensesList().filter((e) => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= firstDay && d <= lastDay && e.categoryId === category.id;
      });

      const daysInMonth = lastDay.getDate();
      const reportData: any[][] = [];
      const excelData: any[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(y, m - 1, day);
        const nextDayDate = new Date(y, m - 1, day + 1);
        
        const dayTs = allTs.filter(t => {
          const d = (t.date as any)?.toDate?.() || t.date;
          return d >= dayDate && d < nextDayDate;
        });
        
        const dayEs = allEs.filter(e => {
          const d = (e.date as any)?.toDate?.() || e.date;
          return d >= dayDate && d < nextDayDate;
        });

        const cash = dayTs.filter(t => t.paymentMethod === PaymentMethod.CASH).reduce((a, c) => a + Number(c.totalPrice), 0);
        const transfer = dayTs.filter(t => t.paymentMethod === PaymentMethod.TRANSFER).reduce((a, c) => a + Number(c.totalPrice), 0);
        const bon = dayTs.filter(t => t.paymentMethod === PaymentMethod.BON).reduce((a, c) => a + Number(c.totalPrice), 0);
        const bruto = cash + transfer + bon;
        const expense = dayEs.reduce((a, c) => a + Number(c.amount), 0);
        const netto = bruto - expense;
        
        const dateStr = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
        const items = dayTs.length > 0 ? Array.from(new Set(dayTs.map(t => t.itemName))).join(', ') : '-';
        const notes = dayTs.map(t => t.notes).filter(Boolean).join('; ') || '-';

        reportData.push([
          day,
          dateStr,
          items,
          cash.toLocaleString(),
          transfer.toLocaleString(),
          bon.toLocaleString(),
          bruto.toLocaleString(),
          expense.toLocaleString(),
          netto.toLocaleString(),
          notes
        ]);

        excelData.push({
          'NO': day,
          'TANGGAL': dateStr,
          [category.name.toUpperCase()]: items,
          'CASH': cash,
          'TRANSFER': transfer,
          'BON/HUTANG': bon,
          'PENDAPATAN BRUTO': bruto,
          'TOTAL PENGELUARAN': expense,
          'PENDAPATAN NETTO': netto,
          'CATATAN': notes
        });
      }

      const fileName = `Rekapitulasi_${category.name}_${MONTHS[m-1]}_${y}`;
      const unitTitle = `REKAPITULASI LAPORAN PENDAPATAN ${category.name} (KOPERASI INKOPASINDO)`;
      const subTitle = `LEMBAGA PEMASYARAKATAN KELAS IIB KETAPANG`;
      
      const headers = [['NO', 'TANGGAL', category.name.toUpperCase(), 'CASH', 'TRANSFER', 'BON/HUTANG', 'PENDAPATAN BRUTO', 'TOTAL PENGELUARAN', 'PENDAPATAN NETTO', 'CATATAN']];
      
      exportUnitDailyRecapPDF(unitTitle, subTitle, headers, reportData, fileName);
      exportToExcel(excelData, fileName, 'Rekapitulasi');
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (reportType === 'monthly') {
      handleExportDailyRecap();
      return;
    }
    const fileName = `Laporan_${reportType}_${category.name}_${selectedDate}`;
    let data: any[] = [];
    let sheetTitle = 'Laporan';
    
    if (category.id === 'tata-boga' && (reportType === 'income' || reportType === 'income_summary')) {
      const grouped = groupTataBogaTransactions(transactions, reportType === 'income_summary' ? summaryCategoryFilter : 'SEMUA', filterType === 'monthly');
      const totals = grouped.reduce((acc, g) => {
        acc.tunai += g.paymentMethodTotals.cash;
        acc.transfer += g.paymentMethodTotals.transfer;
        acc.bon += g.paymentMethodTotals.bon;
        acc.totalBruto += g.totalBruto;
        return acc;
      }, { tunai: 0, transfer: 0, bon: 0, totalBruto: 0, peng: totalExpense, bersih: 0 });
      totals.bersih = totals.totalBruto - totals.peng;

      const excelData = grouped.map(g => ({
        waktu: (g.date as any)?.toDate?.() ? (g.date as any).toDate().toLocaleDateString('id-ID') : '...',
        deskripsi: (reportType === 'income_summary' && summaryCategoryFilter !== 'SEMUA') ? generateTataBogaAuditDescriptionSummary(g) : generateTataBogaAuditDescription(g),
        pelanggan: g.buyer || 'UMUM',
        kamar: g.room || '—',
        tunai: g.paymentMethodTotals.cash > 0 ? `Rp ${g.paymentMethodTotals.cash.toLocaleString('id-ID')}` : '—',
        transfer: g.paymentMethodTotals.transfer > 0 ? `Rp ${g.paymentMethodTotals.transfer.toLocaleString('id-ID')}` : '—',
        bon: g.paymentMethodTotals.bon > 0 ? `Rp ${g.paymentMethodTotals.bon.toLocaleString('id-ID')}` : '—',
        totalBruto: `Rp ${g.totalBruto.toLocaleString('id-ID')}`,
        peng: '—',
        bersih: `Rp ${g.totalBruto.toLocaleString('id-ID')}`
      }));

      const excelFooter = {
        tunai: `Rp ${totals.tunai.toLocaleString('id-ID')}`,
        transfer: `Rp ${totals.transfer.toLocaleString('id-ID')}`,
        bon: `Rp ${totals.bon.toLocaleString('id-ID')}`,
        totalBruto: `Rp ${totals.totalBruto.toLocaleString('id-ID')}`,
        peng: `Rp ${totals.peng.toLocaleString('id-ID')}`,
        bersih: `Rp ${totals.bersih.toLocaleString('id-ID')}`
      };

      exportTataBogaIncomeExcel(excelData, excelFooter, fileName, 'Pemasukan');
      return;
    }

    if (reportType === 'income') {
      data = transactions.map(t => ({
        'Waktu': (t.date as any)?.toDate?.() ? (t.date as any).toDate().toLocaleString() : '...',
        'Deskripsi': t.itemName,
        'Qty': t.quantity,
        'Metode': t.paymentMethod,
        'Total Bruto': t.totalPrice,
        'Catatan': t.notes || ''
      }));
      sheetTitle = 'Pemasukan';
    } else if (reportType === 'expense') {
      const sortedExpenses = [...expenses].sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const db = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return da - db;
      });
      data = sortedExpenses.map(e => ({
        'Waktu': (e.date as any)?.toDate?.() ? (e.date as any).toDate().toLocaleString() : '...',
        'Kategori Pengeluaran': e.itemName,
        'Nominal': e.amount,
        'Memo Audit': e.notes || ''
      }));
      sheetTitle = 'Pengeluaran';
    }

    exportToExcel(data, fileName, sheetTitle);
  };

  const handleExportPDF = () => {
    if (reportType === 'monthly') {
      handleExportDailyRecap();
      return;
    }
    const fileName = `Laporan_${reportType}_${category.name}_${selectedDate}`;
    
    if (category.id === 'tata-boga' && (reportType === 'income' || reportType === 'income_summary')) {
      const grouped = groupTataBogaTransactions(transactions, reportType === 'income_summary' ? summaryCategoryFilter : 'SEMUA', filterType === 'monthly');
      const headers = [['Waktu', 'Deskripsi Audit', 'Pelanggan', 'Kamar', 'Tunai', 'Transfer', 'Bon', 'Total Bruto', 'Peng.', 'Bersih']];
      
      const pdfData = grouped.map(g => [
        (g.date as any)?.toDate?.() ? (g.date as any).toDate().toLocaleDateString('id-ID') : '...',
        (reportType === 'income_summary' && summaryCategoryFilter !== 'SEMUA') ? generateTataBogaAuditDescriptionSummary(g) : generateTataBogaAuditDescription(g),
        g.buyer || 'UMUM',
        g.room || '—',
        g.paymentMethodTotals.cash > 0 ? `Rp ${g.paymentMethodTotals.cash.toLocaleString('id-ID')}` : '—',
        g.paymentMethodTotals.transfer > 0 ? `Rp ${g.paymentMethodTotals.transfer.toLocaleString('id-ID')}` : '—',
        g.paymentMethodTotals.bon > 0 ? `Rp ${g.paymentMethodTotals.bon.toLocaleString('id-ID')}` : '—',
        `Rp ${g.totalBruto.toLocaleString('id-ID')}`,
        '—',
        `Rp ${g.totalBruto.toLocaleString('id-ID')}`
      ]);

      const totals = grouped.reduce((acc, g) => {
        acc.tunai += g.paymentMethodTotals.cash;
        acc.transfer += g.paymentMethodTotals.transfer;
        acc.bon += g.paymentMethodTotals.bon;
        acc.totalBruto += g.totalBruto;
        return acc;
      }, { tunai: 0, transfer: 0, bon: 0, totalBruto: 0, peng: totalExpense, bersih: 0 });
      totals.bersih = totals.totalBruto - totals.peng;

      const footerRow = [
        'Konsolidasi Harian',
        '',
        '',
        '',
        `Rp ${totals.tunai.toLocaleString('id-ID')}`,
        `Rp ${totals.transfer.toLocaleString('id-ID')}`,
        `Rp ${totals.bon.toLocaleString('id-ID')}`,
        `Rp ${totals.totalBruto.toLocaleString('id-ID')}`,
        `Rp ${totals.peng.toLocaleString('id-ID')}`,
        `Rp ${totals.bersih.toLocaleString('id-ID')}`
      ];

      exportTataBogaIncomePDF(`Laporan Pemasukan - ${category.name.toUpperCase()} (${selectedDate})`, headers, pdfData, footerRow, fileName);
    } else if (reportType === 'income') {
      const headers = [['Waktu', 'Deskripsi', 'Qty', 'Metode', 'Total Bruto']];
      const pdfData = transactions.map(t => [
        (t.date as any)?.toDate?.() ? (t.date as any).toDate().toLocaleString() : '...',
        t.itemName,
        t.quantity,
        t.paymentMethod,
        `Rp ${t.totalPrice.toLocaleString()}`
      ]);
      exportToPDF(`Laporan Pemasukan - ${category.name} (${selectedDate})`, headers, pdfData, fileName);
    } else if (reportType === 'expense') {
      const headers = [['Waktu', 'Kategori Pengeluaran', 'Nominal', 'Memo Audit']];
      
      const sortedExpenses = [...expenses].sort((a, b) => {
        const da = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const db = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return da - db;
      });

      let pdfData: any[] = [];
      if (category.id === 'tata-boga') {
        const sortedDateMap: Record<string, any[]> = {};
        sortedExpenses.forEach((e: any) => {
          const d = e.date && (e.date as any).toDate ? (e.date as any).toDate().toLocaleDateString('id-ID') : '...';
          if (!sortedDateMap[d]) sortedDateMap[d] = [];
          sortedDateMap[d].push(e);
        });
        
        Object.entries(sortedDateMap).forEach(([dateStr, items]) => {
          const typeGroups = ['MAKANAN', 'MINUMAN', 'GORENGAN', 'LAINNYA'].map(tipe => {
            const typeItems = items.filter((e: any) => {
              const match = e.notes?.match(/TIPE:\s*(MAKANAN|MINUMAN|GORENGAN|LAINNYA)/i);
              const t = match ? match[1].toUpperCase() : 'LAINNYA';
              return t === tipe;
            });
            return {
              tipe,
              items: typeItems,
              total: typeItems.reduce((a: number, c: any) => a + (Number(c.amount) || 0), 0)
            };
          }).filter(g => g.items.length > 0 && (summaryCategoryFilter === 'SEMUA' || !summaryCategoryFilter || g.tipe === summaryCategoryFilter));

          if (typeGroups.length > 0) {
            const dayTotal = typeGroups.reduce((a, g) => a + g.total, 0);
            pdfData.push([
              { content: `Tanggal: ${dateStr} (Total Pengeluaran: Rp ${dayTotal.toLocaleString()})`, colSpan: 4, styles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' } }
            ]);
            typeGroups.forEach(group => {
               pdfData.push([
                 { content: `KATEGORI: ${group.tipe} (TOTAL: Rp ${group.total.toLocaleString()})`, colSpan: 4, styles: { fillColor: [255, 241, 242], textColor: [159, 18, 57], fontStyle: 'bold' } }
               ]);
               group.items.forEach((e: any) => {
                 pdfData.push([
                   (e.date as any)?.toDate?.() ? (e.date as any).toDate().toLocaleString() : '...',
                   e.itemName,
                   `Rp ${e.amount.toLocaleString()}`,
                   e.notes || '-'
                 ]);
               });
            });
          }
        });
      } else {
        pdfData = sortedExpenses.map(e => [
          (e.date as any)?.toDate?.() ? (e.date as any).toDate().toLocaleString() : '...',
          e.itemName,
          `Rp ${e.amount.toLocaleString()}`,
          e.notes || '-'
        ]);
      }
      exportToPDF(`Laporan Pengeluaran - ${category.name} (${selectedDate})`, headers, pdfData, fileName);
    }
  };

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail.type === 'excel') handleExportExcel();
      if (e.detail.type === 'pdf') handleExportPDF();
    };
    window.addEventListener('app-export', handler);
    return () => window.removeEventListener('app-export', handler);
  }, [transactions, expenses, reportType, category, selectedDate, filterType, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 md:flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto w-full md:w-auto shrink-0 scrollbar-none">
            <ReportTab active={reportType === 'income'} onClick={() => setReportType('income')} label="Pemasukan" />
            <ReportTab active={reportType === 'income_summary'} onClick={() => setReportType('income_summary')} label="Rekap Kategori" />
            <ReportTab active={reportType === 'expense'} onClick={() => setReportType('expense')} label="Pengeluaran" />
            <ReportTab active={reportType === 'monthly'} onClick={() => setReportType('monthly')} label="Bulanan" />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div className="flex gap-1 items-center bg-slate-100 p-1 rounded-xl shrink-0">
              <button onClick={() => setFilterType('daily')} className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'daily' ? 'bg-white shadow-sm text-slate-800 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Harian</button>
              <button onClick={() => setFilterType('monthly')} className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'monthly' ? 'bg-white shadow-sm text-slate-800 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Bulanan</button>
            </div>
            <div className="relative group flex-1 min-w-[130px] sm:flex-initial">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              {filterType === 'daily' ? (
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-11 pr-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                />
              ) : (
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full pl-11 pr-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                />
              )}
            </div>
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg shadow-slate-200 flex-1 sm:flex-initial shrink-0"
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
        </div>
        {(reportType === 'income_summary' || reportType === 'expense') && category.id === 'tata-boga' && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Filter Jenis:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto w-full md:w-auto shrink-0 scrollbar-none items-center">
              <ReportTab active={summaryCategoryFilter === 'SEMUA'} onClick={() => setSummaryCategoryFilter('SEMUA')} label="Semua" />
              <ReportTab active={summaryCategoryFilter === 'MAKANAN'} onClick={() => setSummaryCategoryFilter('MAKANAN')} label="Makanan" />
              <ReportTab active={summaryCategoryFilter === 'MINUMAN'} onClick={() => setSummaryCategoryFilter('MINUMAN')} label="Minuman" />
              <ReportTab active={summaryCategoryFilter === 'GORENGAN'} onClick={() => setSummaryCategoryFilter('GORENGAN')} label="Gorengan" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryIconCard title="Pendapatan Bersih" value={totalNetto} icon={<Layers size={18} />} color="blue" highlight />
        <SummaryIconCard title="Pendapatan Bruto" value={totalBruto} icon={<ArrowUpRight size={18} />} color="emerald" />
        <SummaryIconCard title="Total Pengeluaran" value={totalExpense} icon={<ArrowDownRight size={18} />} color="rose" />
        <SummaryIconCard title="Piutang (Bon)" value={totalBon} icon={<FileText size={18} />} color="orange" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-blue-500" />
                Tabel Rekam Data
            </h3>
            <span className="text-[9px] bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">Tampilan {reportType}</span>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="animate-spin mb-4" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Database...</p>
            </div>
          ) : (
            <>
              {reportType === 'income' && <IncomeTable category={category} transactions={transactions} expenses={expenses} totalExpense={totalExpense} selectedDate={selectedDate} userProfile={userProfile} filterType={filterType} />}
              {reportType === 'income_summary' && <IncomeTable category={category} transactions={transactions} expenses={expenses} totalExpense={totalExpense} selectedDate={selectedDate} userProfile={userProfile} filterType={filterType} isSummary={true} summaryCategoryFilter={summaryCategoryFilter} />}
              {reportType === 'expense' && <ExpenseTable category={category} expenses={expenses} selectedDate={selectedDate} userProfile={userProfile} filterType={filterType} summaryCategoryFilter={summaryCategoryFilter} />}
              {reportType === 'monthly' && <MonthlyRecapTable category={category} year={new Date(selectedDate).getFullYear()} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportTab({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all min-w-[100px] ${
        active ? 'bg-white shadow-sm text-blue-600 ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

function SummaryIconCard({ title, value, icon, color, highlight }: any) {
  const themes: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };
  return (
    <div className={`bg-white p-6 rounded-2xl border ${highlight ? 'border-blue-200 bg-blue-50/20 ring-4 ring-blue-500/5' : 'border-slate-100'} flex items-center gap-5 transition-all hover:translate-y-[-2px]`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${themes[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-xl font-black text-slate-900 tracking-tighter">Rp {value.toLocaleString()}</p>
      </div>
    </div>
  );
}

const getTataBogaItemType = (name: string): 'MAKANAN' | 'MINUMAN' | 'GORENGAN' => {
  const normalized = (name || '').toLowerCase().trim();
  const presets = [
    { name: 'Nila', type: 'MAKANAN' },
    { name: 'Lele', type: 'MAKANAN' },
    { name: 'Ayam Dada', type: 'MAKANAN' },
    { name: 'Ayam Paha', type: 'MAKANAN' },
    { name: 'Ayam Geprek', type: 'MAKANAN' },
    { name: 'Nasi Goreng Biasa', type: 'MAKANAN' },
    { name: 'Nasi Ati Ampela', type: 'MAKANAN' },
    { name: 'Sosis', type: 'MAKANAN' },
    { name: 'Nasi Telur', type: 'MAKANAN' },
    { name: 'Sambal', type: 'MAKANAN' },
    { name: 'Nasi', type: 'MAKANAN' },
    { name: 'Telur', type: 'MAKANAN' },
    { name: 'Indomie', type: 'MAKANAN' },
    { name: 'Kopi Hitam', type: 'MINUMAN' },
    { name: 'Teh Es', type: 'MINUMAN' },
    { name: 'Kopi Susu', type: 'MINUMAN' },
    { name: 'Susu Hangat', type: 'MINUMAN' },
    { name: 'Teh', type: 'MINUMAN' },
    { name: 'Es Teh', type: 'MINUMAN' },
    { name: 'Bakwan', type: 'GORENGAN' },
    { name: 'Tahu Isi', type: 'GORENGAN' },
    { name: 'Tempe Mendoan', type: 'GORENGAN' },
    { name: 'Pisang Goreng', type: 'GORENGAN' },
  ];
  
  const found = presets.find(p => p.name.toLowerCase() === normalized);
  if (found) return found.type as any;
  
  if (normalized.includes('kopi') || normalized.includes('teh') || normalized.includes('susu') || normalized.includes('es') || normalized.includes('jus') || normalized.includes('air') || normalized.includes('nutrisari')) {
    return 'MINUMAN';
  }
  if (normalized.includes('bakwan') || normalized.includes('tahu') || normalized.includes('tempe') || normalized.includes('pisang') || normalized.includes('gorengan') || normalized.includes('cireng')) {
    return 'GORENGAN';
  }
  return 'MAKANAN';
};

const parseNotes = (notesStr: string = '') => {
  let buyer = '';
  let room = '';
  let memo = '';
  
  if (notesStr) {
    const parts = notesStr.split(' • ');
    parts.forEach(part => {
      if (part.toLowerCase().startsWith('pembeli:')) {
        buyer = part.substring(8).trim();
      } else if (part.toLowerCase().startsWith('pelanggan:')) {
        buyer = part.substring(10).trim();
      } else if (part.toLowerCase().startsWith('kamar:')) {
        room = part.substring(6).trim();
      } else if (part.toLowerCase().startsWith('memo:')) {
        memo = part.substring(5).trim();
      } else {
        if (!memo) {
          memo = part.trim();
        } else {
          memo += ' • ' + part.trim();
        }
      }
    });
  }
  return { buyer, room, memo };
};

const generateTataBogaAuditDescription = (group: any) => {
  const itemTitleLine = group.items.map((i: any) => `${i.itemName} (${i.quantity}x)`).join(' + ');
  const totalQty = group.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
  
  const lines = [`${itemTitleLine} (QTY: ${totalQty})`];
  
  const typeLabels: Record<string, string> = {
    'MAKANAN': 'Makanan',
    'MINUMAN': 'Minuman',
    'GORENGAN': 'Gorengan'
  };
  
  const orderedTypes: ('MAKANAN'|'MINUMAN'|'GORENGAN')[] = ['MAKANAN', 'MINUMAN', 'GORENGAN'];
  orderedTypes.forEach(tType => {
    const typeItems = group.items.filter((i: any) => i.type === tType);
    typeItems.forEach((item: any) => {
      const unitPrice = item.quantity > 0 ? (item.totalPrice / item.quantity) : 0;
      lines.push(`- ${typeLabels[tType] || tType}: ${item.itemName} (${item.quantity}x @ Rp ${unitPrice.toLocaleString('id-ID')}) — Rp ${item.totalPrice.toLocaleString('id-ID')}`);
    });
  });
  
  return lines.join('\n');
};

const generateTataBogaAuditDescriptionSummary = (group: any) => {
  const totalQty = group.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
  const lines = [`Total: ${totalQty} Items`];
  
  const typeLabels: Record<string, string> = {
    'MAKANAN': 'Makanan',
    'MINUMAN': 'Minuman',
    'GORENGAN': 'Gorengan'
  };
  
  const orderedTypes: ('MAKANAN'|'MINUMAN'|'GORENGAN')[] = ['MAKANAN', 'MINUMAN', 'GORENGAN'];
  orderedTypes.forEach(tType => {
    const typeItems = group.items.filter((i: any) => i.type === tType);
    if (typeItems.length > 0) {
      const typeQty = typeItems.reduce((acc: number, item: any) => acc + item.quantity, 0);
      const typeTotal = typeItems.reduce((acc: number, item: any) => acc + item.totalPrice, 0);
      lines.push(`- ${typeLabels[tType] || tType}: ${typeQty}x — Rp ${typeTotal.toLocaleString('id-ID')}`);
    }
  });
  
  return lines.join('\n');
};

const groupTataBogaTransactions = (transList: any[], typeFilter: string = 'SEMUA', isMonthlyFilter: boolean = false) => {
  const groups: Record<string, {
    id: string;
    date: any;
    buyer: string;
    room: string;
    memo: string;
    notes: string;
    paymentMethod: string;
    items: {
      id: string;
      itemName: string;
      quantity: number;
      totalPrice: number;
      type: 'MAKANAN' | 'MINUMAN' | 'GORENGAN';
      originalTransaction: any;
    }[];
    totalBruto: number;
    paymentMethodTotals: {
      cash: number;
      transfer: number;
      bon: number;
    };
  }> = {};

  transList.forEach(t => {
    const presetType = getTataBogaItemType(t.itemName || '');
    if (typeFilter !== 'SEMUA' && presetType !== typeFilter) {
      return;
    }

    const { buyer = '', room = '', memo = '' } = parseNotes(t.notes || '');
    const dateObj = t.date && t.date.toDate ? t.date.toDate() : new Date();
    const dateStr = dateObj.toLocaleDateString('id-ID');
    
    // Jika isMonthlyFilter, cukup kelompokkan berdasarkan hari (tanggal) saja
    const key = isMonthlyFilter 
      ? dateStr 
      : `${dateStr}_${(buyer || '').toLowerCase().trim()}_${(room || '').toLowerCase().trim()}_${t.paymentMethod}_${(memo || '').toLowerCase().trim()}`;
    
    if (!groups[key]) {
      groups[key] = {
        id: t.id || Math.random().toString(),
        date: t.date,
        buyer: isMonthlyFilter ? 'BERBAGAI PELANGGAN' : (buyer || ''),
        room: isMonthlyFilter ? '—' : (room || ''),
        memo: isMonthlyFilter ? '' : (memo || ''),
        notes: isMonthlyFilter ? '' : (t.notes || ''),
        paymentMethod: isMonthlyFilter ? 'Campur' : t.paymentMethod,
        items: [],
        totalBruto: 0,
        paymentMethodTotals: { cash: 0, transfer: 0, bon: 0 }
      };
    }
    
    // if grouped strictly by date, try to find an existing item to sum up quantity if itemName matches exactly
    const existingItem = isMonthlyFilter 
      ? groups[key].items.find(i => i.itemName === t.itemName && i.type === presetType)
      : null;
      
    if (existingItem) {
      existingItem.quantity += t.quantity;
      existingItem.totalPrice += t.totalPrice;
    } else {
      groups[key].items.push({
        id: t.id,
        itemName: t.itemName,
        quantity: t.quantity,
        totalPrice: t.totalPrice,
        type: presetType,
        originalTransaction: t
      });
    }
    
    groups[key].totalBruto += t.totalPrice;
    
    if (t.paymentMethod === 'Cash') {
      groups[key].paymentMethodTotals.cash += t.totalPrice;
    } else if (t.paymentMethod === 'Transfer') {
      groups[key].paymentMethodTotals.transfer += t.totalPrice;
    } else if (t.paymentMethod === 'Bon') {
      groups[key].paymentMethodTotals.bon += t.totalPrice;
    }
  });

  return Object.values(groups);
};

function IncomeTable({ category, transactions, expenses, totalExpense, selectedDate, userProfile, filterType, isSummary, summaryCategoryFilter }: any) {
  const isWarteg = category.id === 'warteg';
  const isTataBoga = category.id === 'tata-boga';
  const isAdmin = userProfile?.role === UserRole.ADMIN;
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const displayTransactions = useMemo(() => {
    if (isTataBoga && isSummary && summaryCategoryFilter !== 'SEMUA') {
      return transactions.filter((t: any) => {
        const type = getTataBogaItemType(t.itemName || '');
        return type === summaryCategoryFilter;
      });
    }
    return transactions;
  }, [transactions, isTataBoga, isSummary, summaryCategoryFilter]);

  // Grouped Tata boga states
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState<any>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<string | null>(null);

  const confirmDelete = async (id: string) => {
    try {
      await sheetsdb.deleteTransaction(id);
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error(error);
      alert('Gagal menghapus transaksi: ' + error.message);
    }
  };

  const confirmDeleteGroup = async (group: any) => {
    try {
      for (const item of group.items) {
        if (item.id) {
          await sheetsdb.deleteTransaction(item.id);
        }
      }
      setConfirmDeleteGroupId(null);
    } catch (error: any) {
      console.error(error);
      alert('Gagal menghapus seluruh pesanan: ' + error.message);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroupForm) return;
    try {
      let formattedNotes = '';
      const parts: string[] = [];
      if (editGroupForm.buyer?.trim()) parts.push(`Pembeli: ${editGroupForm.buyer.trim()}`);
      if (editGroupForm.room?.trim()) parts.push(`Kamar: ${editGroupForm.room.trim()}`);
      if (editGroupForm.memo?.trim()) parts.push(`Memo: ${editGroupForm.memo.trim()}`);
      formattedNotes = parts.join(' • ');

      for (const item of editGroupForm.items) {
        await sheetsdb.updateTransaction(item.id, {
          itemName: item.itemName,
          quantity: Number(item.quantity),
          totalPrice: Number(item.totalPrice),
          paymentMethod: editGroupForm.paymentMethod,
          notes: formattedNotes
        });
      }
      setEditingGroupId(null);
      setEditGroupForm(null);
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengubah transaksi kelompok: ' + error.message);
    }
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setEditForm({ ...t, unitPrice: t.quantity > 0 ? t.totalPrice / t.quantity : t.totalPrice });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleUpdate = async () => {
    if (!editForm) return;
    try {
      const { id, ...data } = editForm;
      await sheetsdb.updateTransaction(id, {
        itemName: data.itemName,
        quantity: Number(data.quantity),
        totalPrice: Number(data.totalPrice),
        paymentMethod: data.paymentMethod,
        notes: data.notes || '',
      });
      setEditingId(null);
      setEditForm(null);
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengubah transaksi: ' + error.message);
    }
  };

  const groupedTataBoga = isTataBoga ? groupTataBogaTransactions(transactions, isSummary ? summaryCategoryFilter : 'SEMUA', filterType === 'monthly') : [];

  return (
    <table className="w-full text-left text-xs min-w-[1100px]">
      <thead className="bg-slate-100 text-slate-500 uppercase text-[9px] font-black tracking-[0.2em]">
        <tr>
          <th className="px-6 py-5">Waktu</th>
          <th className="px-6 py-5">Deskripsi Audit</th>
          <th className="px-6 py-5 text-right">Tunai</th>
          <th className="px-6 py-5 text-right">Transfer</th>
          <th className="px-6 py-5 text-right">Bon</th>
          {isWarteg && <><th className="px-6 py-5 text-right">Sisa B.</th><th className="px-6 py-5 text-right">Sisa J.</th><th className="px-6 py-5">Lauk</th><th className="px-6 py-5">Laku</th></>}
          <th className="px-6 py-5 text-right font-black text-slate-900">Total Bruto</th>
          <th className="px-6 py-5 text-right text-rose-500 font-black italic">Peng.</th>
          <th className="px-6 py-5 text-right font-black text-emerald-600">Bersih</th>
          {isAdmin && <th className="px-6 py-5 text-center">Aksi</th>}
         </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
        {isTataBoga ? (
          groupedTataBoga.length === 0 ? (
            <tr><td colSpan={isAdmin ? 9 : 8} className="px-6 py-16 text-center text-slate-300 font-bold uppercase tracking-widest italic">Tidak Ada Rekaman Transaksi Tata Boga</td></tr>
          ) : (
            groupedTataBoga.map((group: any) => {
              const isEditingGroup = editingGroupId === group.id;
              const isSimplifiedSummary = isSummary && summaryCategoryFilter !== 'SEMUA';
              const uniqueTypes = Array.from(new Set(group.items.map((i: any) => i.type)));
              const displayTitleLine = isSimplifiedSummary 
                ? uniqueTypes.join(' + ')
                : group.items.map((i: any) => `${i.itemName} (${i.quantity}x)`).join(' + ');
              
              const makananItems = group.items.filter((i: any) => i.type === 'MAKANAN');
              const minumanItems = group.items.filter((i: any) => i.type === 'MINUMAN');
              const gorenganItems = group.items.filter((i: any) => i.type === 'GORENGAN');
              const totalQty = group.items.reduce((acc: number, item: any) => acc + item.quantity, 0);

              const groupDateStr = group.date && (group.date as any).toDate ? (group.date as any).toDate().toLocaleDateString('id-ID') : '';
              let groupExpenseAmount = 0;
              if (expenses) {
                const expenseTypeFilter = isSimplifiedSummary && summaryCategoryFilter !== 'SEMUA' ? summaryCategoryFilter : null;
                const matchExpenses = expenses.filter((e: any) => {
                  const eDateStr = e.date && (e.date as any).toDate ? (e.date as any).toDate().toLocaleDateString('id-ID') : '';
                  if (eDateStr !== groupDateStr) return false;
                  if (expenseTypeFilter) {
                    const notesStr = (e.notes || '').toUpperCase();
                    return notesStr.includes(`TIPE: ${expenseTypeFilter}`);
                  }
                  return true;
                });
                groupExpenseAmount = matchExpenses.reduce((a: number, c: any) => a + (Number(c.amount) || 0), 0);
              }
              const groupBersih = group.totalBruto - groupExpenseAmount;

              return (
                <tr key={group.id} className="hover:bg-slate-50 border-white transition-all align-top">
                  <td className="px-6 py-6 font-mono text-[10px] opacity-60">
                    {groupDateStr || '...'}
                  </td>
                  <td className="px-6 py-6">
                    {isEditingGroup ? (
                      <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-left max-w-lg">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400">Nama Pelanggan</label>
                            <input 
                              type="text" 
                              value={editGroupForm.buyer}
                              onChange={(e) => setEditGroupForm({ ...editGroupForm, buyer: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none font-bold text-slate-800 text-xs"
                              placeholder="Pelanggan"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase text-slate-400">Nomor Kamar</label>
                            <input 
                              type="text" 
                              value={editGroupForm.room}
                              onChange={(e) => setEditGroupForm({ ...editGroupForm, room: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none font-bold text-slate-800 text-xs"
                              placeholder="Kamar"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400">Memo Tambahan</label>
                          <input 
                            type="text" 
                            value={editGroupForm.memo}
                            onChange={(e) => setEditGroupForm({ ...editGroupForm, memo: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:border-blue-500 focus:outline-none font-bold text-slate-800 text-xs"
                            placeholder="Memo"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Daftar Item</label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {editGroupForm.items.map((item: any, itemIdx: number) => {
                              const unitPrice = item.totalPrice / item.quantity;
                              return (
                                <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                                  <span className="font-semibold text-slate-800 text-xs truncate max-w-[100px]">{item.itemName}</span>
                                  <div className="flex items-center gap-1 ml-auto shrink-0">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Qty:</span>
                                    <input 
                                      type="number" 
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newQty = Math.max(1, Number(e.target.value));
                                        const updatedItems = [...editGroupForm.items];
                                        updatedItems[itemIdx] = {
                                          ...item,
                                          quantity: newQty,
                                          totalPrice: newQty * unitPrice
                                        };
                                        setEditGroupForm({ ...editGroupForm, items: updatedItems });
                                      }}
                                      className="w-10 bg-slate-50 border rounded text-center py-0.5 text-xs font-bold font-mono"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">Rp/Unit:</span>
                                    <input 
                                      type="text" 
                                      value={formatRupiahUnit(unitPrice)}
                                      onChange={(e) => {
                                        const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                                        const newUnit = Math.max(0, Number(cleanVal));
                                        const updatedItems = [...editGroupForm.items];
                                        updatedItems[itemIdx] = {
                                          ...item,
                                          totalPrice: item.quantity * newUnit
                                        };
                                        setEditGroupForm({ ...editGroupForm, items: updatedItems });
                                      }}
                                      className="w-20 bg-slate-50 border rounded text-right pr-1 py-0.5 text-xs font-bold font-mono"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] font-black uppercase text-slate-400">Metode Pembayaran</label>
                          <select 
                            value={editGroupForm.paymentMethod}
                            onChange={(e) => setEditGroupForm({ ...editGroupForm, paymentMethod: e.target.value })}
                            className="bg-white border rounded px-2 py-1 text-xs font-bold"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Transfer">Transfer</option>
                            <option value="Bon">Bon</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col text-left">
                        <div className="text-sm font-black text-slate-800 leading-tight tracking-tight">
                          {displayTitleLine}
                        </div>
                        
                        {!isSimplifiedSummary && filterType !== 'monthly' && (
                          <>
                            <div className="flex items-center gap-2 mb-3 mt-2">
                              <span className="bg-blue-50 text-blue-700 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
                                PELANGGAN: {group.buyer || 'UMUM'}
                              </span>
                              <span className="bg-orange-50 text-orange-700 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
                                KAMAR: {group.room || '—'}
                              </span>
                            </div>
                            
                            <div className="border-t border-slate-100 my-2"></div>
                            
                            {makananItems.length > 0 && (
                              <div className="mb-2">
                                <span className="bg-emerald-50 text-emerald-800 font-black text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm mb-1 inline-block">
                                  MAKANAN
                                </span>
                                <div className="space-y-1">
                                  {makananItems.map((item: any, idx: number) => {
                                    const unitPrice = item.totalPrice / item.quantity;
                                    return (
                                      <div key={item.id + '-' + idx} className="flex justify-between items-center text-xs text-slate-600 max-w-sm">
                                        <span>
                                          <strong className="text-slate-850 font-bold">• {item.itemName}</strong>{' '}
                                          <span className="text-slate-400 font-mono text-[10px]">({item.quantity}x @ Rp {unitPrice.toLocaleString('id-ID')})</span>
                                        </span>
                                        <span className="font-mono text-slate-600 text-[11px] font-medium">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {minumanItems.length > 0 && (
                              <div className="mb-2">
                                <span className="bg-blue-50 text-blue-800 font-black text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm mb-1 inline-block">
                                  MINUMAN
                                </span>
                                <div className="space-y-1">
                                  {minumanItems.map((item: any, idx: number) => {
                                    const unitPrice = item.totalPrice / item.quantity;
                                    return (
                                      <div key={item.id + '-' + idx} className="flex justify-between items-center text-xs text-slate-600 max-w-sm">
                                        <span>
                                          <strong className="text-slate-850 font-bold">• {item.itemName}</strong>{' '}
                                          <span className="text-slate-400 font-mono text-[10px]">({item.quantity}x @ Rp {unitPrice.toLocaleString('id-ID')})</span>
                                        </span>
                                        <span className="font-mono text-slate-600 text-[11px] font-medium">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {gorenganItems.length > 0 && (
                              <div className="mb-2">
                                <span className="bg-amber-50 text-amber-805 font-black text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm mb-1 inline-block">
                                  GORENGAN
                                </span>
                                <div className="space-y-1">
                                  {gorenganItems.map((item: any, idx: number) => {
                                    const unitPrice = item.totalPrice / item.quantity;
                                    return (
                                      <div key={item.id + '-' + idx} className="flex justify-between items-center text-xs text-slate-600 max-w-sm">
                                        <span>
                                          <strong className="text-slate-850 font-bold">• {item.itemName}</strong>{' '}
                                          <span className="text-slate-400 font-mono text-[10px]">({item.quantity}x @ Rp {unitPrice.toLocaleString('id-ID')})</span>
                                        </span>
                                        <span className="font-mono text-slate-600 text-[11px] font-medium">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        
                        <div className="hidden font-mono text-[9px] text-slate-400 font-black uppercase tracking-wider mt-2">
                          QTY: {totalQty}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-xs">
                    {group.paymentMethodTotals.cash > 0 ? `Rp ${group.paymentMethodTotals.cash.toLocaleString('id-ID')}` : <span className="text-rose-500 font-bold">—</span>}
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-xs">
                    {group.paymentMethodTotals.transfer > 0 ? `Rp ${group.paymentMethodTotals.transfer.toLocaleString('id-ID')}` : <span className="text-rose-500 font-bold">—</span>}
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-xs">
                    {group.paymentMethodTotals.bon > 0 ? `Rp ${group.paymentMethodTotals.bon.toLocaleString('id-ID')}` : <span className="text-rose-500 font-bold">—</span>}
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-xs font-black text-slate-900 border-l border-slate-50">
                    Rp {group.totalBruto.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-6 text-right font-mono text-xs text-rose-500 font-semibold italic">
                    {groupExpenseAmount > 0 ? `Rp ${groupExpenseAmount.toLocaleString('id-ID')}` : '—'}
                  </td>
                  <td className="px-6 py-6 text-right font-medium text-emerald-600 italic font-mono text-xs">
                    Rp {groupBersih.toLocaleString('id-ID')}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isEditingGroup ? (
                          <>
                            <button 
                              onClick={handleUpdateGroup}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Simpan"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingGroupId(null);
                                setEditGroupForm(null);
                              }}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Batal"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                setEditingGroupId(group.id);
                                setEditGroupForm(JSON.parse(JSON.stringify(group)));
                              }}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            {confirmDeleteGroupId === group.id ? (
                              <>
                                <button onClick={() => confirmDeleteGroup(group)} className="p-2 text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors" title="Yakin Hapus Semuanya?"><Check size={14}/></button>
                                <button onClick={() => setConfirmDeleteGroupId(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors" title="Batal Hapus"><X size={14}/></button>
                              </>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteGroupId(group.id)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-black rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )
        ) : (
          displayTransactions.length === 0 ? (
            <tr><td colSpan={isAdmin ? (isWarteg ? 12 : 10) : (isWarteg ? 11 : 9)} className="px-6 py-16 text-center text-slate-300 font-bold uppercase tracking-widest italic">Tidak Ada Rekaman Transaksi</td></tr>
          ) : (
            displayTransactions.map((t: any, idx: number) => {
              const isEditing = editingId === t.id;
              return (
                <tr key={t.id} className="hover:bg-slate-50 border-white transition-all">
                  <td className="px-6 py-4 font-mono text-[10px] opacity-60">
                    {t.date && (t.date as any).toDate ? (t.date as any).toDate().toLocaleDateString('id-ID') : '...'}
                  </td>
                  <td className="px-6 py-4 text-left">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.itemName} 
                        onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                        className="bg-white border rounded px-2 py-1 font-bold text-slate-800 w-full"
                      />
                    ) : (
                      <div className="font-bold text-slate-800">{t.itemName}</div>
                    )}
                    <div className="text-[9px] uppercase tracking-widest opacity-50 flex items-center gap-2 mt-1">
                        <span>QTY: {isEditing ? (
                          <input 
                            type="number" 
                            value={editForm.quantity} 
                            onChange={(e) => {
                              const newQty = Number(e.target.value) || 0;
                              setEditForm({
                                ...editForm, 
                                quantity: newQty,
                                totalPrice: newQty * editForm.unitPrice
                              });
                            }}
                            className="w-12 bg-white border rounded px-1"
                          />
                        ) : t.quantity}</span>
                        {isEditing ? (
                          <input 
                            type="text" 
                            placeholder="Catatan"
                            value={editForm.notes || ''} 
                            onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                            className="bg-white border rounded px-2 py-0.5 text-blue-500"
                          />
                        ) : t.notes && <span className="text-blue-500">• {t.notes}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      editForm.paymentMethod === PaymentMethod.CASH ? (
                        <input 
                          type="text" 
                          value={formatRupiahUnit(editForm.unitPrice)} 
                          onChange={(e) => {
                            const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                            const newUnit = Number(cleanVal) || 0;
                            setEditForm({
                              ...editForm, 
                              unitPrice: newUnit,
                              totalPrice: newUnit * (editForm.quantity || 1)
                            });
                          }}
                          className="w-24 bg-white border rounded px-2 py-1 text-right"
                        />
                      ) : (
                        <button onClick={() => setEditForm({...editForm, paymentMethod: PaymentMethod.CASH})} className="text-[9px] uppercase tracking-widest text-slate-400 hover:text-blue-500">Pilih Tunai</button>
                      )
                    ) : (t.paymentMethod === PaymentMethod.CASH ? `Rp ${t.totalPrice.toLocaleString()}` : '—')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      editForm.paymentMethod === PaymentMethod.TRANSFER ? (
                        <input 
                          type="text" 
                          value={formatRupiahUnit(editForm.unitPrice)} 
                          onChange={(e) => {
                            const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                            const newUnit = Number(cleanVal) || 0;
                            setEditForm({
                              ...editForm, 
                              unitPrice: newUnit,
                              totalPrice: newUnit * (editForm.quantity || 1)
                            });
                          }}
                          className="w-24 bg-white border rounded px-2 py-1 text-right"
                        />
                      ) : (
                        <button onClick={() => setEditForm({...editForm, paymentMethod: PaymentMethod.TRANSFER})} className="text-[9px] uppercase tracking-widest text-slate-400 hover:text-blue-500">Pilih Transfer</button>
                      )
                    ) : (t.paymentMethod === PaymentMethod.TRANSFER ? `Rp ${t.totalPrice.toLocaleString()}` : '—')}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-rose-500">
                    {isEditing ? (
                      editForm.paymentMethod === PaymentMethod.BON ? (
                        <input 
                          type="text" 
                          value={formatRupiahUnit(editForm.unitPrice)} 
                          onChange={(e) => {
                            const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                            const newUnit = Number(cleanVal) || 0;
                            setEditForm({
                              ...editForm, 
                              unitPrice: newUnit,
                              totalPrice: newUnit * (editForm.quantity || 1)
                            });
                          }}
                          className="w-24 bg-white border rounded px-2 py-1 text-right text-rose-500"
                        />
                      ) : (
                        <button onClick={() => setEditForm({...editForm, paymentMethod: PaymentMethod.BON})} className="text-[9px] uppercase tracking-widest text-slate-400 hover:text-rose-500">Pilih Bon</button>
                      )
                    ) : (t.paymentMethod === PaymentMethod.BON ? `Rp ${t.totalPrice.toLocaleString()}` : '—')}
                  </td>
                  {isWarteg && (
                    <>
                      <td className="px-6 py-4 text-right text-slate-400">{t.wartegDetails?.sisaBon ? `Rp ${t.wartegDetails.sisaBon.toLocaleString()}` : '—'}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{t.wartegDetails?.sisaJualKembali ? `Rp ${t.wartegDetails.sisaJualKembali.toLocaleString()}` : '—'}</td>
                      <td className="px-6 py-4 text-[10px] text-slate-400 font-medium truncate max-w-[100px]">{t.wartegDetails?.sisaLaukNotes || '—'}</td>
                      <td className="px-6 py-4 text-[10px] text-slate-400 font-medium truncate max-w-[100px]">{t.wartegDetails?.sisaLakuNotes || '—'}</td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right font-black text-slate-900 border-l border-slate-50">Rp {(isEditing ? editForm.totalPrice : t.totalPrice).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-slate-300 italic">—</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-400 italic">Rp {(isEditing ? editForm.totalPrice : t.totalPrice).toLocaleString()}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                         {isEditing ? (
                           <>
                             <button 
                               onClick={handleUpdate}
                               className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                               title="Simpan"
                             >
                               <Check size={14} />
                             </button>
                             <button 
                               onClick={cancelEdit}
                               className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                               title="Batal"
                             >
                               <X size={14} />
                             </button>
                           </>
                         ) : (
                           <>
                             <button 
                               onClick={() => startEdit(t)}
                               className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                               title="Edit"
                             >
                               <Edit2 size={14} />
                             </button>
                             {confirmDeleteId === t.id ? (
                               <>
                                 <button onClick={() => confirmDelete(t.id)} className="p-2 text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors" title="Yakin Hapus?"><Check size={14} /></button>
                                 <button onClick={() => setConfirmDeleteId(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors" title="Batal Hapus"><X size={14} /></button>
                               </>
                             ) : (
                               <button 
                                 onClick={() => setConfirmDeleteId(t.id)}
                                 className="p-2 text-slate-400 hover:text-white hover:bg-black rounded-lg transition-colors"
                                 title="Hapus"
                               >
                                 <Trash2 size={14} />
                               </button>
                             )}
                           </>
                         )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )
        )}
      </tbody>
      {displayTransactions.length > 0 && (
        <tfoot className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">
            <tr>
                <td colSpan={2} className="px-6 py-6 border-r border-white/5">Konsolidasi {filterType === 'monthly' ? 'Bulanan' : 'Harian'}</td>
                <td className="px-6 py-6 text-right">Rp {displayTransactions.filter((t:any) => t.paymentMethod === PaymentMethod.CASH).reduce((a:any,c:any) => a + (Number(c.totalPrice) || 0), 0).toLocaleString()}</td>
                <td className="px-6 py-6 text-right border-r border-white/5">Rp {displayTransactions.filter((t:any) => t.paymentMethod === PaymentMethod.TRANSFER).reduce((a:any,c:any) => a + (Number(c.totalPrice) || 0), 0).toLocaleString()}</td>
                <td className="px-6 py-6 text-right text-rose-400">Rp {displayTransactions.filter((t:any) => t.paymentMethod === PaymentMethod.BON).reduce((a:any,c:any) => a + (Number(c.totalPrice) || 0), 0).toLocaleString()}</td>
                {isWarteg && <><td className="px-6 py-6 text-right">—</td><td className="px-6 py-6 text-right">—</td><td className="px-6 py-6 text-left">—</td><td className="px-6 py-6 text-left">—</td></>}
                <td className="px-6 py-6 text-right border-l border-white/10 text-blue-400">Rp {displayTransactions.reduce((a:any,c:any) => a + (Number(c.totalPrice) || 0), 0).toLocaleString()}</td>
                <td className="px-6 py-6 text-right text-rose-500 italic">Rp {totalExpense.toLocaleString()}</td>
                <td className="px-6 py-6 text-right text-emerald-400 text-sm">Rp {(displayTransactions.reduce((a:any,c:any) => a + (Number(c.totalPrice) || 0), 0) - totalExpense).toLocaleString()}</td>
                {isAdmin && <td className="px-6 py-6"></td>}
            </tr>
        </tfoot>
      )}
    </table>
  );
}

function ExpenseTable({ category, expenses, selectedDate, userProfile, filterType, summaryCategoryFilter }: any) {
  const isAdmin = userProfile?.role === UserRole.ADMIN;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const confirmDelete = async (id: string) => {
    try {
      await sheetsdb.deleteExpense(id);
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error(error);
      alert('Gagal menghapus pengeluaran: ' + error.message);
    }
  };

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setEditForm({ ...e });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleUpdate = async () => {
    if (!editForm) return;
    try {
      const { id, ...data } = editForm;
      await sheetsdb.updateExpense(id, {
        itemName: data.itemName,
        amount: Number(data.amount),
        notes: data.notes || '',
      });
      setEditingId(null);
      setEditForm(null);
    } catch (error: any) {
      console.error(error);
      alert('Gagal mengubah pengeluaran: ' + error.message);
    }
  };

  const total = expenses.reduce((a:any, c:any) => a + (Number(c.amount) || 0), 0);
  const isTataBoga = category?.id === 'tata-boga';

  const groupedExpensesByDate = useMemo(() => {
    if (!isTataBoga) return [];
    const dateMap: Record<string, any[]> = {};
    expenses.forEach((e: any) => {
      const d = e.date && (e.date as any).toDate ? (e.date as any).toDate().toLocaleDateString('id-ID') : '...';
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push(e);
    });

    // sort properties by date if needed, assuming expenses are sorted
    return Object.entries(dateMap).map(([dateStr, items]) => {
      const typeGroups = ['MAKANAN', 'MINUMAN', 'GORENGAN', 'LAINNYA'].map(tipe => {
        const typeItems = items.filter((e: any) => {
          const match = e.notes?.match(/TIPE:\s*(MAKANAN|MINUMAN|GORENGAN|LAINNYA)/i);
          const t = match ? match[1].toUpperCase() : 'LAINNYA';
          return t === tipe;
        });
        return {
          tipe,
          items: typeItems,
          total: typeItems.reduce((a: number, c: any) => a + (Number(c.amount) || 0), 0)
        };
      }).filter(g => g.items.length > 0 && (summaryCategoryFilter === 'SEMUA' || !summaryCategoryFilter || g.tipe === summaryCategoryFilter));

      return {
        dateStr,
        groups: typeGroups,
        total: typeGroups.reduce((a, g) => a + g.total, 0)
      };
    }).filter(dg => dg.groups.length > 0);
  }, [expenses, isTataBoga, summaryCategoryFilter]);

  const displayTotal = useMemo(() => {
    if (!isTataBoga) return total;
    return groupedExpensesByDate.reduce((a, dg) => a + dg.total, 0);
  }, [total, groupedExpensesByDate, isTataBoga]);

  const renderExpenseRow = (e: any) => {
    const isEditing = editingId === e.id;
    return (
      <tr key={e.id} className="hover:bg-slate-50 transition-all font-medium">
        <td className="px-8 py-5 font-mono text-[10px] opacity-50">
          {e.date && (e.date as any).toDate ? (e.date as any).toDate().toLocaleDateString('id-ID') : '...'}
        </td>
        <td className="px-8 py-5">
          {isEditing ? (
            <input 
              type="text" 
              value={editForm.itemName} 
              onChange={(ev) => setEditForm({...editForm, itemName: ev.target.value})}
              className="bg-white border rounded px-3 py-1 font-black text-slate-700 uppercase"
            />
          ) : (
            <div className="font-black text-slate-700 uppercase tracking-tight">{e.itemName}</div>
          )}
        </td>
        <td className="px-8 py-5 text-right">
          {isEditing ? (
            <input 
              type="text" 
              value={formatRupiahUnit(editForm.amount)} 
              onChange={(ev) => {
                const cleanVal = ev.target.value.replace(/[^0-9]/g, '');
                setEditForm({...editForm, amount: Number(cleanVal)});
              }}
              className="w-32 bg-white border rounded px-3 py-1 text-right font-black text-rose-600"
            />
          ) : (
            <div className="font-black text-rose-600">Rp {e.amount.toLocaleString()}</div>
          )}
        </td>
        <td className="px-8 py-5">
          {isEditing ? (
            <input 
              type="text" 
              value={editForm.notes || ''} 
              onChange={(ev) => setEditForm({...editForm, notes: ev.target.value})}
              className="w-full bg-white border rounded px-3 py-1 text-slate-400 italic"
            />
          ) : (
            <div className="text-slate-400 italic text-[10px]">{e.notes || '—'}</div>
          )}
        </td>
        {isAdmin && (
          <td className="px-8 py-5">
            <div className="flex items-center justify-center gap-2">
               {isEditing ? (
                 <>
                   <button onClick={handleUpdate} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Simpan"><Check size={14} /></button>
                   <button onClick={cancelEdit} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Batal"><X size={14} /></button>
                 </>
               ) : (
                 <>
                   <button onClick={() => startEdit(e)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={14} /></button>
                   {confirmDeleteId === e.id ? (
                     <>
                       <button onClick={() => confirmDelete(e.id)} className="p-2 text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors" title="Yakin Hapus?"><Check size={14} /></button>
                       <button onClick={() => setConfirmDeleteId(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors" title="Batal Hapus"><X size={14} /></button>
                     </>
                   ) : (
                     <button onClick={() => setConfirmDeleteId(e.id)} className="p-2 text-slate-400 hover:text-white hover:bg-black rounded-lg transition-colors" title="Hapus"><Trash2 size={14} /></button>
                   )}
                 </>
               )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <table className="w-full text-left text-xs overflow-hidden">
      <thead className="bg-rose-50 text-rose-900 uppercase text-[9px] font-black tracking-[0.2em]">
        <tr>
          <th className="px-8 py-5">Waktu</th>
          <th className="px-8 py-5">Kategori Pengeluaran</th>
          <th className="px-8 py-5 text-right">Nominal</th>
          <th className="px-8 py-5">Memo Audit</th>
          {isAdmin && <th className="px-8 py-5 text-center">Aksi</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {expenses.length === 0 ? (
          <tr><td colSpan={isAdmin ? 5 : 4} className="px-8 py-20 text-center text-slate-300 font-bold uppercase tracking-widest italic">Tidak Ada Pengeluaran Terlapor</td></tr>
        ) : (
          isTataBoga ? (
            groupedExpensesByDate.map(dateGroup => (
              <Fragment key={dateGroup.dateStr}>
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="bg-slate-100 px-8 py-2 font-black text-slate-600 uppercase tracking-widest text-[10px]">
                    Tanggal: {dateGroup.dateStr} (Total Pengeluaran: Rp {dateGroup.total.toLocaleString()})
                  </td>
                </tr>
                {dateGroup.groups.map(group => (
                  <Fragment key={`${dateGroup.dateStr}-${group.tipe}`}>
                    <tr className="bg-rose-50/30">
                      <td colSpan={isAdmin ? 5 : 4} className="px-8 py-3 font-black text-rose-800 uppercase tracking-[0.15em] text-[9px]">
                        <span className="bg-white/60 px-2 py-1 border border-rose-100 rounded inline-block">KATEGORI: {group.tipe} (TOTAL: Rp {group.total.toLocaleString()})</span>
                      </td>
                    </tr>
                    {group.items.map(renderExpenseRow)}
                  </Fragment>
                ))}
              </Fragment>
            ))
          ) : (
            expenses.map(renderExpenseRow)
          )
        )}
      </tbody>
      {expenses.length > 0 && (
        <tfoot className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">
            <tr>
                <td colSpan={2} className="px-8 py-6">Total Pengeluaran {filterType === 'monthly' ? 'Bulanan' : 'Harian'}</td>
                <td className="px-8 py-6 text-right text-rose-400 text-sm">Rp {displayTotal.toLocaleString()}</td>
                <td className="px-8 py-6 opacity-30 text-right font-mono">HASH::{displayTotal}</td>
                {isAdmin && <td className="px-8 py-6"></td>}
            </tr>
        </tfoot>
      )}
    </table>
  );
}

function MonthlyRecapTable({ category, year }: any) {
  const [data, setData] = useState<any[]>([]);
  const [localTs, setLocalTs] = useState<any[]>([]);
  const [localEs, setLocalEs] = useState<any[]>([]);

  useEffect(() => {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const unsubT = sheetsdb.subscribeTransactions((allTs) => {
      const filtered = allTs.filter((t) => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= startOfYear && d <= endOfYear && t.categoryId === category.id;
      });
      setLocalTs(filtered);
    });

    const unsubE = sheetsdb.subscribeExpenses((allEs) => {
      const filtered = allEs.filter((e) => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= startOfYear && d <= endOfYear && e.categoryId === category.id;
      });
      setLocalEs(filtered);
    });

    return () => {
      unsubT();
      unsubE();
    };
  }, [category.id, year]);

  useEffect(() => {
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mTs = localTs.filter(t => {
        const d = t.date?.toDate?.() || (t.date instanceof Date ? t.date : new Date(t.date));
        return d && d.getMonth() === i;
      });
      const mEs = localEs.filter(e => {
        const d = e.date?.toDate?.() || (e.date instanceof Date ? e.date : new Date(e.date));
        return d && d.getMonth() === i;
      });
      const brute = mTs.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
      const expense = mEs.reduce((a, c) => a + (Number(c.amount) || 0), 0);
      return { month: i, bruto: brute, expense: expense, netto: brute - expense };
    });
    setData(monthly);
  }, [localTs, localEs]);

  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-100 text-slate-500 uppercase text-[9px] font-black tracking-[0.2em]">
        <tr>
          <th className="px-10 py-5">Bulan Fiskal</th>
          <th className="px-10 py-5 text-right">Pemasukan (Bruto)</th>
          <th className="px-10 py-5 text-right font-black text-rose-500">Pengeluaran</th>
          <th className="px-10 py-5 text-right font-black text-emerald-600">Pendapatan Bersih</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
        {data.map((m) => (
          <tr key={m.month} className="hover:bg-slate-50 transition-all">
            <td className="px-10 py-5 font-black text-slate-800 uppercase tracking-[0.2em]">{MONTHS[m.month]}</td>
            <td className="px-10 py-5 text-right">Rp {m.bruto.toLocaleString()}</td>
            <td className="px-10 py-5 text-right font-bold text-rose-500">Rp {m.expense.toLocaleString()}</td>
            <td className="px-10 py-5 text-right font-black text-emerald-600 bg-emerald-50/20">Rp {m.netto.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">
        <tr>
          <td className="px-10 py-8">Ringkasan Laba Rugi Tahunan</td>
          <td className="px-10 py-8 text-right font-mono opacity-70">Rp {data.reduce((a,c) => a + c.bruto, 0).toLocaleString()}</td>
          <td className="px-10 py-8 text-right text-rose-400">Rp {data.reduce((a,c) => a + c.expense, 0).toLocaleString()}</td>
          <td className="px-10 py-8 text-right text-emerald-400 text-lg border-l border-white/10">Rp {data.reduce((a,c) => a + c.netto, 0).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}
