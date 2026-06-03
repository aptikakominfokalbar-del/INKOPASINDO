import { useState } from 'react';
import { categoryStore, useCategories } from '../../lib/categoryStore';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Category } from '../../types';

export default function CategoryManagement() {
  const categories = useCategories();
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('bg-slate-500');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const colors = [
    'bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
    'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];

  const handleAdd = () => {
    if (!newId || !newName) return;
    try {
      categoryStore.addCategory({ id: newId, name: newName, color: newColor });
      setIsAdding(false);
      setNewId('');
      setNewName('');
      setNewColor('bg-slate-500');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const saveEdit = (id: string) => {
    if (!editName) return;
    categoryStore.updateCategory(id, editName, editColor);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Yakin ingin menghapus kategori ini?')) {
      try {
        categoryStore.deleteCategory(id);
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Manajemen Kategori Unit</h2>
          <p className="text-sm text-slate-500">Tambah, ubah, atau hapus kategori unit bisnis.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors"
        >
          <Plus size={18} />
          Tambah Kategori
        </button>
      </div>

      <div className="p-0">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-bold">ID Kategori</th>
              <th className="px-6 py-4 font-bold">Nama Kategori</th>
              <th className="px-6 py-4 font-bold">Warna</th>
              <th className="px-6 py-4 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isAdding && (
              <tr className="bg-emerald-50">
                <td className="px-6 py-4">
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="misal: cafe-baru"
                    className="w-full px-3 py-2 text-sm border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.toUpperCase())}
                    placeholder="misal: CAFE BARU"
                    className="w-full px-3 py-2 text-sm border-2 border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {colors.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewColor(color)}
                          className={`w-6 h-6 rounded-full ${color} ${newColor === color ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}
                          title={color}
                        />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Simpan">
                      <Check size={18} />
                    </button>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors" title="Batal">
                      <X size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                    <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{cat.id}</span>
                </td>
                <td className="px-6 py-4">
                  {editingId === cat.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <span className="font-bold text-slate-700">{cat.name}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === cat.id ? (
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {colors.map(color => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`w-5 h-5 rounded-full ${color} ${editColor === color ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}
                          />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${cat.color}`}></div>
                      <span className="text-xs text-slate-500">{cat.color}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === cat.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => saveEdit(cat.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Simpan">
                        <Check size={18} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Batal">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(cat)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(cat.id)} 
                        disabled={categories.length <= 1}
                        className="p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-30 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
