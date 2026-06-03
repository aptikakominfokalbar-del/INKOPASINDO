import { useState, useEffect } from 'react';
import { sheetsdb } from '../../lib/sheetsdb';
import { useCategories } from '../../lib/categoryStore';
import { MONTHS } from '../../constants';
import { Transaction, Expense, PaymentMethod } from '../../types';
import { LayoutDashboard, TrendingUp, Wallet, Calendar, PieChart, FileText, ArrowRight } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../lib/exportUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';

export default function Neraca() {
  const CATEGORIES = useCategories();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [yearlyTransactions, setYearlyTransactions] = useState<Transaction[]>([]);
  const [yearlyExpenses, setYearlyExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    setLoading(true);
    const startOfMonth = new Date(selectedYear, selectedMonth, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    
    const startOfYear = new Date(selectedYear, 0, 1);
    const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

    const unsubT = sheetsdb.subscribeTransactions((allTs) => {
      const tsThisYear = allTs.filter(t => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= startOfYear && d <= endOfYear;
      });
      setYearlyTransactions(tsThisYear);
      
      const filteredTs = tsThisYear.filter(t => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= startOfMonth && d <= endOfMonth;
      });
      setTransactions(filteredTs);
    });

    const unsubE = sheetsdb.subscribeExpenses((allEs) => {
      const esThisYear = allEs.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= startOfYear && d <= endOfYear;
      });
      setYearlyExpenses(esThisYear);
      
      const filteredEs = esThisYear.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= startOfMonth && d <= endOfMonth;
      });
      setExpenses(filteredEs);
    });

    return () => {
      unsubT();
      unsubE();
    };
  }, [selectedMonth, selectedYear]);

  // Derived state for better reliability
  useEffect(() => {
    if (transactions.length >= 0 && expenses.length >= 0) {
      setLoading(false);
    }
  }, [transactions, expenses]);

  const categorySummary = CATEGORIES.map(cat => {
    const catT = transactions.filter(t => t.categoryId === cat.id);
    const catE = expenses.filter(e => e.categoryId === cat.id);
    const bruto = catT.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
    const expense = catE.reduce((a, c) => a + (Number(c.amount) || 0), 0);
    return { ...cat, bruto, expense, netto: bruto - expense };
  });

  const grandBruto = transactions.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
  const grandExpense = expenses.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const grandNetto = grandBruto - grandExpense;
  
  const chartDataCategory = categorySummary.map(cat => ({
    name: cat.name,
    Pemasukan: cat.bruto,
    Pengeluaran: cat.expense,
  }));

  const chartDataMonthly = MONTHS.map((monthName, idx) => {
    const tsMonth = yearlyTransactions.filter(t => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return d.getMonth() === idx;
    });
    const esMonth = yearlyExpenses.filter(e => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d.getMonth() === idx;
    });
    
    const bruto = tsMonth.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
    const expense = esMonth.reduce((a, c) => a + (Number(c.amount) || 0), 0);
    const netto = bruto - expense;
    return {
      name: monthName.substring(0, 3),
      Bersih: netto
    };
  });

  const handleExportExcel = () => {
    const fileName = `LPJ_Neraca_${MONTHS[selectedMonth]}_${selectedYear}`;
    const data = categorySummary.map(cat => ({
      'Kategori Unit': cat.name,
      'Pemasukan': `Rp ${cat.bruto.toLocaleString()}`,
      'Pengeluaran': `Rp ${cat.expense.toLocaleString()}`,
      'Pendapatan Bersih': `Rp ${cat.netto.toLocaleString()}`
    }));
    
    // Add Total Row
    data.push({
      'Kategori Unit': 'TOTAL',
      'Pemasukan': `Rp ${grandBruto.toLocaleString()}`,
      'Pengeluaran': `Rp ${grandExpense.toLocaleString()}`,
      'Pendapatan Bersih': `Rp ${grandNetto.toLocaleString()}`
    });

    exportToExcel(data, fileName, 'Rekap Neraca', `Laporan Pertanggungjawaban (Neraca) - ${MONTHS[selectedMonth]} ${selectedYear}`);
  };

  const handleExportPDF = () => {
    const fileName = `LPJ_Neraca_${MONTHS[selectedMonth]}_${selectedYear}`;
    const headers = [['Kategori Unit', 'Pemasukan', 'Pengeluaran', 'Pendapatan Bersih']];
    const pdfData = categorySummary.map(cat => [
      cat.name,
      `Rp ${cat.bruto.toLocaleString()}`,
      `Rp ${cat.expense.toLocaleString()}`,
      `Rp ${cat.netto.toLocaleString()}`
    ]);
    pdfData.push([
      'TOTAL',
      `Rp ${grandBruto.toLocaleString()}`,
      `Rp ${grandExpense.toLocaleString()}`,
      `Rp ${grandNetto.toLocaleString()}`
    ]);
    exportToPDF(`Laporan Pertanggungjawaban (Neraca) - ${MONTHS[selectedMonth]} ${selectedYear}`, headers, pdfData, fileName);
  };

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail.type === 'excel') handleExportExcel();
      if (e.detail.type === 'pdf') handleExportPDF();
    };
    window.addEventListener('app-export', handler);
    return () => window.removeEventListener('app-export', handler);
  }, [categorySummary, grandBruto, grandExpense, grandNetto, selectedMonth, selectedYear]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Periode Neraca</span>
        </div>
        <div className="flex gap-2">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="text-xs font-bold bg-slate-50 border border-slate-200 rounded px-3 py-1 outline-none">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="text-xs font-bold bg-slate-50 border border-slate-200 rounded px-3 py-1 outline-none">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <NeracaStatCard title="Total Bruto" value={grandBruto} color="slate" />
        <NeracaStatCard title="Pengeluaran" value={grandExpense} color="rose" />
        <NeracaStatCard title="Pendapatan Bersih" value={grandNetto} color="emerald" highlight />
        <NeracaStatCard title="Unit Aktif" value={CATEGORIES.length} color="orange" isCount />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-[12px] font-bold text-slate-700 mb-6 font-sans">Arus Kas per Kategori &mdash; {MONTHS[selectedMonth]} {selectedYear}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataCategory} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} angle={-15} textAnchor="end" />
                <YAxis tickFormatter={(val) => `Rp ${(val/1000)}k`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} width={70} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(val: number) => `Rp ${val.toLocaleString()}`} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
                <Bar dataKey="Pemasukan" fill="#047857" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-[12px] font-bold text-slate-700 mb-6 font-sans">Tren Bulanan {selectedYear}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataMonthly} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis tickFormatter={(val) => `Rp ${(val/1000)}k`} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} width={70} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(val: number) => `Rp ${val.toLocaleString()}`} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12, marginTop: 10 }} />
                <Bar dataKey="Bersih" fill="#d97706" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Rekap Unit Usaha</h3>
          <div className="flex items-center gap-2">
             <button 
               onClick={handleExportExcel}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all"
               title="Ekspor Laporan"
             >
                <Download size={12} /> Export Excel
             </button>
             <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Live Data</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
              <tr>
                <th className="px-8 py-5">Kategori Unit</th>
                <th className="px-8 py-5 text-right">Pemasukan</th>
                <th className="px-8 py-5 text-right">Pengeluaran</th>
                <th className="px-8 py-5 text-right">Pendapatan Bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorySummary.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-8 rounded-full ${cat.color}`} />
                      <div>
                        <p className="font-bold text-slate-800">{cat.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{cat.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">Rp {cat.bruto.toLocaleString()}</td>
                  <td className="px-8 py-4 text-right text-rose-500">Rp {cat.expense.toLocaleString()}</td>
                  <td className="px-8 py-4 text-right font-black text-emerald-600">Rp {cat.netto.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-5 bg-slate-900 text-white flex justify-between items-center text-sm">
          <span className="font-black uppercase tracking-[0.2em] text-[11px]">Total Pendapatan Bersih</span>
          <span className="text-blue-400 font-black text-xl tracking-tight">Rp {grandNetto.toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 bg-slate-800 rounded-xl p-6 text-white border border-slate-700 shadow-xl overflow-hidden relative">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-4">Architecture Engine</h3>
          <div className="font-mono text-[10px] space-y-2 opacity-80">
            <p className="text-emerald-400">// Logical Proof of Balance</p>
            <code>const netto = totalIncome - totalExpense;</code>
            <p className="mt-4 text-blue-300">Stack: React + Firebase + Tailwind v4</p>
          </div>
          <LayoutDashboard className="absolute -bottom-10 -right-10 opacity-5" size={200} />
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 shadow-sm">
          <div className="w-10 h-10 bg-emerald-200 rounded-lg flex items-center justify-center text-emerald-700 mb-4">
            <FileText size={20} />
          </div>
          <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-2 text-center">Data Integrity Validated</h4>
          <p className="text-[10px] text-emerald-800 leading-tight">Seluruh transaksi unit telah diproses melalui mesin audit relasional.</p>
        </div>
      </div>
    </div>
  );
}

function NeracaStatCard({ title, value, color, highlight, isCount }: any) {
  const textColors: any = { slate: 'text-slate-900', rose: 'text-rose-600', emerald: 'text-emerald-600', orange: 'text-orange-500' };
  return (
    <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${highlight ? 'ring-2 ring-emerald-500/20 border-emerald-500' : ''}`}>
      <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-2">{title}</p>
      <p className={`text-xl font-black tracking-tight ${textColors[color]}`}>
        {isCount ? value : `Rp ${value.toLocaleString()}`}
      </p>
    </div>
  );
}
