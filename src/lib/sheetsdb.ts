import { UserProfile, Transaction, Expense, UserRole } from '../types';
import { getCachedAccessToken, clearCachedAccessToken } from './firebase';
import { APPS_SCRIPT_WEB_APP_URL } from '../config';

const DB_FILENAME = 'Inkopasindo_Database_Kelas_IIB_Ketapang';
const SPREADSHEET_ID_KEY = 'inkopasindo_sheetsdb_spreadsheet_id';

type Listener<T> = (data: T[]) => void;

const serializeUsers = (users: UserProfile[]): string => {
  return JSON.stringify(users.map(u => {
    let createdVal: string | null = null;
    if (u.createdAt) {
      if (typeof u.createdAt.toDate === 'function') {
        createdVal = u.createdAt.toDate().toISOString();
      } else if (typeof u.createdAt === 'string') {
        createdVal = u.createdAt;
      } else if (u.createdAt instanceof Date) {
        createdVal = (u.createdAt as Date).toISOString();
      }
    }
    return {
      ...u,
      createdAt: createdVal
    };
  }));
};

const deserializeUsers = (uStr: string): UserProfile[] => {
  try {
    const parsed = JSON.parse(uStr);
    return parsed.map((u: any) => {
      const dStr = u.createdAt;
      const d = dStr ? new Date(dStr) : new Date();
      return {
        ...u,
        createdAt: { toDate: () => (isNaN(d.getTime()) ? new Date() : d) }
      };
    });
  } catch (e) {
    console.error('Error deserializing users:', e);
    return [];
  }
};

const serializeTransactions = (transactions: Transaction[]): string => {
  return JSON.stringify(transactions.map(t => {
    let dateVal: string | null = null;
    if (t.date) {
      if (typeof t.date.toDate === 'function') {
        dateVal = t.date.toDate().toISOString();
      } else if (typeof t.date === 'string') {
        dateVal = t.date;
      } else if (t.date instanceof Date) {
        dateVal = (t.date as Date).toISOString();
      }
    }
    return {
      ...t,
      date: dateVal
    };
  }));
};

const deserializeTransactions = (tStr: string): Transaction[] => {
  try {
    const parsed = JSON.parse(tStr);
    return parsed.map((t: any) => {
      const dStr = t.date;
      const d = dStr ? new Date(dStr) : new Date();
      return {
        ...t,
        date: { toDate: () => (isNaN(d.getTime()) ? new Date() : d) }
      };
    });
  } catch (e) {
    console.error('Error deserializing transactions:', e);
    return [];
  }
};

const serializeExpenses = (expenses: Expense[]): string => {
  return JSON.stringify(expenses.map(e => {
    let dateVal: string | null = null;
    if (e.date) {
      if (typeof e.date.toDate === 'function') {
        dateVal = e.date.toDate().toISOString();
      } else if (typeof e.date === 'string') {
        dateVal = e.date;
      } else if (e.date instanceof Date) {
        dateVal = (e.date as Date).toISOString();
      }
    }
    return {
      ...e,
      date: dateVal
    };
  }));
};

const deserializeExpenses = (eStr: string): Expense[] => {
  try {
    const parsed = JSON.parse(eStr);
    return parsed.map((e: any) => {
      const dStr = e.date;
      const d = dStr ? new Date(dStr) : new Date();
      return {
        ...e,
        date: { toDate: () => (isNaN(d.getTime()) ? new Date() : d) }
      };
    });
  } catch (e) {
    console.error('Error deserializing expenses:', e);
    return [];
  }
};

class SheetsDatabase {
  private spreadsheetId: string | null = null;
  private isInitializing: boolean = false;
  private hasInitialized: boolean = false;
  private sheetIds: { [title: string]: number } = {};
  private get appsScriptUrl(): string | null {
    if (APPS_SCRIPT_WEB_APP_URL && APPS_SCRIPT_WEB_APP_URL.includes('script.google.com')) {
      return APPS_SCRIPT_WEB_APP_URL;
    }
    return localStorage.getItem('APPS_SCRIPT_URL');
  }

  private users: UserProfile[] = [];
  private transactions: Transaction[] = [];
  private expenses: Expense[] = [];
  private menus: any[] = [];

  private userListeners: Listener<UserProfile>[] = [];
  private transactionListeners: Listener<Transaction>[] = [];
  private expenseListeners: Listener<Expense>[] = [];

  private syncIntervalId: any = null;

