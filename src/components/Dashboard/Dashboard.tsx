import { useState, useEffect } from 'react';
import { sheetsdb } from '../../lib/sheetsdb';
import { useCategories } from '../../lib/categoryStore';
import { Category, UserProfile, UserRole } from '../../types';
import { TrendingUp, TrendingDown, ShoppingCart, ArrowRight, PieChart, Wallet, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MONTHS } from '../../constants';

interface DashboardProps {
  userProfile: UserProfile | null;
  onTabChange: (tab: any) => void;
  onCategorySelect: (cat: Category) => void;
}

export default function Dashboard({ userProfile, onTabChange, onCategorySelect }: DashboardProps) {
  const CATEGORIES = useCategories();
  const [stats, setStats] = useState({ bruto: 0, expense: 0, netto: 0, bon: 0 });
  const [chartDataCategory, setChartDataCategory] = useState<any[]>([]);
  const [chartDataMonthly, setChartDataMonthly] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    let tsThisMonth: any[] = [];
    let esThisMonth: any[] = [];
    
    let tsThisYear: any[] = [];
    let esThisYear: any[] = [];

    const updateAggregates = () => {
      const bruto = tsThisMonth.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
      const expense = esThisMonth.reduce((a, c) => a + (Number(c.amount) || 0), 0);
      const bon = tsThisMonth.filter(t => t.paymentMethod === 'BON').reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
      setStats({ bruto, expense, netto: bruto - expense, bon });

      // Chart Data Category (current month)
      const catData = CATEGORIES.map(cat => {
        const catT = tsThisMonth.filter(t => t.categoryId === cat.id);
        const catE = esThisMonth.filter(e => e.categoryId === cat.id);
        const catBruto = catT.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
        const catExpense = catE.reduce((a, c) => a + (Number(c.amount) || 0), 0);
        return {
          name: cat.name,
          Pemasukan: catBruto,
          Pengeluaran: catExpense
        };
      });
      setChartDataCategory(catData);

      // Chart Data Monthly (current year)
      const monthlyData = MONTHS.map((monthName, idx) => {
        const tMonth = tsThisYear.filter(t => {
          const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
          return d.getMonth() === idx;
        });
        const eMonth = esThisYear.filter(e => {
          const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
          return d.getMonth() === idx;
        });
        
        const mBruto = tMonth.reduce((a, c) => a + (Number(c.totalPrice) || 0), 0);
        const mExpense = eMonth.reduce((a, c) => a + (Number(c.amount) || 0), 0);
        return {
          name: monthName.substring(0, 3),
          Bersih: mBruto - mExpense
        };
      });
      setChartDataMonthly(monthlyData);
    };

    const unsubT = sheetsdb.subscribeTransactions((allTs) => {
      tsThisYear = allTs.filter(t => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= startOfYear && d <= endOfYear;
      });
      tsThisMonth = tsThisYear.filter(t => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return d >= startOfMonth && d <= endOfMonth;
      });
      updateAggregates();
    });

    const unsubE = sheetsdb.subscribeExpenses((allEs) => {
      esThisYear = allEs.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= startOfYear && d <= endOfYear;
      });
      esThisMonth = esThisYear.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        return d >= startOfMonth && d <= endOfMonth;
      });
      updateAggregates();
    });

    return () => { unsubT(); unsubE(); };
  }, [CATEGORIES]);

  return (
    <div className="space-y-6">
      <div className="bg-[#01261c] rounded-3xl p-6 sm:p-10 text-white shadow-2xl overflow-hidden relative border border-[#033427]/40">
        <div className="relative z-10 lg:w-2/3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F2B63E] animate-pulse"></div>
            <h2 className="text-[#8bb2a1] text-[10px] font-black uppercase tracking-[0.4em]">Official Terminal</h2>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black mb-4 leading-tight uppercase tracking-tight">INKOPASINDO KELAS IIB KETAPANG</h1>
          <p className="text-[#a5c4b5] text-xs max-w-lg mb-8 sm:mb-10 leading-relaxed font-bold uppercase tracking-widest opacity-80">
            Sistem manajemen keuangan terintegrasi v4.0. Akses POS Unit dan Laporan Pertanggungjawaban dalam satu dashboard terpadu.
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <button 
              onClick={() => onTabChange('neraca')}
              className="bg-[#F2B63E] text-slate-950 px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#e0a22d] transition-all shadow-xl shadow-[#F2B63E]/10 flex items-center gap-2 sm:gap-3 group"
            >
              <PieChart size={16} /> Konsol Neraca Utama
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>

            {userProfile?.role === UserRole.ADMIN && (
              <button 
                onClick={() => onTabChange('usermanagement')}
                className="bg-[#064232] text-[#a5c4b5] px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#0c5945] hover:text-white transition-all border border-[#0d503e]/30 flex items-center gap-2 sm:gap-3 group"
              >
                <Users size={16} /> Manajemen User
              </button>
            )}
          </div>
        </div>
        <div className="absolute -bottom-20 -right-20 opacity-5 pointer-events-none hidden lg:block scale-150">
          <TrendingUp size={400} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatSummaryCard title="Pendapatan Bruto (Live)" value={stats.bruto.toLocaleString()} color="blue" />
        <StatSummaryCard title="Total Pengeluaran" value={stats.expense.toLocaleString()} color="rose" isDown />
        <StatSummaryCard title="Pendapatan Bersih" value={stats.netto.toLocaleString()} color="emerald" />
        <StatSummaryCard title="Piutang (Bon)" value={stats.bon.toLocaleString()} color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-[12px] font-bold text-slate-700 mb-6 font-sans">Arus Kas per Kategori &mdash; Bulan Ini</h3>
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
          <h3 className="text-[12px] font-bold text-slate-700 mb-6 font-sans">Tren Bulanan (Tahun Ini)</h3>
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

      <div className="pt-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Unit Usaha Primkopasindo</h3>
          <div className="h-px bg-slate-200 flex-1 ml-8"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat)}
              className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-2xl hover:border-blue-400 hover:-translate-y-2 transition-all group text-left relative overflow-hidden"
            >
              <div className={`w-14 h-14 rounded-2xl ${cat.color} flex items-center justify-center text-white mb-8 shadow-xl shadow-slate-100 group-hover:scale-110 transition-transform`}>
                <span className="font-black text-2xl">{cat.name.charAt(0)}</span>
              </div>
              <h4 className="font-black text-slate-800 text-xl group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none mb-2">{cat.name}</h4>
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.2em] opacity-60">Terminal Kasir v1</p>
              
              <div className="mt-10 pt-6 border-t border-slate-50 flex items-center justify-between">
                 <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all">Buka Terminal POS</span>
                 <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    <ArrowRight size={14} />
                 </div>
              </div>
              <div className={`absolute -top-10 -right-10 w-32 h-32 ${cat.color} opacity-0 group-hover:opacity-[0.03] rounded-full transition-opacity transition-transform duration-500 group-hover:scale-150`}></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatSummaryCard({ title, value, color, isDown }: { title: string, value: string, color: string, isDown?: boolean }) {
  const colorMap: any = {
    blue: 'text-blue-600 bg-blue-50',
    rose: 'text-rose-600 bg-rose-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    orange: 'text-orange-600 bg-orange-50'
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-3">{title}</p>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] font-black text-slate-400 mr-1 opacity-50 uppercase">IDR</span>
          <span className={`text-2xl font-black tracking-tighter ${isDown ? 'text-rose-600' : 'text-slate-900'}`}>{value}</span>
        </div>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {isDown ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
        </div>
      </div>
    </div>
  );
}
