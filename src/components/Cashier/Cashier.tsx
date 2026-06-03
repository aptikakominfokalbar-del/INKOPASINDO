import { useState, FormEvent, useEffect, useMemo } from "react";
import { sheetsdb } from "../../lib/sheetsdb";
import { Category, PaymentMethod, UserProfile, UserRole } from "../../types";
import {
  ShoppingBasket,
  CreditCard,
  Banknote,
  History,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Calendar,
  Settings,
} from "lucide-react";

interface CashierProps {
  category: Category;
  userProfile: UserProfile | null;
}

interface CashierItem {
  id: string;
  type: string;
  name: string;
  isCustom: boolean;
  quantity: number;
  price: number;
}

// Predefined menu & item presets for Indonesian units
const PRESETS: Record<string, { name: string; price: number; type: string }[]> =
  {
    "tata-boga": [],
    warteg: [],
    "es-kristal": [],
    laundry: [],
    "pemasukan-lain": [],
  };

// Available product subcategories for each cashier unit
const CATEGORY_SUBSECTIONS: Record<string, string[]> = {
  "tata-boga": ["MAKANAN", "MINUMAN", "GORENGAN"],
  warteg: ["MAKANAN", "MINUMAN"],
  "es-kristal": ["ES KRISTAL"],
  laundry: ["LAUNDRY"],
  "pemasukan-lain": ["LAIN-LAIN"],
};

const formatRupiahUnit = (num: number | string) => {
  if (num === undefined || num === null || num === "") return "";
  const numStr = num.toString().replace(/[^0-9]/g, "");
  if (!numStr) return "";
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  presetList: { name: string; price: number; type: string }[];
  placeholder: string;
}

