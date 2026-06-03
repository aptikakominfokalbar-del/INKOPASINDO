export enum PaymentMethod {
  CASH = 'Cash',
  TRANSFER = 'Transfer',
  BON = 'Bon'
}

export enum UserRole {
  ADMIN = 'Admin',
  CASHIER = 'Cashier',
  VIEW = 'View'
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  createdAt: any; // Firestore Timestamp
}

export interface WartegDetails {
  sisaBon?: number;
  sisaJualKembali?: number;
  sisaLaukNotes?: string;
  sisaLakuNotes?: string;
}

export interface Transaction {
  id?: string;
  categoryId: string;
  date: any; // Firestore Timestamp
  itemName: string;
  quantity: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  wartegDetails?: WartegDetails;
  authorId?: string;
}

export interface Expense {
  id?: string;
  categoryId: string;
  date: any; // Firestore Timestamp
  itemName: string;
  amount: number;
  notes?: string;
  authorId?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  categoryId: string;
  totalBruto: number;
  totalExpense: number;
  totalNetto: number;
  details?: {
    cash: number;
    transfer: number;
    bon: number;
  };
}
