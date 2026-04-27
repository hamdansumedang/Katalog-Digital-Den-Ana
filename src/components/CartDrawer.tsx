import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Minus, Send, ClipboardCheck } from 'lucide-react';
import { CartItem } from '../types';
import React, { useState } from 'react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onPlaceOrder: (formData: any) => Promise<void>;
  isLoading: boolean;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  isLoading
}: CartDrawerProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const isFormValid = formData.name && formData.phone && formData.address && items.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      await onPlaceOrder(formData);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-gray-50 flex flex-col shadow-2xl"
          >
            <div className="bg-blue-600 text-white px-4 py-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6" />
                <h2 className="font-bold text-xl">Pesanan Saya</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 bg-blue-700 rounded-full hover:bg-blue-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                    <Trash2 className="h-10 w-10 opacity-20" />
                  </div>
                  <p>Keranjang masih kosong</p>
                  <button 
                    onClick={onClose}
                    className="text-blue-600 font-bold"
                  >
                    Mulai Belanja
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm flex gap-3">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-16 h-16 object-cover rounded-lg" 
                        />
                        <div className="flex-1">
                          <h3 className="text-sm font-medium line-clamp-1">{item.name}</h3>
                          <div className="text-blue-600 font-bold mb-2">{formatCurrency(item.price)}</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center bg-gray-100 rounded-lg scale-90 origin-left">
                              <button 
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className="p-1 px-2 text-gray-600"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className="p-1 px-2 text-gray-600"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <button 
                              onClick={() => onRemoveItem(item.id)}
                              className="text-red-500 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form id="orderForm" onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow-sm space-y-4 border border-blue-50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                       <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">!</span>
                       Data Pengiriman
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Penerima</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="Contoh: Budi Santoso"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nomor WhatsApp</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="08xxxxxxxxxx"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap</label>
                        <textarea
                          required
                          value={formData.address}
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[80px]"
                          placeholder="Nama jalan, nomor rumah, RT/RW..."
                        />
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>

            <div className="bg-white border-t p-4 pb-safe space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500">Total Pembayaran</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span>
              </div>
              <button
                form="orderForm"
                disabled={!isFormValid || isLoading}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  isFormValid && !isLoading 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-95' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Konfirmasi Pesanan
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-gray-400 uppercase tracking-widest font-bold">
                Pesanan akan disimpan ke Google Sheets
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
