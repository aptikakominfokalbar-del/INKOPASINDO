import { LayoutDashboard, Wallet, Receipt, FileText, PieChart, ChevronRight, Shield, Users, UtensilsCrossed, CupSoda, Store, Cookie, Snowflake, Shirt } from 'lucide-react';
import { useCategories } from '../../lib/categoryStore';
import { Category, UserProfile, UserRole } from '../../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  selectedCategory: Category;
  setSelectedCategory: (cat: Category) => void;
  userProfile: UserProfile | null;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  selectedCategory, 
  setSelectedCategory, 
  userProfile,
  mobileMenuOpen = false,
  setMobileMenuOpen,
  sidebarCollapsed = false,
  setSidebarCollapsed
}: SidebarProps) {
  const CATEGORIES = useCategories();
  const handleNavClick = (tab: any) => {
    setActiveTab(tab);
    if (setMobileMenuOpen) setMobileMenuOpen(false);
  };

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'tata-boga':
        return <UtensilsCrossed size={16} />;
      case 'warteg':
        return <Store size={16} />;
      case 'es-kristal':
        return <Snowflake size={16} />;
      case 'laundry':
        return <Shirt size={16} />;
      case 'pemasukan-lain':
        return <Wallet size={16} />;
      default:
        return <Wallet size={16} />;
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen?.(false)}
          className="fixed inset-0 bg-[#01140e]/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 animate-fade-in"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-[#01261c] flex flex-col text-[#a5c4b5] border-r border-[#033427]/40 z-50
        transition-all duration-300 ease-in-out h-full
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'md:-translate-x-full md:absolute' : 'md:translate-x-0 md:relative md:flex shrink-0'}
      `}>
        <div className="p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-[#F2B63E] rounded-lg flex items-center justify-center font-black text-black shadow-md shrink-0">IK</div>
            <div className="truncate">
              <h1 className="text-sm font-black text-white leading-tight truncate">INKOPASINDO</h1>
              <p className="text-[10px] text-[#8bb2a1] uppercase tracking-wider font-extrabold truncate">KELAS IIB KETAPANG</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Collapse desktop sidebar */}
            <button 
              onClick={() => setSidebarCollapsed?.(true)}
              className="hidden md:flex p-1.5 text-[#a5c4b5] hover:text-white rounded-lg hover:bg-[#064232]/50 transition-colors"
              title="Sembunyikan Sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                <path d="M16 15l-3-3 3-3" />
              </svg>
            </button>
            {/* Close menu for mobile screens inside header */}
            <button 
              onClick={() => setMobileMenuOpen?.(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#064232]/50"
            >
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 select-none">
          <div className="px-6 py-2 text-[#8bb2a1] text-[9px] tracking-[0.2em] font-black uppercase mb-1.5 opacity-60">UTAMA</div>
          
          <SidebarNavItem 
            icon={<LayoutDashboard size={16} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => handleNavClick('dashboard')} 
          />
          
          <SidebarNavItem 
            icon={<PieChart size={16} />} 
            label="Neraca LPJ" 
            active={activeTab === 'neraca'} 
            onClick={() => handleNavClick('neraca')} 
          />

          {userProfile?.role === UserRole.ADMIN && (
            <>
              <SidebarNavItem 
                icon={<Users size={16} />} 
                label="Manajemen User" 
                active={activeTab === 'usermanagement'} 
                onClick={() => handleNavClick('usermanagement')} 
              />
              <SidebarNavItem 
                icon={<Store size={16} />} 
                label="Kelola Kategori" 
                active={activeTab === 'categories'} 
                onClick={() => handleNavClick('categories')} 
              />
            </>
          )}

          <div className="px-6 py-2 text-[#8bb2a1] text-[9px] tracking-[0.2em] font-black uppercase mt-5 mb-1.5 opacity-60">UNIT USAHA</div>

          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="px-3.5 my-1">
              <button
                onClick={() => {
                  setSelectedCategory(cat);
                  if (activeTab === 'dashboard' || activeTab === 'neraca') {
                    setActiveTab('cashier');
                  }
                  if (setMobileMenuOpen) setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between py-2.5 px-3 transition-all duration-200 rounded-xl ${
                  selectedCategory.id === cat.id && (activeTab !== 'dashboard' && activeTab !== 'neraca')
                    ? 'bg-[#064232] text-white shadow-xs font-bold'
                    : 'text-[#a5c4b5] hover:bg-[#064232]/30 hover:text-white font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getCategoryIcon(cat.id)}
                  <span className="text-[11px] truncate uppercase tracking-widest">{cat.name}</span>
                </div>
                {selectedCategory.id === cat.id && (activeTab !== 'dashboard' && activeTab !== 'neraca') && <ChevronRight size={12} />}
              </button>
            </div>
          ))}

          <div className="px-6 py-2 text-[#8bb2a1] text-[9px] tracking-[0.2em] font-black uppercase mt-5 mb-1.5 opacity-60">OPERASI {selectedCategory.name}</div>
          <SidebarNavItem 
            icon={<Receipt size={16} />} 
            label="Kasir / POS" 
            active={activeTab === 'cashier'} 
            onClick={() => handleNavClick('cashier')} 
          />
          <SidebarNavItem 
            icon={<Wallet size={16} />} 
            label="Pengeluaran" 
            active={activeTab === 'expense'} 
            onClick={() => handleNavClick('expense')} 
          />
          <SidebarNavItem 
            icon={<FileText size={16} />} 
            label="Laporan Harian" 
            active={activeTab === 'reports'} 
            onClick={() => handleNavClick('reports')} 
          />
        </nav>

        <div className="p-6 pt-4 text-[9px] text-[#a5c4b5]/40 font-mono tracking-wider uppercase">
          SYSTEM VERSION 2.4.0-STABLE
        </div>
      </aside>
    </>
  );
}

function SidebarNavItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <div className="px-3.5 my-1">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 py-2.5 px-3 transition-all duration-200 rounded-xl outline-none ${
          active 
            ? 'bg-[#064232] text-white shadow-xs font-bold' 
            : 'text-[#a5c4b5] hover:bg-[#064232]/30 hover:text-white font-medium'
        }`}
      >
        {icon}
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </button>
    </div>
  );
}