function SearchableDropdown({
  value,
  onChange,
  presetList,
  placeholder,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(value);
    }
  }, [value, isOpen]);

  const filteredPresets = presetList.filter((preset) =>
    preset.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="relative w-full h-full">
      <input
        type="text"
        value={isOpen ? searchTerm : value || ""}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          setSearchTerm(value);
          setIsOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
          }, 200);
        }}
        placeholder={placeholder}
        className="w-full h-full pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-[#334155] text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 appearance-none transition-all placeholder:text-slate-300"
      />

      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
          {filteredPresets.length === 0 ? (
            <div className="px-4 py-2 text-xs text-slate-400 font-semibold">
              Tidak ditemukan "{searchTerm}"
            </div>
          ) : (
            filteredPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onMouseDown={() => {
                  onChange(preset.name);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition-colors flex justify-between items-center ${
                  value === preset.name ? "bg-blue-50/50 text-blue-600" : ""
                }`}
              >
                <span>{preset.name}</span>
                {preset.price > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    Rp {preset.price.toLocaleString()}
                  </span>
                )}
              </button>
            ))
          )}
          <button
            type="button"
            onMouseDown={() => {
              onChange("custom_item");
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-black text-rose-500 hover:bg-rose-50 border-t border-slate-100 transition-colors uppercase tracking-wider"
          >
            + Ketik Manual...
          </button>
        </div>
      )}
    </div>
  );
}

export default function Cashier({ category, userProfile }: CashierProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [customPresets, setCustomPresets] = useState<
    Record<string, { name: string; price: number; type: string }[]>
  >(() => {
    try {
      const saved = localStorage.getItem("inkopasindo_custom_presets");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const allPresetsForCategory = useMemo(() => {
    const base = PRESETS[category.id] || [];
    const custom = customPresets[category.id] || [];
    
    // Deduplicate by name, preferring custom presets over base presets
    // so if a user customizes the price of "Lele", it overrides the base one.
    const presetMap = new Map<string, any>();
    
    // Add base presets first
    for (const item of base) {
      const normalizedName = item.name.toLowerCase().trim();
      presetMap.set(normalizedName, item);
    }
    
    // Add custom presets, which will overwrite base presets with the same name
    for (const item of custom) {
      const normalizedName = item.name.toLowerCase().trim();
      presetMap.set(normalizedName, item);
    }
    
    return Array.from(presetMap.values());
  }, [category.id, customPresets]);

  const saveCustomPreset = async (newPreset: {
    name: string;
    price: number;
    type: string;
  }) => {
    const updated = { ...customPresets };
    if (!updated[category.id]) updated[category.id] = [];
    updated[category.id].push(newPreset);
    setCustomPresets(updated);
    localStorage.setItem("inkopasindo_custom_presets", JSON.stringify(updated));

    // Persist to Google Sheets / Apps Script backend
    try {
      await sheetsdb.saveMenu(category.id, newPreset.name, newPreset.price, newPreset.type);
    } catch (e: any) {
      console.error("Failed to save menu to backend", e);
      if (e.message && e.message.includes('Unknown action')) {
        alert("Gagal menyimpan ke database. Anda harus menyalin ulang kode `apps-script-code.js` terbaru ke Google Apps Script dan melakukan New Deployment!");
      }
    }
  };

  const deleteCustomPreset = async (name: string, type: string) => {
    const updated = { ...customPresets };
    if (updated[category.id]) {
      updated[category.id] = updated[category.id].filter(
        (p) => !(p.name === name && p.type === type),
      );
      setCustomPresets(updated);
      localStorage.setItem(
        "inkopasindo_custom_presets",
        JSON.stringify(updated),
      );

      // Persist deletion to Google Sheets / Apps Script backend
      try {
        await sheetsdb.deleteMenu(category.id, name, type);
      } catch (e: any) {
        console.error("Failed to delete menu from backend", e);
        if (e.message && e.message.includes('Unknown action')) {
          alert("Gagal menghapus dari database. Anda harus menyalin ulang kode `apps-script-code.js` terbaru ke Google Apps Script dan melakukan New Deployment!");
        }
      }
    }
  };

  useEffect(() => {
    const handleMenusUpdated = () => {
      try {
        const saved = localStorage.getItem("inkopasindo_custom_presets");
        if (saved) {
          setCustomPresets(JSON.parse(saved));
        }
      } catch (e) {}
    };

    window.addEventListener("inkopasindo_menus_updated", handleMenusUpdated);
    return () => {
      window.removeEventListener("inkopasindo_menus_updated", handleMenusUpdated);
    };
  }, []);

  const [isManageMenuModalOpen, setIsManageMenuModalOpen] = useState(false);
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [newMenuType, setNewMenuType] = useState("");

  const getLocalDateString = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  };

  const isViewOnly = userProfile?.role === UserRole.VIEW;
  const isAdmin = userProfile?.role === UserRole.ADMIN;

  // Header & Buyer State
  const [buyerName, setBuyerName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(getLocalDateString());

  // Warteg-specific additional metadata
  const [sisaBon, setSisaBon] = useState(0);
  const [sisaJualKembali, setSisaJualKembali] = useState(0);
  const [sisaLaukNotes, setSisaLaukNotes] = useState("");
  const [sisaLakuNotes, setSisaLakuNotes] = useState("");

  // Cart / Items list state
  const [items, setItems] = useState<CashierItem[]>([]);

  // Reset & Re-initialize cart items whenever category changes
  useEffect(() => {
    const activeSubs = CATEGORY_SUBSECTIONS[category.id] || ["UMUM"];
    const initialItems: CashierItem[] = [];

    activeSubs.forEach((subType) => {
      const typePresets = allPresetsForCategory.filter(
        (p) => p.type === subType,
      );
      const defaultPreset = typePresets[0];

      if (defaultPreset) {
        initialItems.push({
          id: Math.random().toString(),
          type: subType,
          name: "",
          isCustom: false,
          quantity: 1,
          price: 0,
        });
      } else {
        initialItems.push({
          id: Math.random().toString(),
          type: subType,
          name: "",
          isCustom: true,
          quantity: 1,
          price: 0,
        });
      }
    });

    setItems(initialItems);
    // Also reset buyer and room info
    setBuyerName("");
    setRoomName("");
    setNotes("");
    setSisaBon(0);
    setSisaJualKembali(0);
    setSisaLaukNotes("");
    setSisaLakuNotes("");
  }, [category.id]);

  const handleAddItemOfType = (type: string) => {
    setItems([
      ...items,
      {
        id: Math.random().toString(),
        type: type,
        name: "",
        isCustom: false,
        quantity: 1,
        price: 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItemName = (id: string, name: string) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          if (name === "custom_item") {
            return { ...item, name: "", isCustom: true, price: 0 };
          }
          const preset = allPresetsForCategory.find((p) => p.name === name);
          return {
            ...item,
            name: name,
            isCustom: false,
            price: preset ? preset.price : item.price,
          };
        }
        return item;
      }),
    );
  };

  const handleUpdateCustomName = (id: string, customName: string) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, name: customName };
        }
        return item;
      }),
    );
  };

  const handleSwitchToSelect = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const typePresets = allPresetsForCategory.filter(
      (p) => p.type === item.type,
    );
    const defaultPreset = typePresets[0] || { name: "", price: 0 };
    setItems(
      items.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            isCustom: false,
            name: defaultPreset.name,
            price: defaultPreset.price,
          };
        }
        return it;
      }),
    );
  };

  const handleUpdateQty = (id: string, qty: number) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, quantity: qty };
        }
        return item;
      }),
    );
  };

  const handleUpdatePrice = (id: string, price: number) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, price: price };
        }
        return item;
      }),
    );
  };

  // Grand total calculation for the dark receipt
  const grandTotal = items
    .filter((item) => (item.name || "").trim() !== "")
    .reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Filter out items that have not been selected/filled yet
    const activeItems = items.filter((item) => (item.name || "").trim() !== "");

    if (activeItems.length === 0) {
      setError("Mohon pilih/isi setidaknya satu menu/item transaksi.");
      return;
    }

    const invalidItem = activeItems.find(
      (item) => item.price < 0 || item.quantity <= 0,
    );
    if (invalidItem) {
      setError(
        `Mohon lengkapi jumlah dan harga untuk semua item yang dipilih.`,
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const selectedDate = new Date(transactionDate);
      selectedDate.setHours(12, 0, 0, 0);

      // Create transactions, one document per cart item
      const promises = activeItems.map(async (item) => {
        let formattedNotes = "";
        const parts: string[] = [];
        if (buyerName?.trim()) parts.push(`Pembeli: ${buyerName.trim()}`);
        if (roomName?.trim()) parts.push(`Kamar: ${roomName.trim()}`);
        if (notes?.trim()) parts.push(`Memo: ${notes.trim()}`);
        formattedNotes = parts.join(" • ");

        const transactionData: any = {
          categoryId: category.id,
          date: { toDate: () => selectedDate },
          itemName: (item.name || "").trim(),
          quantity: item.quantity,
          totalPrice: item.price * item.quantity,
          paymentMethod,
          notes: formattedNotes,
          authorId: userProfile?.uid || "",
        };

        if (category.id === "warteg") {
          transactionData.wartegDetails = {
            sisaBon,
            sisaJualKembali,
            sisaLaukNotes,
            sisaLakuNotes,
          };
        }

        return sheetsdb.addTransaction(transactionData);
      });

      await Promise.all(promises);
      setSuccess(true);
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError("Gagal menyimpan transaksi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const activeSubs = CATEGORY_SUBSECTIONS[category.id] || ["UMUM"];
    const initialItems: CashierItem[] = [];

    activeSubs.forEach((subType) => {
      const typePresets = allPresetsForCategory.filter(
        (p) => p.type === subType,
      );
      const defaultPreset = typePresets[0];

      if (defaultPreset) {
        initialItems.push({
          id: Math.random().toString(),
          type: subType,
          name: "",
          isCustom: false,
          quantity: 1,
          price: 0,
        });
      } else {
        initialItems.push({
          id: Math.random().toString(),
          type: subType,
          name: "",
          isCustom: true,
          quantity: 1,
          price: 0,
        });
      }
    });

    setItems(initialItems);
    setBuyerName("");
    setRoomName("");
    setPaymentMethod(PaymentMethod.CASH);
    setNotes("");
    setTransactionDate(getLocalDateString());
    setSisaBon(0);
    setSisaJualKembali(0);
    setSisaLaukNotes("");
    setSisaLakuNotes("");
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "MAKANAN":
        return { pill: "bg-emerald-500", text: "text-emerald-500" };
      case "MINUMAN":
        return { pill: "bg-[#2563EB]", text: "text-[#2563EB]" };
      case "GORENGAN":
        return { pill: "bg-amber-500", text: "text-amber-500" };
      case "ES KRISTAL":
        return { pill: "bg-cyan-500", text: "text-cyan-500" };
      case "LAUNDRY":
        return { pill: "bg-indigo-500", text: "text-indigo-500" };
      case "LAIN-LAIN":
        return { pill: "bg-purple-500", text: "text-purple-500" };
      default:
        return { pill: "bg-slate-500", text: "text-slate-500" };
    }
  };

  const activeSubsections = CATEGORY_SUBSECTIONS[category.id] || ["UMUM"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className={`h-1.5 ${category.color}`}></div>
          <div className="p-4 sm:p-6 md:p-8">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-2xl sm:text-3.5xl font-extrabold text-[#01261c] tracking-tight leading-tight">
                  Kasir —{" "}
                  {category.name
                    .split(" ")
                    .map(
                      (w) =>
                        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
                    )
                    .join(" ")}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Input transaksi pemasukan
                </p>
              </div>
              {isAdmin && !isViewOnly && (
                <button
                  type="button"
                  onClick={() => setIsManageMenuModalOpen(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded transition"
                >
                  Kelola Menu
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                {/* 3-Column Top Selector (Tanggal, Pembeli, Kamar) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Tanggal Transaksi
                    </label>
                    <div className="relative h-12">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Calendar size={16} />
                      </div>
                      <input
                        type="date"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        className="w-full h-full pl-12 pr-5 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Nama Pembeli
                    </label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Nama pembeli (opsional)"
                      className="w-full h-12 px-5 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Kamar / Ruangan
                    </label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Nama kamar (opsional)"
                      className="w-full h-12 px-5 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 text-xs"
                    />
                  </div>
                </div>

                {/* Subsections of Menu dynamically rendered */}
                <div className="space-y-4 pt-2">
                  {activeSubsections.map((subType) => {
                    const subItems = items.filter(
                      (item) => item.type === subType,
                    );
                    const style = getTypeStyles(subType);

                    return (
                      <div
                        key={subType}
                        className="bg-white border border-[#E2E8F0] rounded-2xl p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-sm shadow-slate-100/40 relative"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-[5px] h-4 ${style.pill} rounded-full`}
                          ></div>
                          <span
                            className={`text-[11px] font-black uppercase tracking-[0.15em] ${style.text}`}
                          >
                            {subType}
                          </span>
                        </div>

                        {subItems.length === 0 ? (
                          <div className="py-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <p className="text-xs text-slate-400 font-black uppercase tracking-wider mb-2">
                              Belum ada item {subType.toLowerCase()}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleAddItemOfType(subType)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-sm shadow-blue-200"
                            >
                              + Tambah Pertama
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {subItems.map((item, index) => {
                              const presetList = allPresetsForCategory.filter(
                                (p) => p.type === subType,
                              );

                              return (
                                <div
                                  key={item.id}
                                  className="space-y-1.5 pb-4 border-b border-slate-100 last:border-0 last:pb-0 relative"
                                >
                                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400 tracking-wider mb-1">
                                    <span className="text-slate-400/80 uppercase text-[9px]">
                                      Item #{index + 1}
                                    </span>
                                    {subItems.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveItem(item.id)
                                        }
                                        className="text-rose-500 hover:text-rose-700 font-black uppercase text-[9px] tracking-widest transition-colors flex items-center gap-1"
                                      >
                                        ✕ Hapus
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6 items-end">
                                    <div>
                                      <label className="block text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.1em] mb-1">
                                        Nama {subType}
                                      </label>
                                      <div className="relative h-11 md:h-12 w-full">
                                        {item.isCustom ? (
                                          <div className="relative h-full w-full flex">
                                            <input
                                              type="text"
                                              value={item.name}
                                              onChange={(e) =>
                                                handleUpdateCustomName(
                                                  item.id,
                                                  e.target.value,
                                                )
                                              }
                                              placeholder={`Ketik nama ${subType.toLowerCase()}`}
                                              className="w-full h-full px-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-300"
                                            />
                                            {presetList.length > 0 && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleSwitchToSelect(item.id)
                                                }
                                                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[8px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-200 transition-all font-sans"
                                              >
                                                List
                                              </button>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="relative h-full w-full">
                                            <SearchableDropdown
                                              value={item.name}
                                              onChange={(val) =>
                                                handleUpdateItemName(
                                                  item.id,
                                                  val,
                                                )
                                              }
                                              presetList={presetList}
                                              placeholder={`-- Pilih ${
                                                subType.charAt(0) +
                                                subType.slice(1).toLowerCase()
                                              } --`}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.1em] mb-1">
                                        Jumlah
                                      </label>
                                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl h-11 md:h-12 overflow-hidden px-1 focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdateQty(
                                              item.id,
                                              Math.max(1, item.quantity - 1),
                                            )
                                          }
                                          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-slate-700 hover:shadow-2xs active:scale-95 transition-all text-base font-bold font-sans"
                                        >
                                          -
                                        </button>
                                        <input
                                          type="number"
                                          value={item.quantity}
                                          onChange={(e) =>
                                            handleUpdateQty(
                                              item.id,
                                              parseInt(e.target.value) || 1,
                                            )
                                          }
                                          className="flex-1 w-full bg-transparent border-none outline-none text-center font-black text-slate-800 text-sm focus:ring-0 p-0"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdateQty(
                                              item.id,
                                              item.quantity + 1,
                                            )
                                          }
                                          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-lg hover:bg-white text-slate-400 hover:text-slate-700 hover:shadow-2xs active:scale-95 transition-all text-base font-bold font-sans"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-black text-[#94A3B8] uppercase tracking-[0.1em] mb-1">
                                        Harga Satuan (Rp)
                                      </label>
                                      <div className="relative h-11 md:h-12 flex items-center px-4 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all">
                                        <span className="text-slate-300 font-bold text-sm select-none mr-1.5">
                                          Rp
                                        </span>
                                        <input
                                          type="text"
                                          value={formatRupiahUnit(item.price)}
                                          onChange={(e) => {
                                            const cleanVal =
                                              e.target.value.replace(
                                                /[^0-9]/g,
                                                "",
                                              );
                                            handleUpdatePrice(
                                              item.id,
                                              parseFloat(cleanVal) || 0,
                                            );
                                          }}
                                          placeholder="0"
                                          className="w-full h-full bg-transparent border-none outline-none font-black text-slate-800 text-sm focus:ring-0 p-0"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => handleAddItemOfType(subType)}
                                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#2563EB] font-black uppercase text-[9px] tracking-widest rounded-xl transition-all flex items-center gap-1.5 focus:outline-none shadow-sm"
                              >
                                + Tambah {subType} Lain
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <PaymentTypeCard
                    active={paymentMethod === PaymentMethod.CASH}
                    onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                    icon={<Banknote size={20} />}
                    label="Tunai"
                    color="blue"
                  />
                  <PaymentTypeCard
                    active={paymentMethod === PaymentMethod.TRANSFER}
                    onClick={() => setPaymentMethod(PaymentMethod.TRANSFER)}
                    icon={<CreditCard size={20} />}
                    label="Transfer"
                    color="blue"
                  />
                  <PaymentTypeCard
                    active={paymentMethod === PaymentMethod.BON}
                    onClick={() => setPaymentMethod(PaymentMethod.BON)}
                    icon={<History size={20} />}
                    label="Bon"
                    color="rose"
                  />
                </div>
              </div>

              {category.id === "warteg" && (
                <div className="pt-6 sm:pt-8 border-t border-slate-100 bg-slate-50/50 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                    <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                      Parameter Khusus Warteg
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Sisa Bon (Rp)
                      </label>
                      <input
                        type="text"
                        value={formatRupiahUnit(sisaBon)}
                        onChange={(e) => {
                          const cleanVal = e.target.value.replace(
                            /[^0-9]/g,
                            "",
                          );
                          setSisaBon(parseFloat(cleanVal) || 0);
                        }}
                        className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700 focus:border-blue-400 transition-colors text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Sisa Jual Kembali (Rp)
                      </label>
                      <input
                        type="text"
                        value={formatRupiahUnit(sisaJualKembali)}
                        onChange={(e) => {
                          const cleanVal = e.target.value.replace(
                            /[^0-9]/g,
                            "",
                          );
                          setSisaJualKembali(parseFloat(cleanVal) || 0);
                        }}
                        className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 outline-none font-bold text-slate-700 focus:border-blue-400 transition-colors text-xs"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Catatan Sisa Lauk & Laku
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Catatan Sisa Lauk"
                          value={sisaLaukNotes}
                          onChange={(e) => setSisaLaukNotes(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 outline-none font-medium text-slate-700 focus:border-blue-400 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Catatan Sisa Laku"
                          value={sisaLakuNotes}
                          onChange={(e) => setSisaLakuNotes(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 outline-none font-medium text-slate-700 focus:border-blue-400 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Catatan Tambahan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Memo, detail pesanan, dll."
                  className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-700 focus:border-blue-400 transition-colors text-xs"
                ></textarea>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading || isViewOnly}
                  className={`flex-[2] bg-slate-900 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl hover:bg-black shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${isViewOnly ? "cursor-not-allowed" : ""}`}
                >
                  {isViewOnly ? (
                    <Lock size={18} />
                  ) : loading ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {isViewOnly ? "View Only" : "Simpan Transaksi"}
                </button>
                {!isViewOnly && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-6 border border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-widest rounded-2xl hover:bg-slate-50 transition-colors"
                  >
                    Bersihkan
                  </button>
                )}
              </div>

              {error && (
                <div className="p-4 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl flex items-center gap-3">
                  <AlertCircle size={20} />
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    {error}
                  </span>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Success Modal Pop-up */}
      {success && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl p-12 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                Sukses!
              </h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                Transaksi Anda telah berhasil disimpan ke dalam laporan harian
                unit {category.name}.
              </p>
            </div>
            <button
              onClick={() => setSuccess(false)}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-black transition-all"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {/* Dark Live Receipt summarizer column */}
      <div className="space-y-6">
        <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center opacity-50 border-b border-white/10 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest">
                Ringkasan Struk (Live)
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            </div>

            <div className="space-y-4 font-mono text-[11px]">
              <div className="flex justify-between opacity-70 border-b border-white/5 pb-2">
                <span>UNIT:</span>
                <span className="font-extrabold tracking-widest text-slate-200">
                  {category.name}
                </span>
              </div>

              {/* Items in basket */}
              <div className="space-y-3 max-h-[220px] overflow-y-auto duration-200 pr-1 select-none">
                {items.filter((i) => (i.name || "").trim() !== "").length ===
                0 ? (
                  <div className="text-slate-500 italic py-2">
                    Belum ada item pilihan
                  </div>
                ) : (
                  items
                    .filter((i) => (i.name || "").trim() !== "")
                    .map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="flex justify-between items-start leading-tight"
                      >
                        <span className="opacity-50 uppercase text-[9px] shrink-0 w-20">
                          {item.type}:
                        </span>
                        <span className="text-right flex-1 truncate pl-2">
                          <span className="text-slate-100 font-bold">
                            {item.name}
                          </span>{" "}
                          <span className="text-blue-400 font-bold">
                            ({item.quantity}x @ Rp {item.price.toLocaleString()}
                            )
                          </span>
                        </span>
                      </div>
                    ))
                )}
              </div>

              {/* Extras block */}
              {(buyerName || roomName || notes) && (
                <div className="pt-3 border-t border-white/5 space-y-1.5 text-[9px] text-slate-400 uppercase">
                  {buyerName && (
                    <div className="flex justify-between">
                      <span className="opacity-50">Pembeli:</span>
                      <span className="font-bold text-slate-300 truncate max-w-[140px]">
                        {buyerName}
                      </span>
                    </div>
                  )}
                  {roomName && (
                    <div className="flex justify-between">
                      <span className="opacity-50">Kamar/Ruang:</span>
                      <span className="font-bold text-slate-300 truncate max-w-[140px]">
                        {roomName}
                      </span>
                    </div>
                  )}
                  {notes && (
                    <div className="flex justify-between">
                      <span className="opacity-50">Memo:</span>
                      <span className="font-bold text-slate-300 truncate max-w-[140px]">
                        {notes}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center opacity-70 border-t border-white/10 pt-3">
                <span>METODE:</span>
                <span className="font-bold underline tracking-wider">
                  {paymentMethod}
                </span>
              </div>

              <div className="pt-6 border-t border-white/10 flex flex-col items-start justify-between gap-1">
                <span className="text-[10px] font-black opacity-50 uppercase tracking-widest">
                  Total Harga
                </span>
                <span className="text-3xl font-black text-blue-400 tracking-tighter mb-4">
                  Rp {grandTotal.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const activeItems = items.filter(
                      (item) => (item.name || "").trim() !== "",
                    );
                    if (activeItems.length === 0) {
                      alert("Belum ada item pesanan untuk dicetak.");
                      return;
                    }

                    const printWindow = window.open("", "_blank");
                    if (!printWindow) {
                      alert(
                        "Gagal membuka jendela cetak. Pastikan pop-up diizinkan.",
                      );
                      return;
                    }

                    const receiptDate = new Date().toLocaleString("id-ID");

                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Struk Pembayaran</title>
                          <style>
                            body { font-family: monospace; padding: 20px; width: 300px; margin: 0 auto; color: #000; }
                            h2 { text-align: center; margin: 0 0 10px 0; font-size: 16px; text-transform: uppercase; }
                            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
                            .flex { display: flex; justify-content: space-between; }
                            .text-right { text-align: right; }
                            .text-center { text-align: center; }
                            .item-name { font-weight: bold; margin-bottom: 2px; }
                            .item-detail { font-size: 12px; margin-bottom: 5px; }
                            .total-row { font-weight: bold; font-size: 14px; margin-top: 10px; }
                            .meta { font-size: 10px; }
                          </style>
                        </head>
                        <body>
                          <h2>Struk Pembayaran</h2>
                          <div class="text-center meta">${receiptDate}</div>
                          <div class="text-center meta" style="margin-bottom: 10px;">UNIT: ${category.name}</div>
                          
                          <div class="divider"></div>
                          
                          ${activeItems
                            .map(
                              (item) => `
                            <div>
                              <div class="item-name">${item.name}</div>
                              <div class="flex item-detail">
                                <span>${item.quantity}x @ Rp ${item.price.toLocaleString()}</span>
                                <span>Rp ${(item.quantity * item.price).toLocaleString()}</span>
                              </div>
                            </div>
                          `,
                            )
                            .join("")}
                          
                          <div class="divider"></div>
                          
                          ${buyerName ? `<div class="flex meta"><span>Pembeli:</span><span>${buyerName}</span></div>` : ""}
                          ${roomName ? `<div class="flex meta"><span>Kamar:</span><span>${roomName}</span></div>` : ""}
                          ${notes ? `<div class="flex meta"><span>Memo:</span><span>${notes}</span></div>` : ""}
                          
                          <div class="flex meta" style="margin-top: 5px;"><span>Pembayaran:</span><span>${paymentMethod}</span></div>
                          
                          <div class="divider"></div>
                          <div class="flex total-row">
                            <span>TOTAL:</span>
                            <span>Rp ${grandTotal.toLocaleString()}</span>
                          </div>
                          <div class="divider"></div>
                          <div class="text-center meta" style="margin-top: 20px;">Terima Kasih</div>
                          
                          <script>
                            window.onload = function() { window.print(); window.close(); };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="w-full mt-2 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  Cetak Struk
                </button>
              </div>
            </div>
          </div>
          <ShoppingBasket
            className="absolute -bottom-10 -right-10 opacity-5"
            size={200}
          />
        </div>

        {/* Cashier Guide block */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Panduan Kasir
          </p>
          <ul className="space-y-3.5 text-xs font-semibold text-slate-500">
            <li className="flex gap-3">
              <span className="text-blue-500 font-black">01.</span>
              <span>Periksa kembali total harga sebelum menyimpan.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 font-black">02.</span>
              <span>
                Transaksi yang valid akan langsung muncul di laporan harian.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {isManageMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-extrabold text-[#01261c]">
                Kelola Menu {category.name}
              </h2>
              <button
                onClick={() => setIsManageMenuModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                X
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="text-xs font-black uppercase text-slate-500 mb-4 tracking-widest">
                  Tambah Menu Baru
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Nama Menu
                    </label>
                    <input
                      type="text"
                      value={newMenuName}
                      onChange={(e) => setNewMenuName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-800"
                      placeholder="Misal: Kopi Susu Aren"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Harga (opsional)
                    </label>
                    <input
                      type="text"
                      value={formatRupiahUnit(newMenuPrice)}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/[^0-9]/g, "");
                        setNewMenuPrice(cleanVal);
                      }}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-800"
                      placeholder="0"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Tipe (Kategori)
                    </label>
                    <select
                      value={newMenuType}
                      onChange={(e) => setNewMenuType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-800"
                    >
                      <option value="">-- Pilih Tipe --</option>
                      {(CATEGORY_SUBSECTIONS[category.id] || ["UMUM"]).map(
                        (subType) => (
                          <option key={subType} value={subType}>
                            {subType}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newMenuName || !newMenuType)
                      return alert("Nama dan Tipe wajib diisi");
                    saveCustomPreset({
                      name: newMenuName,
                      price: Number(newMenuPrice) || 0,
                      type: newMenuType,
                    });
                    setNewMenuName("");
                    setNewMenuPrice("");
                    setNewMenuType("");
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-black uppercase tracking-widest transition"
                >
                  Simpan Menu
                </button>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase text-slate-500 mb-2 tracking-widest">
                  Daftar Menu Kustom
                </h3>
                {(customPresets[category.id] || []).length === 0 ? (
                  <p className="text-sm text-slate-400 font-medium italic">
                    Belum ada menu kustom yang ditambahkan.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries((customPresets[category.id] || []).reduce((acc, p) => {
                      if (!acc[p.type]) acc[p.type] = [];
                      acc[p.type].push(p);
                      return acc;
                    }, {} as Record<string, typeof customPresets[string]>)).map(([type, presets], groupIdx) => (
                      <div key={groupIdx} className="mb-4">
                        <h4 className="text-xs font-black uppercase text-slate-800 mb-2 tracking-widest px-2 py-1 bg-slate-100 inline-block rounded-md">{type}</h4>
                        <ul className="space-y-2">
                          {presets.map((p, idx) => (
                            <li
                              key={idx}
                              className="flex justify-between items-center bg-white border border-slate-200 rounded p-3"
                            >
                              <div>
                                <div className="font-bold text-sm text-slate-800">
                                  {p.name}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                  Rp {p.price.toLocaleString("id-ID")}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteCustomPreset(p.name, p.type)}
                                className="text-rose-500 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded text-xs font-bold transition"
                              >
                                Hapus
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentTypeCard({ active, onClick, icon, label, color }: any) {
  const activeClass =
    color === "rose"
      ? "bg-rose-500 text-white border-rose-500 ring-4 ring-rose-500/10"
      : "bg-blue-600 text-white border-blue-600 ring-4 ring-blue-500/10";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-5 px-4 rounded-xl transition-all flex flex-col items-center gap-2 border border-slate-200 font-black uppercase text-[10px] tracking-widest shadow-sm ${active ? activeClass : "bg-slate-50 text-slate-400 hover:bg-white"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