  // Local state queues to prevent background sync overwrites
  private pendingAdds = new Map<string, any>();
  private pendingUpdates = new Map<string, any>();
  private pendingDeletes = new Set<string>();

  private pendingExpenseAdds = new Map<string, any>();
  private pendingExpenseUpdates = new Map<string, any>();
  private pendingExpenseDeletes = new Set<string>();

  constructor() {
    let spId = localStorage.getItem(SPREADSHEET_ID_KEY);
    if (spId && spId.includes('docs.google.com/spreadsheets/d/')) {
      const match = spId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        spId = match[1];
        localStorage.setItem(SPREADSHEET_ID_KEY, spId);
      }
    }
    this.spreadsheetId = spId;
  }

  // Make HTTP requests with ease (to Apps Script or Direct API)
  private async gasCall(action: string, data: any = {}): Promise<any> {
    const url = this.appsScriptUrl;
    if (!url) throw new Error('APPS_SCRIPT_URL is not set.');

    const res = await fetch(url + (action === 'syncAll' ? '?action=syncAll' : ''), {
      method: action === 'syncAll' ? 'GET' : 'POST',
      body: action === 'syncAll' ? undefined : JSON.stringify({ action, ...data }),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // required to avoid CORS preflight options
      }
    });
    
    if (!res.ok) throw new Error(`GAS HTTP Error ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'APPS SCRIPT DB Error');
    return json;
  }

  // Get active access token
  private getAccessToken(): string {
    if (this.appsScriptUrl) return 'skipped-for-apps-script';
    const token = getCachedAccessToken();
    if (!token) {
      throw new Error('Google OAuth access token is not available. Please sign in with Google.');
    }
    return token;
  }

  // Make HTTP requests with ease
  private async apiCall(url: string, options: RequestInit = {}): Promise<any> {
    const token = this.getAccessToken();
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearCachedAccessToken();
      }
      const errorText = await response.text();
      throw new Error(`Google Sheets API Error (${response.status}): ${errorText}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  // Find or Create database spreadsheet in user's Google Drive
  async init(): Promise<string> {
    // ALWAYS load from local storage first to ensure immediate data availability in UI on boot
    if (!this.hasInitialized) {
      try {
        const uStr = localStorage.getItem('sheetsdb_users');
        const tStr = localStorage.getItem('sheetsdb_transactions');
        const eStr = localStorage.getItem('sheetsdb_expenses');
        
        if (uStr) this.users = deserializeUsers(uStr);
        if (tStr) this.transactions = deserializeTransactions(tStr);
        if (eStr) this.expenses = deserializeExpenses(eStr);
        
        this.notifyUserListeners();
        this.notifyTransactionListeners();
        this.notifyExpenseListeners();
      } catch (e) {
        console.warn('Failed to pre-load local cached data from localStorage:', e);
      }
    }

    if (this.appsScriptUrl) {
      if (this.hasInitialized) return 'apps-script';
      this.isInitializing = true;
      try {
        await this.syncAllData();
        this.startBackgroundSync();
        this.hasInitialized = true;
        this.spreadsheetId = 'apps-script';
        return 'apps-script';
      } catch (e) {
        console.error('GAS Init Error:', e);
        throw e;
      } finally {
        this.isInitializing = false;
      }
    }

    const token = getCachedAccessToken();
    if (!token) {
      if (this.hasInitialized) return 'local-spreadsheet';
      console.warn('Running in Local-Only Fallback Mode because Google OAuth Token is not available (Login is disabled).');
      this.hasInitialized = true;
      this.spreadsheetId = 'local-spreadsheet';
      return 'local-spreadsheet';
    }

    if (this.hasInitialized && this.spreadsheetId && this.spreadsheetId !== 'local-spreadsheet') return this.spreadsheetId;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return this.spreadsheetId!;
    }

    this.isInitializing = true;
    try {
      let spId = this.spreadsheetId === 'local-spreadsheet' ? null : this.spreadsheetId;

      if (spId) {
        // Verify it still exists and gets sheets
        try {
          await this.loadSpreadsheetMetadata(spId);
        } catch (e) {
          console.warn('Saved Spreadsheet ID invalid or inaccessible, searching Drive...', e);
          spId = null;
        }
      }

      if (!spId) {
        // Search Drive
        const query = `name='${DB_FILENAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
        const searchResult = await this.apiCall(url);

        if (searchResult.files && searchResult.files.length > 0) {
          spId = searchResult.files[0].id;
          localStorage.setItem(SPREADSHEET_ID_KEY, spId!);
          await this.loadSpreadsheetMetadata(spId!);
        } else {
          // Create new Spreadsheet
          spId = await this.createNewSpreadsheet();
          localStorage.setItem(SPREADSHEET_ID_KEY, spId!);
        }
      }

      this.spreadsheetId = spId;
      this.hasInitialized = true;
      
      // Load initial values
      await this.syncAllData();

      // Start background poll every 15 seconds
      this.startBackgroundSync();

      return spId!;
    } catch (error) {
      console.error('Failed to initialize Google Sheets database:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async loadSpreadsheetMetadata(id: string) {
    const meta = await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${id}?fields=sheets.properties`);
    if (meta?.sheets) {
      meta.sheets.forEach((sh: any) => {
        if (sh.properties) {
          this.sheetIds[sh.properties.title] = sh.properties.sheetId;
        }
      });
    }
  }

  private async createNewSpreadsheet(): Promise<string> {
    const createRes = await this.apiCall('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      body: JSON.stringify({
        name: DB_FILENAME,
        mimeType: 'application/vnd.google-apps.spreadsheet'
      })
    });

    const spId = createRes.id;

    // Create tabs: rename default sheet to 'users', add 'transactions', 'expenses'
    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${spId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                title: 'users'
              },
              fields: 'title'
            }
          },
          {
            addSheet: {
              properties: {
                title: 'transactions'
              }
            }
          },
          {
            addSheet: {
              properties: {
                title: 'expenses'
              }
            }
          },
          {
            addSheet: {
              properties: {
                title: 'menus'
              }
            }
          }
        ]
      })
    });

    // Extract updated properties
    await this.loadSpreadsheetMetadata(spId);

    // Write row headers
    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${spId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: 'users!A1:G1',
            values: [['uid', 'email', 'displayName', 'photoURL', 'role', 'status', 'createdAt']]
          },
          {
            range: 'transactions!A1:M1',
            values: [['id', 'categoryId', 'date', 'itemName', 'quantity', 'totalPrice', 'paymentMethod', 'notes', 'sisaBon', 'sisaJualKembali', 'sisaLaukNotes', 'sisaLakuNotes', 'authorId']]
          },
          {
            range: 'expenses!A1:G1',
            values: [['id', 'categoryId', 'date', 'itemName', 'amount', 'notes', 'authorId']]
          },
          {
            range: 'menus!A1:D1',
            values: [['categoryId', 'name', 'price', 'type']]
          }
        ]
      })
    });

    return spId;
  }

  // Load all data from Sheet in a single call (batchGet)
  async syncAllData(): Promise<void> {
    if (!this.spreadsheetId && !this.appsScriptUrl) return;

    try {
      let loadedUsers: UserProfile[] = [];
      let loadedTransactions: Transaction[] = [];
      let loadedExpenses: Expense[] = [];
      let loadedMenus: any[] = [];

      if (this.appsScriptUrl) {
        // --- APPS SCRIPT PATH ---
        const json = await this.gasCall('syncAll');
        
        loadedUsers = (json.users || []).map((row: any) => ({
          uid: row.uid,
          email: row.email || '',
          displayName: row.displayName || '',
          photoURL: row.photoURL || undefined,
          role: (row.role || UserRole.CASHIER) as UserRole,
          status: (row.status || 'Active') as 'Active' | 'Inactive',
          createdAt: row.createdAt ? { toDate: () => new Date(row.createdAt) } : { toDate: () => new Date() }
        }));

        loadedTransactions = (json.transactions || []).map((row: any) => ({
          id: row.id,
          categoryId: row.categoryId || '',
          date: row.date ? { toDate: () => new Date(row.date) } : { toDate: () => new Date() },
          itemName: row.itemName || '',
          quantity: Number(row.quantity) || 0,
          totalPrice: Number(row.totalPrice) || 0,
          paymentMethod: row.paymentMethod as any,
          notes: row.notes || '',
          wartegDetails: {
            sisaBon: row.sisaBon !== '' && row.sisaBon !== null && row.sisaBon !== undefined ? Number(row.sisaBon) : undefined,
            sisaJualKembali: row.sisaJualKembali !== '' && row.sisaJualKembali !== null && row.sisaJualKembali !== undefined ? Number(row.sisaJualKembali) : undefined,
            sisaLaukNotes: row.sisaLaukNotes || undefined,
            sisaLakuNotes: row.sisaLakuNotes || undefined
          },
          authorId: row.authorId || ''
        }));

        loadedExpenses = (json.expenses || []).map((row: any) => ({
          id: row.id,
          categoryId: row.categoryId || '',
          date: row.date ? { toDate: () => new Date(row.date) } : { toDate: () => new Date() },
          itemName: row.itemName || '',
          amount: Number(row.amount) || 0,
          notes: row.notes || '',
          authorId: row.authorId || ''
        }));

        loadedMenus = (json.menus || []).map((row: any) => ({
          categoryId: row.categoryId || '',
          name: row.name || '',
          price: Number(row.price) || 0,
          type: row.type || ''
        }));
      } else {
        // --- DIRECT GOOGLE SHEETS API PATH ---
        const ranges = ['users!A2:Z', 'transactions!A2:Z', 'expenses!A2:Z', 'menus!A2:Z'];
        const data = await this.apiCall(
          `https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values:batchGet?ranges=${ranges.map(r => encodeURIComponent(r)).join('&')}`
        );

        const valueRanges = data.valueRanges || [];

        // 1. Process users
        const usersRows = valueRanges[0]?.values || [];
        loadedUsers = usersRows.map((row: any) => ({
          uid: row[0],
          email: row[1] || '',
          displayName: row[2] || '',
          photoURL: row[3] || undefined,
          role: (row[4] || UserRole.CASHIER) as UserRole,
          status: (row[5] || 'Active') as 'Active' | 'Inactive',
          createdAt: row[6] ? { toDate: () => new Date(row[6]) } : { toDate: () => new Date() }
        }));

        // 2. Process transactions
        const transactionsRows = valueRanges[1]?.values || [];
        loadedTransactions = transactionsRows.map((row: any) => ({
          id: row[0],
          categoryId: row[1] || '',
          date: row[2] ? { toDate: () => new Date(row[2]) } : { toDate: () => new Date() },
          itemName: row[3] || '',
          quantity: Number(row[4]) || 0,
          totalPrice: Number(row[5]) || 0,
          paymentMethod: row[6] as any,
          notes: row[7] || '',
          wartegDetails: {
            sisaBon: row[8] ? Number(row[8]) : undefined,
            sisaJualKembali: row[9] ? Number(row[9]) : undefined,
            sisaLaukNotes: row[10] || undefined,
            sisaLakuNotes: row[11] || undefined
          },
          authorId: row[12] || ''
        }));

        // 3. Process expenses
        const expensesRows = valueRanges[2]?.values || [];
        loadedExpenses = expensesRows.map((row: any) => ({
          id: row[0],
          categoryId: row[1] || '',
          date: row[2] ? { toDate: () => new Date(row[2]) } : { toDate: () => new Date() },
          itemName: row[3] || '',
          amount: Number(row[4]) || 0,
          notes: row[5] || '',
          authorId: row[6] || ''
        }));

        // 4. Process menus
        const menusRows = valueRanges[3]?.values || [];
        loadedMenus = menusRows.map((row: any) => ({
          categoryId: row[0] || '',
          name: row[1] || '',
          price: Number(row[2]) || 0,
          type: row[3] || ''
        }));
      }

      // Group menus for localStorage
      const groupedMenus: Record<string, any[]> = {};
      loadedMenus.forEach(m => {
        if (!groupedMenus[m.categoryId]) groupedMenus[m.categoryId] = [];
        groupedMenus[m.categoryId].push({ name: m.name, price: m.price, type: m.type });
      });
      const oldMenusStr = localStorage.getItem('inkopasindo_custom_presets');
      const newMenusStr = JSON.stringify(groupedMenus);
      if (oldMenusStr !== newMenusStr) {
        localStorage.setItem('inkopasindo_custom_presets', newMenusStr);
        window.dispatchEvent(new Event('inkopasindo_menus_updated'));
      }

      // Deduplicate loaded users by uid
      const uniqueUsersMap = new Map<string, UserProfile>();
      loadedUsers.forEach(u => uniqueUsersMap.set(u.uid, u));
      loadedUsers = Array.from(uniqueUsersMap.values());

      // Compare and notify if changed
      if (JSON.stringify(this.users) !== JSON.stringify(loadedUsers)) {
        this.users = loadedUsers;
        this.notifyUserListeners();
        localStorage.setItem('sheetsdb_users', serializeUsers(this.users));
      }

      // Merge local pending transactions that might not be on Google Sheets yet, or were locally deleted
      let mergedTransactions: Transaction[] = loadedTransactions.filter(t => !this.pendingDeletes.has(t.id));

      this.pendingDeletes.forEach(id => {
        const existsInRemote = loadedTransactions.some(remoteT => remoteT.id === id);
        if (!existsInRemote) {
          this.pendingDeletes.delete(id);
        }
      });

      mergedTransactions = mergedTransactions.map(t => {
        if (this.pendingUpdates.has(t.id)) {
          return { ...t, ...this.pendingUpdates.get(t.id) };
        }
        return t;
      });

      this.pendingUpdates.forEach((localT, id) => {
        const remoteT = loadedTransactions.find(t => t.id === id);
        if (remoteT && remoteT.itemName === localT.itemName && remoteT.quantity === localT.quantity && remoteT.totalPrice === localT.totalPrice && remoteT.paymentMethod === localT.paymentMethod) {
          this.pendingUpdates.delete(id);
        }
      });

      this.pendingAdds.forEach((localT, id) => {
        const existsInRemote = loadedTransactions.some(remoteT => remoteT.id === id);
        if (existsInRemote) {
          this.pendingAdds.delete(id);
        } else {
          if (!mergedTransactions.some(t => t.id === id)) {
            mergedTransactions.unshift(localT);
          }
        }
      });

      if (JSON.stringify(this.transactions) !== JSON.stringify(mergedTransactions)) {
        this.transactions = mergedTransactions;
        this.notifyTransactionListeners();
        localStorage.setItem('sheetsdb_transactions', serializeTransactions(this.transactions));
      }

      // Merge local pending expenses
      let mergedExpenses: Expense[] = loadedExpenses.filter(e => !this.pendingExpenseDeletes.has(e.id));

      this.pendingExpenseDeletes.forEach(id => {
        const existsInRemote = loadedExpenses.some(remoteE => remoteE.id === id);
        if (!existsInRemote) {
          this.pendingExpenseDeletes.delete(id);
        }
      });

      mergedExpenses = mergedExpenses.map(e => {
        if (this.pendingExpenseUpdates.has(e.id)) {
          return { ...e, ...this.pendingExpenseUpdates.get(e.id) };
        }
        return e;
      });

      this.pendingExpenseUpdates.forEach((localE, id) => {
        const remoteE = loadedExpenses.find(e => e.id === id);
        if (remoteE && remoteE.itemName === localE.itemName && remoteE.amount === localE.amount) {
          this.pendingExpenseUpdates.delete(id);
        }
      });

      this.pendingExpenseAdds.forEach((localE, id) => {
        const existsInRemote = loadedExpenses.some(remoteE => remoteE.id === id);
        if (existsInRemote) {
          this.pendingExpenseAdds.delete(id);
        } else {
          if (!mergedExpenses.some(e => e.id === id)) {
            mergedExpenses.unshift(localE);
          }
        }
      });

      if (JSON.stringify(this.expenses) !== JSON.stringify(mergedExpenses)) {
        this.expenses = mergedExpenses;
        this.notifyExpenseListeners();
        localStorage.setItem('sheetsdb_expenses', serializeExpenses(this.expenses));
      }

    } catch (e: any) {
      console.error('Error fetching data from Google Sheets API:', e);
      if (e.message && e.message.includes('Illegal spreadsheet id') && e.message.includes('https://docs.google.com/spreadsheets')) {
        alert("ERROR: Anda sepertinya memasukkan URL Spreadsheet ke dalam variabel SPREADSHEET_ID di Apps Script.\n\nSilahkan buka Google Apps Script Anda, dan ubah SPREADSHEET_ID menjadi hanya kodenya saja, yaitu bagian setelah '/d/'.\n\nSetelah itu, lakukan Deploy ulang (New Deployment).");
      }
    }
  }

  private startBackgroundSync() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    this.syncIntervalId = setInterval(() => {
      if (getCachedAccessToken()) {
        this.syncAllData().catch(console.error);
      }
    }, 15000);
  }

  stopBackgroundSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // --- Real-Time-like Listeners / Subscribers ---
  subscribeUsers(listener: Listener<UserProfile>): () => void {
    this.userListeners.push(listener);
    // instant callback with current data
    listener([...this.users]);
    return () => {
      this.userListeners = this.userListeners.filter(l => l !== listener);
    };
  }

  subscribeTransactions(listener: Listener<Transaction>): () => void {
    this.transactionListeners.push(listener);
    listener([...this.transactions]);
    return () => {
      this.transactionListeners = this.transactionListeners.filter(l => l !== listener);
    };
  }

  subscribeExpenses(listener: Listener<Expense>): () => void {
    this.expenseListeners.push(listener);
    listener([...this.expenses]);
    return () => {
      this.expenseListeners = this.expenseListeners.filter(l => l !== listener);
    };
  }

  private notifyUserListeners() {
    this.userListeners.forEach(listener => listener([...this.users]));
  }

  private notifyTransactionListeners() {
    this.transactionListeners.forEach(listener => listener([...this.transactions]));
  }

  private notifyExpenseListeners() {
    this.expenseListeners.forEach(listener => listener([...this.expenses]));
  }


  // --- DB WRITE OPERATIONS ---
  
  // 1. USERS
  async addUser(user: UserProfile): Promise<void> {
    await this.init();
    
    // Check if user already exists
    let exists = this.users.find(u => u.uid === user.uid);
    if (exists) {
      return this.updateUser(user.uid, user);
    }

    // Update local cache & notify (double check just in case)
    exists = this.users.find(u => u.uid === user.uid);
    if (!exists) {
      this.users.push(user);
    }
    this.notifyUserListeners();

    if (this.appsScriptUrl) {
      const uStr = serializeUsers(this.users);
      localStorage.setItem('sheetsdb_users', uStr);
      await this.gasCall('addUser', {
        user: {
          ...user,
          createdAt: user.createdAt?.toDate ? user.createdAt.toDate().toISOString() : new Date().toISOString()
        }
      });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      localStorage.setItem('sheetsdb_users', serializeUsers(this.users));
      return;
    }

    const row = [
      user.uid,
      user.email,
      user.displayName,
      user.photoURL || '',
      user.role,
      user.status,
      user.createdAt?.toDate ? user.createdAt.toDate().toISOString() : new Date().toISOString()
    ];

    // Append to sheet
    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/users!A:A:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify({
        values: [row]
      })
    });
  }

  async updateUser(uid: string, updates: Partial<UserProfile>): Promise<void> {
    await this.init();
    
    const index = this.users.findIndex(u => u.uid === uid);
    if (index === -1) throw new Error(`User with uid ${uid} not found`);

    const updatedUser = { ...this.users[index], ...updates };
    this.users[index] = updatedUser;
    this.notifyUserListeners();

    if (this.appsScriptUrl) {
       localStorage.setItem('sheetsdb_users', serializeUsers(this.users));
       await this.gasCall('updateUser', { uid, updates });
       return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      localStorage.setItem('sheetsdb_users', serializeUsers(this.users));
      return;
    }

    // Find row in Google sheet
    const rowIdx = await this.findRowIndexInSheet('users', uid, 0);
    if (rowIdx !== -1) {
      const row = [
        updatedUser.uid,
        updatedUser.email,
        updatedUser.displayName,
        updatedUser.photoURL || '',
        updatedUser.role,
        updatedUser.status,
        updatedUser.createdAt?.toDate ? updatedUser.createdAt.toDate().toISOString() : new Date().toISOString()
      ];

      const rangeIdx = rowIdx + 1; // Google sheets starts at 1
      await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/users!A${rangeIdx}:G${rangeIdx}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [row]
        })
      });
    }
  }

  // 2. TRANSACTIONS
  async addTransaction(t: Transaction): Promise<string> {
    await this.init();
    
    const id = 'T' + Math.random().toString(36).substr(2, 9).toUpperCase();
    t.id = id;

    // Track in pending queues to prevent overwriting from polling sync
    this.pendingAdds.set(id, t);
    this.pendingDeletes.delete(id);

    this.transactions.unshift(t); // prepend to local cache
    this.notifyTransactionListeners();
    
    // Always mirror to localStorage as an instant crash safe cache
    localStorage.setItem('sheetsdb_transactions', serializeTransactions(this.transactions));

    if (this.appsScriptUrl) {
      await this.gasCall('addTransaction', {
        transaction: {
          ...t,
          date: t.date?.toDate ? t.date.toDate().toISOString() : new Date().toISOString()
        }
      });
      return id;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      return id;
    }

    const row = [
      id,
      t.categoryId,
      t.date?.toDate ? t.date.toDate().toISOString() : new Date().toISOString(),
      t.itemName,
      t.quantity,
      t.totalPrice,
      t.paymentMethod,
      t.notes || '',
      t.wartegDetails?.sisaBon !== undefined ? t.wartegDetails.sisaBon : '',
      t.wartegDetails?.sisaJualKembali !== undefined ? t.wartegDetails.sisaJualKembali : '',
      t.wartegDetails?.sisaLaukNotes || '',
      t.wartegDetails?.sisaLakuNotes || '',
      t.authorId || ''
    ];

    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/transactions!A:A:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify({
        values: [row]
      })
    });

    return id;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    await this.init();
    
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) throw new Error(`Transaction with id ${id} not found`);

    const updatedT = { ...this.transactions[index], ...updates };
    this.transactions[index] = updatedT;

    // Track in pending queues
    this.pendingUpdates.set(id, updatedT);
    this.pendingDeletes.delete(id);
    if (this.pendingAdds.has(id)) {
      this.pendingAdds.set(id, { ...this.pendingAdds.get(id), ...updates });
    }

    this.notifyTransactionListeners();
    
    // Mirror update to offline cache
    localStorage.setItem('sheetsdb_transactions', serializeTransactions(this.transactions));

    if (this.appsScriptUrl) {
      // Create a safely serialized update payload, omitting full date obj if unneeded or stringifying it
      let flatUpdates = { ...updates };
      if (flatUpdates.date && (flatUpdates.date as any).toDate) {
         flatUpdates.date = (flatUpdates.date as any).toDate().toISOString() as any;
      }
      await this.gasCall('updateTransaction', { id, updates: flatUpdates });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      return;
    }

    const rowIdx = await this.findRowIndexInSheet('transactions', id, 0);
    if (rowIdx !== -1) {
      const row = [
        updatedT.id,
        updatedT.categoryId,
        updatedT.date?.toDate ? updatedT.date.toDate().toISOString() : new Date().toISOString(),
        updatedT.itemName,
        updatedT.quantity,
        updatedT.totalPrice,
        updatedT.paymentMethod,
        updatedT.notes || '',
        updatedT.wartegDetails?.sisaBon !== undefined ? updatedT.wartegDetails.sisaBon : '',
        updatedT.wartegDetails?.sisaJualKembali !== undefined ? updatedT.wartegDetails.sisaJualKembali : '',
        updatedT.wartegDetails?.sisaLaukNotes || '',
        updatedT.wartegDetails?.sisaLakuNotes || '',
        updatedT.authorId || ''
      ];

      const rangeIdx = rowIdx + 1;
      await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/transactions!A${rangeIdx}:M${rangeIdx}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [row]
        })
      });
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    
    this.transactions = this.transactions.filter(t => t.id !== id);

    // Track in pending queues
    this.pendingDeletes.add(id);
    this.pendingAdds.delete(id);
    this.pendingUpdates.delete(id);

    this.notifyTransactionListeners();
    
    // Mirror delete to offline cache
    localStorage.setItem('sheetsdb_transactions', serializeTransactions(this.transactions));

    if (this.appsScriptUrl) {
      await this.gasCall('deleteTransaction', { id });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      return;
    }

    const rowIdx = await this.findRowIndexInSheet('transactions', id, 0);
    if (rowIdx !== -1) {
      await this.deleteRowInSheet('transactions', rowIdx);
    }
  }

  // 3. EXPENSES
  async addExpense(e: Expense): Promise<string> {
    await this.init();
    
    const id = 'E' + Math.random().toString(36).substr(2, 9).toUpperCase();
    e.id = id;

    // Track in pending queues to prevent overwriting from polling sync
    this.pendingExpenseAdds.set(id, e);
    this.pendingExpenseDeletes.delete(id);

    this.expenses.unshift(e); // prepend to local cache
    this.notifyExpenseListeners();

    // Mirror to localStorage
    localStorage.setItem('sheetsdb_expenses', serializeExpenses(this.expenses));

    if (this.appsScriptUrl) {
      await this.gasCall('addExpense', {
        expense: {
          ...e,
          date: e.date?.toDate ? e.date.toDate().toISOString() : new Date().toISOString()
        }
      });
      return id;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      return id;
    }

    const row = [
      id,
      e.categoryId,
      e.date?.toDate ? e.date.toDate().toISOString() : new Date().toISOString(),
      e.itemName,
      e.amount,
      e.notes || '',
      e.authorId || ''
    ];

    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/expenses!A:A:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify({
        values: [row]
      })
    });

    return id;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
    await this.init();
    
    const index = this.expenses.findIndex(e => e.id === id);
    if (index === -1) throw new Error(`Expense with id ${id} not found`);

    const updatedE = { ...this.expenses[index], ...updates };
    this.expenses[index] = updatedE;

    // Track in pending queues
    this.pendingExpenseUpdates.set(id, updatedE);
    this.pendingExpenseDeletes.delete(id);
    if (this.pendingExpenseAdds.has(id)) {
      this.pendingExpenseAdds.set(id, { ...this.pendingExpenseAdds.get(id), ...updates });
    }

    this.notifyExpenseListeners();

    // Mirror update to local storage
    localStorage.setItem('sheetsdb_expenses', serializeExpenses(this.expenses));

    if (this.appsScriptUrl) {
      let flatUpdates = { ...updates };
      if (flatUpdates.date && (flatUpdates.date as any).toDate) {
         flatUpdates.date = (flatUpdates.date as any).toDate().toISOString() as any;
      }
      await this.gasCall('updateExpense', { id, updates: flatUpdates });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      return;
    }

    const rowIdx = await this.findRowIndexInSheet('expenses', id, 0);
    if (rowIdx !== -1) {
      const row = [
        updatedE.id,
        updatedE.categoryId,
        updatedE.date?.toDate ? updatedE.date.toDate().toISOString() : new Date().toISOString(),
        updatedE.itemName,
        updatedE.amount,
        updatedE.notes || '',
        updatedE.authorId || ''
      ];

      const rangeIdx = rowIdx + 1;
      await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/expenses!A${rangeIdx}:G${rangeIdx}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({
          values: [row]
        })
      });
    }
  }

  async deleteExpense(id: string): Promise<void> {
    await this.init();
    
    this.expenses = this.expenses.filter(e => e.id !== id);

    // Track in pending queues
    this.pendingExpenseDeletes.add(id);
    this.pendingExpenseAdds.delete(id);
    this.pendingExpenseUpdates.delete(id);

    this.notifyExpenseListeners();

    // Mirror to local storage
    localStorage.setItem('sheetsdb_expenses', serializeExpenses(this.expenses));

    if (this.appsScriptUrl) {
      await this.gasCall('deleteExpense', { id });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') {
      return;
    }

    const rowIdx = await this.findRowIndexInSheet('expenses', id, 0);
    if (rowIdx !== -1) {
      await this.deleteRowInSheet('expenses', rowIdx);
    }
  }

  async saveMenu(categoryId: string, name: string, price: number, type: string): Promise<void> {
    await this.init();

    if (this.appsScriptUrl) {
      await this.gasCall('saveMenu', { menu: { categoryId, name, price, type } });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') return;

    const row = [categoryId, name, price, type];
    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/menus!A:A:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify({ values: [row] })
    });
  }

  async deleteMenu(categoryId: string, name: string, type: string): Promise<void> {
    await this.init();

    if (this.appsScriptUrl) {
      await this.gasCall('deleteMenu', { categoryId, name, type });
      return;
    }

    const token = getCachedAccessToken();
    if (!token || this.spreadsheetId === 'local-spreadsheet') return;

    const data = await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/menus!A2:Z`);
    const rows = data.values || [];
    for (let r = 0; r < rows.length; r++) {
      if (rows[r][0] === categoryId && rows[r][1] === name && rows[r][3] === type) {
        await this.deleteRowInSheet('menus', r + 1);
        return;
      }
    }
  }

  // --- HELPER UTILS ---

  // Look up index of matching row
  private async findRowIndexInSheet(sheetName: string, queryValue: string, colIdx: number): Promise<number> {
    const data = await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}/values/${sheetName}!A2:Z`);
    const rows = data.values || [];
    for (let r = 0; r < rows.length; r++) {
      if (rows[r][colIdx] === queryValue) {
        return r + 1; // index 1 is header row, so index 0 of `rows` maps to sheet row index 1 (zero-based for APIs)
      }
    }
    return -1;
  }

  // Delete matching row in spreadsheet securely
  private async deleteRowInSheet(sheetName: string, zeroBasedRowIdx: number) {
    const sheetId = this.sheetIds[sheetName];
    if (sheetId === undefined) return;

    await this.apiCall(`https://www.googleapis.com/sheets/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: zeroBasedRowIdx,
                endIndex: zeroBasedRowIdx + 1
              }
            }
          }
        ]
      })
    });
  }

  // Simple getters for current values
  getUsersList(): UserProfile[] { return [...this.users]; }
  getTransactionsList(): Transaction[] { return [...this.transactions]; }
  getExpensesList(): Expense[] { return [...this.expenses]; }
}

export const sheetsdb = new SheetsDatabase();
