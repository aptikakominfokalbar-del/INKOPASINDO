import React, { useState } from 'react';
import { Bell, User, Search, Menu, FileText, FileSpreadsheet, Database, X } from 'lucide-react';
import { Category, UserProfile } from '../../types';
import { APPS_SCRIPT_WEB_APP_URL } from '../../config';

interface HeaderProps {
  activeTab: string;
  selectedCategory: Category;
  userProfile: UserProfile | null;
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
  onLogout?: () => void;
}

export default function Header({ 
  activeTab, 
  selectedCategory, 
  userProfile, 
  onMenuClick,
  sidebarCollapsed = false,
  setSidebarCollapsed,
  onLogout
}: HeaderProps) {
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbUrl, setDbUrl] = useState(() => APPS_SCRIPT_WEB_APP_URL || localStorage.getItem('APPS_SCRIPT_URL') || '');

  const handleSaveDb = () => {
    if (APPS_SCRIPT_WEB_APP_URL) {
      setShowDbModal(false);
      return;
    }
    if (dbUrl.includes('docs.google.com/spreadsheets')) {
      alert('Maaf, ini adalah URL Google Spreadsheet, bukan URL Apps Script Web App. Silahkan salin URL dari hasil deploy Apps Script Anda (yang berakhiran dengan /exec).');
      return;
    }
    localStorage.setItem('APPS_SCRIPT_URL', dbUrl);
    window.location.reload();
  };
  const getSubTitle = () => {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const d = new Date();
    return `Neraca Keuangan Kelas IIB Ketapang • Periode: ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Beranda Dashboard';
      case 'neraca': return 'Laporan Pertanggungjawaban (LPJ)';
      case 'cashier': return `Input Kasir: ${selectedCategory.name}`;
      case 'expense': return `Input Pengeluaran: ${selectedCategory.name}`;
      case 'reports': return `Laporan Unit: ${selectedCategory.name}`;
      default: return 'INKOPASINDO';
    }
  };

  const triggerExport = (type: 'excel' | 'pdf') => {
    window.dispatchEvent(new CustomEvent('app-export', { detail: { type } }));
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10 animate-fade-in-down">
      <div className="flex items-center gap-3 md:gap-4 overflow-hidden min-w-0">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          aria-label="Buka Menu"
        >
          <Menu size={22} strokeWidth={2.5} />
        </button>
        
        {/* Toggle desktop sidebar when collapsed */}
        {sidebarCollapsed && (
          <button 
            onClick={() => setSidebarCollapsed?.(false)}
            className="hidden md:flex p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all mr-1"
            title="Tampilkan Sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="M12 9l3 3-3 3" />
            </svg>
          </button>
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-sm sm:text-base md:text-xl font-black text-slate-800 leading-none uppercase tracking-wide truncate">{getTitle()}</h2>
          <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate max-w-[200px] xs:max-w-[280px] sm:max-w-none">{getSubTitle()}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6 shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2">
          <button 
            id="btn-export-excel"
            onClick={() => triggerExport('excel')}
            className="px-2.5 md:px-4 py-2 bg-emerald-600 text-white text-[8px] md:text-[9px] uppercase tracking-wider md:tracking-[0.2em] font-black rounded-xl shadow-lg shadow-emerald-500/10 hover:bg-emerald-700 transition-all flex items-center gap-1 md:gap-2"
            title="Ekspor ke Excel"
          >
            <FileSpreadsheet size={13} /> 
            <span className="hidden sm:inline">Ekspor Excel</span>
          </button>
          <button 
            onClick={() => triggerExport('pdf')}
            className="px-2.5 md:px-4 py-2 bg-slate-900 text-white text-[8px] md:text-[9px] uppercase tracking-wider md:tracking-[0.2em] font-black rounded-xl shadow-lg shadow-slate-200 hover:bg-black transition-all flex items-center gap-1 md:gap-2"
            title="Ekspor ke PDF"
          >
            <FileText size={13} /> 
            <span className="hidden sm:inline">Ekspor PDF</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 border-l border-slate-200 pl-3 md:pl-6 h-10">
          <button
            onClick={() => setShowDbModal(true)}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 md:py-2 md:px-4 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-colors border border-emerald-200 mr-1 md:mr-2 cursor-pointer"
            title="Pengaturan Database Apps Script"
          >
             <Database size={14} className="md:w-4 md:h-4" />
             <span className="hidden sm:inline">Set Database</span>
          </button>
          
          <div className="hidden lg:block text-right">
             <p className="text-xs font-black text-slate-800 leading-none uppercase tracking-tight">{userProfile?.displayName || 'Admin Sistem'}</p>
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{userProfile?.role || 'SISTEM'}</p>
          </div>
          
          <button onClick={onLogout} className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all cursor-pointer" title="Keluar">
             <User size={16} />
          </button>
        </div>
      </div>

      {showDbModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative animate-fade-in-up">
            <button 
              onClick={() => setShowDbModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-2">Set Database Apps Script</h2>
                <p className="text-xs font-medium text-slate-500">Hubungkan aplikasi dengan Google Apps Script Web App URL.</p>
              </div>
            </div>
            <div className="space-y-4">
              {APPS_SCRIPT_WEB_APP_URL && (
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-xs font-medium border border-emerald-200">
                  URL Apps Script telah diatur di dalam file <span className="font-bold">src/config.ts</span> secara global untuk semua komputer.
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Apps Script URL</label>
                <input 
                  type="text" 
                  value={dbUrl}
                  onChange={e => setDbUrl(e.target.value)}
                  disabled={!!APPS_SCRIPT_WEB_APP_URL}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono disabled:opacity-50"
                />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  onClick={() => setShowDbModal(false)}
                  className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  {APPS_SCRIPT_WEB_APP_URL ? 'Tutup' : 'Batal'}
                </button>
                {!APPS_SCRIPT_WEB_APP_URL && (
                  <button 
                    onClick={handleSaveDb}
                    className="px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all"
                  >
                    Simpan URL
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
