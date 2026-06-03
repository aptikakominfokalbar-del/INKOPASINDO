import { useState } from 'react';
import { UserProfile, UserRole } from '../../types';
import { Eye, EyeOff } from 'lucide-react';
import { sheetsdb } from '../../lib/sheetsdb';

interface LoginProps {
  onLoginSuccess: (profile: UserProfile, isRegistering: boolean) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
       // Simulate loading for better UX
       await new Promise(resolve => setTimeout(resolve, 500));

       if (isRegister) {
          // Register Mode (Local & DB)
          if (!form.name || !form.email || !form.password) {
             throw new Error("Semua kolom harus diisi.");
          }
          
          const safeEmail = form.email.trim().toLowerCase();
          const uid = 'local-' + Math.random().toString(36).substr(2, 9);
          
          const localCreds = JSON.parse(localStorage.getItem('inkopasindo_local_creds') || '{}');
          if (localCreds[safeEmail]) throw new Error("Email sudah terdaftar di perangkat ini.");
          
          // Save locally
          localCreds[safeEmail] = { password: form.password, name: form.name, uid };
          localStorage.setItem('inkopasindo_local_creds', JSON.stringify(localCreds));

          const newProfile: UserProfile = {
             uid,
             email: safeEmail,
             displayName: form.name,
             role: UserRole.CASHIER,
             status: 'Active',
             createdAt: { toDate: () => new Date() }
          };
          onLoginSuccess(newProfile, true);

       } else {
          // Login Mode
          if (!form.email || !form.password) {
             throw new Error("Email dan Password harus diisi.");
          }
          
          let uid = '';
          let displayName = 'Pengguna';
          let role = UserRole.ADMIN;
          
          const safeEmail = (form.email || '').trim().toLowerCase();
          const safePassword = form.password;

          // 1. Check Super Admin
          if (safeEmail === 'admin@inkopasindo.local' && safePassword === 'admin123') {
             uid = 'admin-local';
             displayName = 'Admin Sistem';
          } else {
            // 2. Check Local Registered Users
            const localCreds = JSON.parse(localStorage.getItem('inkopasindo_local_creds') || '{}');
            const stored = localCreds[safeEmail];
            
            if (stored && stored.password === safePassword) {
                uid = stored.uid;
                displayName = stored.name;
            } else {
                // 3. Fallback: Check if user exists in Database (Google Sheets) via Admin creation
                const existingUser = sheetsdb.getUsersList().find((u: any) => u.email === safeEmail);
                
                if (existingUser) {
                    if (safePassword === '123456' || safePassword === 'admin123') {
                        uid = existingUser.uid;
                        displayName = existingUser.displayName;
                        role = existingUser.role;
                    } else {
                        throw new Error("Sandi salah. Gunakan sandi '123456' jika akun dibuat oleh admin di sistem.");
                    }
                } else {
                    throw new Error("Login gagal. Email tidak terdaftar atau kata sandi salah.");
                }
            }
          }

          const loggedProfile: UserProfile = {
             uid,
             email: safeEmail,
             displayName: displayName,
             role: role,
             status: 'Active',
             createdAt: { toDate: () => new Date() }
          };
          
          onLoginSuccess(loggedProfile, false);
       }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1ebd9] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.05)] border border-slate-100 p-8 sm:p-10 animate-fade-in-up">
        
        <div className="flex flex-col items-center mb-8">
           <div className="w-16 h-16 bg-[#015335] text-white rounded-full flex items-center justify-center text-xl font-bold mb-4 shadow-md">
             IK
           </div>
           <h1 className="text-xl sm:text-2xl font-bold text-slate-800 text-center uppercase tracking-tight mb-1">
             INKOPASINDO Ketapang
           </h1>
           <p className="text-sm text-slate-500 font-medium text-center">
             Kasir & Manajemen Keuangan Koperasi
           </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {isRegister && (
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-800">Nama Lengkap</label>
              <input 
                type="text" 
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#015335]/20 focus:border-[#015335] transition-all"
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">Email</label>
            <input 
              type="email" 
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#015335]/20 focus:border-[#015335] transition-all"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">Kata Sandi</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-12 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#015335]/20 focus:border-[#015335] transition-all"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#015335] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#01422a] transition-all disabled:opacity-50 mt-6"
          >
            {loading ? 'Memproses...' : (isRegister ? 'Daftar' : 'Masuk')}
          </button>
        </form>

        {!isRegister && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] text-slate-500 font-medium">Akun Admin Default (Lokal):</p>
            <p className="text-xs font-bold text-slate-700">admin@inkopasindo.local / admin123</p>
          </div>
        )}

        <div className="mt-6 text-center text-sm font-medium text-slate-500">
           {isRegister ? (
             <p>Sudah punya akun? <button type="button" onClick={() => {setIsRegister(false); setError('');}} className="text-[#015335] font-bold hover:underline">Masuk</button></p>
           ) : (
             <p>Belum punya akun? <button type="button" onClick={() => {setIsRegister(true); setError('');}} className="text-[#015335] font-bold hover:underline">Daftar di sini</button></p>
           )}
        </div>

      </div>
    </div>
  );
}
