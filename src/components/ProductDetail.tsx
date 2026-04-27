import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { useState } from 'react';

interface ProductDetailProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export default function ProductDetail({ product, isOpen, onClose, onAddToCart }: ProductDetailProps) {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setQuantity(1);
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto pb-safe shadow-2xl"
          >
            <div className="sticky top-0 bg-white px-4 py-4 flex items-center justify-between border-bottom">
              <div className="w-12 h-1 bg-gray-200 rounded-full absolute top-2 left-1/2 -translate-x-1/2" />
              <h2 className="font-bold text-lg">Detail Produk</h2>
              <button 
                onClick={onClose}
                className="p-2 bg-gray-100 rounded-full text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-4 shadow-inner">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              </div>

              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h1>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-2xl font-bold text-red-600">{formatCurrency(product.price)}</span>
                  {product.originalPrice && (
                    <span className="text-sm text-gray-400 line-through mb-1">{formatCurrency(product.originalPrice)}</span>
                  )}
                </div>
                
                <div className="p-3 bg-blue-50 rounded-lg mb-4">
                  <div className="text-xs text-blue-600 font-bold uppercase mb-1">Status Stok</div>
                  <div className="text-blue-900 font-medium">{product.stock}</div>
                </div>

                <div className="prose prose-sm text-gray-600">
                  <h3 className="text-sm font-bold text-gray-900 uppercase">Deskripsi</h3>
                  <p>{product.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 py-4 border-t sticky bottom-0 bg-white">
                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 text-gray-600"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="w-10 text-center font-bold">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-2 text-gray-600"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                
                <button 
                  onClick={handleAddToCart}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                >
                  <ShoppingCart className="h-5 w-5" />
                  + Keranjang
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
