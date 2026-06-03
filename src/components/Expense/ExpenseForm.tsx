import { useState, FormEvent } from 'react';
import { sheetsdb } from '../../lib/sheetsdb';
import { Category, UserProfile, UserRole } from '../../types';
import { Save, RefreshCw, AlertCircle, TrendingDown, CheckCircle2, Lock, Calendar } from 'lucide-react';

interface ExpenseFormProps {
  category: Category;
  userProfile: UserProfile | null;
}

const formatRupiahUnit = (num: number | string) => {
  if (num === undefined || num === null || num === '') return '';
  const numStr = num.toString().replace(/[^0-9]/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function ExpenseForm({ category, userProfile }: ExpenseFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const getLocalDateString = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const isViewOnly = userProfile?.role === UserRole.VIEW;

  const [itemName, setItemName] = useState('');
  const [expenseType, setExpenseType] = useState('MAKANAN');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(getLocalDateString());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName || amount <= 0) {
      setError('Mohon isi nama pengeluaran dan jumlah nominal.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create date at noon
      const selectedDate = new Date(expenseDate);
      selectedDate.setHours(12, 0, 0, 0);

      const finalNotes = category.id === 'tata-boga' 
        ? (notes ? `TIPE: ${expenseType} • ${notes}` : `TIPE: ${expenseType}`)
        : notes;

      const expenseData = {
        categoryId: category.id,
        date: { toDate: () => selectedDate },
        itemName,
        amount,
        notes: finalNotes,
        authorId: userProfile?.uid || ''
      };

      await sheetsdb.addExpense(expenseData);
      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError('Gagal menyimpan pengeluaran: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItemName('');
    setExpenseType('MAKANAN');
    setAmount(0);
    setNotes('');
    setExpenseDate(getLocalDateString());
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-rose-500 h-1.5"></div>
        <div className="p-5 sm:p-8 md:p-10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
                <TrendingDown size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Input Pengeluaran</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{category.name}</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-900 rounded-xl text-[9px] font-black text-white uppercase tracking-widest">
              Formulir Aman
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              {category.id === 'tata-boga' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Kategori Pengeluaran</label>
                  <select
                    value={expenseType}
                    onChange={(e) => setExpenseType(e.target.value)}
                    className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all text-lg font-bold text-slate-700 appearance-none"
                  >
                    <option value="MAKANAN">Makanan</option>
                    <option value="MINUMAN">Minuman</option>
                    <option value="GORENGAN">Gorengan</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Jenis Pengeluaran / Belanja</label>
                  <input 
                    type="text" 
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Contoh: Belanja Sayur, Gas, Listrik..."
                    className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all text-lg font-bold text-slate-700 placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tanggal Pengeluaran</label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Calendar size={18} />
                    </div>
                    <input 
                      type="date" 
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold text-slate-700 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nominal Pengeluaran (Rp)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">Rp</span>
                  <input 
                    type="text" 
                    value={formatRupiahUnit(amount)}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                      setAmount(parseFloat(cleanVal) || 0);
                    }}
                    placeholder="0"
                    className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-6 border border-slate-200 bg-slate-50 rounded-2xl focus:border-rose-500 outline-none transition-all text-2xl sm:text-4xl font-black text-rose-600 tracking-tighter"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Catatan Tambahan</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-6 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-rose-500 transition-all font-medium text-slate-700"
                ></textarea>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                disabled={loading || isViewOnly}
                className={`w-full bg-slate-900 text-white font-black uppercase text-xs tracking-[0.3em] py-6 rounded-3xl hover:bg-black shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${isViewOnly ? 'cursor-not-allowed' : ''}`}
              >
                {isViewOnly ? <Lock size={20} /> : (loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />)}
                {isViewOnly ? 'View Only (Tidak Bisa Input)' : 'Simpan Record Pengeluaran'}
              </button>
            </div>

            {success && (
              <div className="p-5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
                <CheckCircle2 size={24} className="text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest">Entry Berhasil Disimpan Ke Database</span>
              </div>
            )}

            {error && (
              <div className="p-5 bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl flex items-center gap-4">
                <AlertCircle size={24} />
                <span className="text-xs font-black uppercase tracking-widest">{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 text-center space-y-2">
        <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">Pemotongan Otomatis</h5>
        <p className="text-xs text-slate-500 font-medium">Data pengeluaran akan secara otomatis memotong Pendapatan Bruto pada Laporan Akhir Unit.</p>
      </div>
    </div>
  );
}
