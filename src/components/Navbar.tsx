import { Search, ShoppingCart, MessageCircle, UserCircle, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';

interface NavbarProps {
  onCartClick: () => void;
  cartCount: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export default function Navbar({ 
  onCartClick, 
  cartCount, 
  searchTerm, 
  onSearchChange
}: NavbarProps) {
  const whatsappNumber = '628557271197'; 

  const handleChat = () => {
    window.open(`https://wa.me/${whatsappNumber}`, '_blank');
  };

  return (
    <nav className="sticky top-0 z-40 bg-brand-blue px-4 py-3 shadow-md">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cari Produk..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none shadow-inner"
          />
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={onCartClick}
            className="relative p-2 text-white hover:bg-blue-700/50 rounded-full transition-colors"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <motion.span 
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="absolute top-0 right-0 bg-brand-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-brand-blue"
              >
                {cartCount}
              </motion.span>
            )}
          </button>

          <button 
            onClick={handleChat}
            className="p-2 text-white hover:bg-blue-700/50 rounded-full transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
