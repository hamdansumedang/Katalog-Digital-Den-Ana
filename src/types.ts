export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: string;
  image: string;
  description: string;
  category: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'Admin' | 'B2B' | 'B2C';
  password?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  total: number;
  createdAt: string;
}

export type WaStatus = 'unknown' | 'active' | 'inactive';
export type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

export interface BlastContact {
  name: string;
  number: string; // normalisasi 62xxxxxxxxxx
  raw: string;
  waStatus: WaStatus;
  sendStatus: SendStatus;
  sendDetail?: string;
}

export interface ContactGroup {
  name: string;
  contacts: BlastContact[];
  updatedAt: string;
}
