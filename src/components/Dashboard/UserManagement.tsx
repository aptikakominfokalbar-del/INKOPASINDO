import { useState, useEffect } from 'react';
import { sheetsdb } from '../../lib/sheetsdb';
import { UserProfile, UserRole } from '../../types';
import { Users, Shield, UserCheck, UserX, Trash2, Mail, Calendar, Settings } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = sheetsdb.subscribeUsers((usersList) => {
      // Deduplicate by uid first
      const uniqueUsersMap = new Map<string, UserProfile>();
      usersList.forEach(u => uniqueUsersMap.set(u.uid, u));
      const uniqueUsersList = Array.from(uniqueUsersMap.values());

      // Sort desc by createdAt
      const sorted = [...uniqueUsersList].sort((a, b) => {
        const ad = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bd = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bd - ad;
      });
      setUsers(sorted);
      setLoading(false);
    });

    return unsub;
  }, []);

  const updateRole = async (uid: string, newRole: UserRole) => {
    try {
      await sheetsdb.updateUser(uid, {
        role: newRole
      });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await sheetsdb.updateUser(user.uid, {
        status: newStatus
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#064232]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen User</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">Kelola akun dan sistem Role-Based Access Control (RBAC)</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-slate-400" />
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Daftar Pengguna</h3>
          </div>
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
            {users.length} Total
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Tgl Daftar</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold overflow-hidden border border-slate-200 shadow-sm">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          user.displayName?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{user.displayName || 'Unnamed User'}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">UID: {user.uid.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      user.status === 'Active' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {user.status === 'Active' ? <UserCheck size={10} /> : <UserX size={10} />}
                      {user.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail size={12} />
                      <span className="text-[11px] font-bold tracking-tight">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Shield size={12} className={
                        user.role === UserRole.ADMIN ? 'text-blue-500' : 
                        user.role === UserRole.VIEW ? 'text-emerald-500' : 'text-slate-400'
                      } />
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.uid, e.target.value as UserRole)}
                        className={`text-[10px] font-black uppercase tracking-widest bg-transparent border-none focus:ring-0 cursor-pointer ${
                          user.role === UserRole.ADMIN ? 'text-blue-600' : 
                          user.role === UserRole.VIEW ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        <option value={UserRole.ADMIN}>Admin</option>
                        <option value={UserRole.CASHIER}>Cashier</option>
                        <option value={UserRole.VIEW}>View</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    <div className="flex items-center gap-2">
                       <Calendar size={12} />
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleString('id-ID') : '-'}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => toggleStatus(user)}
                        className={`p-2 rounded-lg transition-all ${
                          user.status === 'Active' 
                            ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600' 
                            : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                        }`}
                        title={user.status === 'Active' ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                         {user.status === 'Active' ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
