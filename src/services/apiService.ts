import { Product, User } from '../types';

const API_URL = 'https://script.google.com/macros/s/AKfycbxnrVH_jCJ9ggNR42LPTPlzT513baG3479JaJZmVR3KQmutkmLVzdc6HhpdlxJfxFSHEA/exec';

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const response = await fetch(`${API_URL}?action=getProducts`);
    const result = await response.json();
    console.log('API Products Response:', result.status);
    if (result.status === 'ok') {
      return result.data
        .filter((item: any) => {
          // Hanya tampilkan jika Aktif (true atau 'TRUE')
          const isActive = item.aktif === true || item.aktif === 'TRUE' || item.Aktif === true || item.Aktif === 'TRUE';
          return isActive;
        })
        .map((item: any) => ({
          id: item.id || item.ID || String(Math.random()),
          name: item.namaProduk || item.nama_produk || item['Nama Produk'] || item.nama || item.name || 'Produk Tanpa Nama',
          price: Number(item.hargaPromo || item.harga_promo || item['Harga Promo'] || item.price || 0),
          originalPrice: item.hargaNormal || item.harga_normal || item['Harga Normal'] || item.originalPrice,
          stock: `${item.stok || item.Stok || 0} ${item.satuan || item.Satuan || 'Pcs'}`,
          image: item.fotoUrl || item.foto_url || item['Foto URL'] || item.foto || item.image || 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?q=80&w=1000&auto=format&fit=crop',
          description: item.keterangan || item.Keterangan || item.description || 'Deskripsi produk tidak tersedia.',
          category: item.kategori || item.Kategori || item.category || 'Umum'
        }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
};

export const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${API_URL}?action=getUsers`);
    const result = await response.json();
    if (result.status === 'ok') {
      const users = result.data.map((item: any) => ({
        id: item.id || item.ID || String(Math.random()),
        name: item.nama || item.Nama || item['Nama'] || 'User',
        phone: item['No HP'] || item.noHp || item.no_hp || item.phone || '',
        password: String(item.password || item.Password || item['Password'] || ''),
        role: item.role || item.Role || item['Role (B2B/B2C/Admin)'] || 'B2C',
      }));
      console.log('Fetched Users Count:', users.length);
      if (users.length > 0) {
        console.log('Sample User (Data check):', { name: users[0].name, phone: users[0].phone, role: users[0].role });
      }
      return users;
    }
    return [];
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const createOrder = async (orderData: any) => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script POST often requires no-cors if not using specialized headers
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createOrder',
        ...orderData
      })
    });
    return response;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};

export const sendNotification = async (message: string, target: string = '120363406553739227@g.us') => {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, target }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending notification:', error);
    return { status: false, msg: 'Failed to send notification' };
  }
};
