import { useState, useEffect, useMemo } from 'react';
import Splash from './components/Splash';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import ProductDetail from './components/ProductDetail';
import CartDrawer from './components/CartDrawer';
import { Product, CartItem } from './types';
import { fetchProducts, createOrder, sendNotification } from './services/apiService';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  // Load products from API
  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      const data = await fetchProducts();
      setAllProducts(data);
      setIsSyncing(false);
    };
    loadData();

    // Auto-refresh every 60 seconds as per plan F11
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const categories = useMemo(() => {
    const cats = ['Semua', ...new Set(allProducts.map(p => p.category))];
    return cats;
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      const name = p.name || '';
      const matchesSearch = name.toLowerCase().includes((searchTerm || '').toLowerCase());
      const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allProducts, searchTerm, selectedCategory]);

  const addToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handlePlaceOrder = async (formData: any) => {
    setIsLoading(true);
    try {
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const orderItems = cart.map(item => ({ name: item.name, qty: item.quantity, price: item.price }));
      
      await createOrder({
        customerName: formData.name,
        customerPhone: formData.phone,
        customerAddress: formData.address,
        items: orderItems,
        total: total
      });
      
      // WhatsApp Notification via Fonnte
      const notificationText = `🛍️ *PESANAN BARU* 🛍️\n\n` +
        `👤 *Pelanggan:* ${formData.name}\n` +
        `📞 *No HP:* ${formData.phone}\n` +
        `📍 *Alamat:* ${formData.address}\n` +
        `--------------------------\n` +
        cart.map(item => `✅ ${item.name} (${item.quantity}x)`).join('\n') +
        `\n--------------------------\n` +
        `💰 *TOTAL: Rp ${total.toLocaleString('id-ID')}*\n\n` +
        `_Mohon segera diproses. Terima kasih._`;

      await sendNotification(notificationText);

      alert('Pesanan Anda telah dikirim ke Admin PT ROJO BRONTO LANO. Mohon ditunggu.');
      
      setCart([]);
      setIsCartOpen(false);
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat memproses pesanan.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showSplash) {
    return <Splash onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans">
      <Navbar 
        onCartClick={() => setIsCartOpen(true)}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      <div className="bg-white shadow-sm sticky top-[68px] z-30">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 hide-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-brand-blue text-white shadow-md' 
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        {isSyncing && allProducts.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
             {[1,2,3,4,5,6].map(i => (
               <div key={i} className="bg-white rounded-xl h-64 animate-pulse px-4" />
             ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProductCard 
                    product={product} 
                    onClick={setSelectedProduct}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        
        {!isSyncing && filteredProducts.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            Produk tidak ditemukan di kategori ini
          </div>
        )}
      </main>

      <footer className="bg-brand-blue p-4 pb-8 text-center mt-8">
        <p className="text-white font-extrabold text-xs tracking-[0.2em] uppercase">PT ROJO BRONTO LANO</p>
        <p className="text-blue-200 text-[10px] mt-1 opacity-70">Sumedang, Jawa Barat</p>
      </footer>

      <ProductDetail 
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />

      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onPlaceOrder={handlePlaceOrder}
        isLoading={isLoading}
      />
    </div>
  );
}

