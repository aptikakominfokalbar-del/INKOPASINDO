/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { sheetsdb } from './lib/sheetsdb';
import { useCategories } from './lib/categoryStore';
import { Category, UserProfile, UserRole } from './types';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import Cashier from './components/Cashier/Cashier';
import ExpenseForm from './components/Expense/ExpenseForm';
import Reports from './components/Reports/Reports';
import Neraca from './components/Dashboard/Neraca';
import UserManagement from './components/Dashboard/UserManagement';
import CategoryManagement from './components/Dashboard/CategoryManagement';
import { motion, AnimatePresence } from 'motion/react';

import Login from './components/Auth/Login';

export default function App() {
  const categories = useCategories();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cashier' | 'expense' | 'reports' | 'neraca' | 'usermanagement' | 'categories'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    } else if (selectedCategory && !categories.find(c => c.id === selectedCategory.id) && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      setLoading(true);
      try {
        await sheetsdb.init();
      } catch (err) {
        console.error("Local initialization error:", err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    const storedUid = localStorage.getItem('inkopasindo_logged_in_uid');
    if (storedUid) {
       const profile = sheetsdb.getUsersList().find(x => x.uid === storedUid);
       if (profile) {
          setUser({ uid: profile.uid, displayName: profile.displayName });
          setUserProfile(profile);
       } else {
          // If profile not found in sheetsdb but UID is locally saved, create a default one or just clear login
          const defaultAdmin: UserProfile = {
            uid: storedUid,
            email: 'user@inkopasindo.local',
            displayName: 'Pengguna',
            role: UserRole.ADMIN,
            status: 'Active',
            createdAt: { toDate: () => new Date() }
          };
          setUser(defaultAdmin);
          setUserProfile(defaultAdmin);
       }
    }
  }, [loading]); // Run after initializing sheetsdb

  const handleLoginSuccess = (profile: UserProfile, isRegistering: boolean) => {
    localStorage.setItem('inkopasindo_logged_in_uid', profile.uid);
    setUser({ uid: profile.uid, displayName: profile.displayName });
    setUserProfile(profile);
    if (isRegistering) {
       sheetsdb.addUser(profile).catch(console.error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('inkopasindo_logged_in_uid');
    setUser(null);
    setUserProfile(null);
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden mb-4">
            <div className="w-1/2 h-full bg-[#064232] animate-[loading_1.5s_infinite_linear]"></div>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Menginisialisasi Sistem</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard userProfile={userProfile} onTabChange={setActiveTab} onCategorySelect={(cat) => { setSelectedCategory(cat); setActiveTab('cashier'); }} />;
      case 'cashier':
        return <Cashier category={selectedCategory} userProfile={userProfile} />;
      case 'expense':
        return <ExpenseForm category={selectedCategory} userProfile={userProfile} />;
      case 'reports':
        return <Reports category={selectedCategory} userProfile={userProfile} />;
      case 'neraca':
        return <Neraca />;
      case 'usermanagement':
        return <UserManagement />;
      case 'categories':
        return <CategoryManagement />;
      default:
        return <Dashboard userProfile={userProfile} onTabChange={setActiveTab} onCategorySelect={(cat) => { setSelectedCategory(cat); setActiveTab('cashier'); }} />;
    }
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        selectedCategory={selectedCategory} 
        setSelectedCategory={setSelectedCategory} 
        userProfile={userProfile}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          activeTab={activeTab} 
          selectedCategory={selectedCategory} 
          userProfile={userProfile}
          onMenuClick={() => setMobileMenuOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          onLogout={handleLogout}
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${selectedCategory.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
