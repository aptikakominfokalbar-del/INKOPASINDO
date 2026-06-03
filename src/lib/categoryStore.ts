import { useState, useEffect } from 'react';
import { Category } from '../types';
import { CATEGORIES as DEFAULT_CATEGORIES } from '../constants';

type Listener = (categories: Category[]) => void;

class CategoryStore {
  private categories: Category[] = [];
  private listeners: Listener[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const stored = localStorage.getItem('inkopasindo_categories');
      if (stored) {
        this.categories = JSON.parse(stored);
      } else {
        this.categories = [...DEFAULT_CATEGORIES];
        this.save();
      }
    } catch (e) {
      console.error('Failed to parse categories', e);
      this.categories = [...DEFAULT_CATEGORIES];
    }
  }

  private save() {
    localStorage.setItem('inkopasindo_categories', JSON.stringify(this.categories));
    this.notify();
  }

  getCategories(): Category[] {
    return [...this.categories];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener([...this.categories]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.categories]));
  }

  addCategory(category: Category) {
    if (this.categories.some(c => c.id === category.id)) {
      throw new Error(`Kategori dengan ID ${category.id} sudah ada.`);
    }
    this.categories.push(category);
    this.save();
  }

  updateCategory(id: string, name: string, color: string) {
    const idx = this.categories.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.categories[idx] = { ...this.categories[idx], name, color };
      this.save();
    }
  }

  deleteCategory(id: string) {
    if (this.categories.length <= 1) {
       throw new Error('Tidak bisa menghapus kategori terakhir.');
    }
    this.categories = this.categories.filter(c => c.id !== id);
    this.save();
  }
}

export const categoryStore = new CategoryStore();

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(categoryStore.getCategories());

  useEffect(() => {
    return categoryStore.subscribe(setCategories);
  }, []);

  return categories;
}
