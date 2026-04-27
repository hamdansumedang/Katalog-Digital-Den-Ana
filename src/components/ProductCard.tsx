import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div 
      onClick={() => onClick(product)}
      className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      <div className="aspect-square bg-gray-100 relative">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 min-h-[40px] mb-1">
          {product.name}
        </h3>
        
        {product.originalPrice && (
          <span className="text-xs text-gray-400 line-through">
            {formatCurrency(product.originalPrice)}
          </span>
        )}
        
        <div className="text-lg font-extrabold text-brand-red mb-1">
          {formatCurrency(product.price)}
        </div>
        
        <div className="mt-auto pt-1 flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${parseInt(product.stock) > 50 ? 'bg-green-500' : 'bg-orange-500'}`} />
           <div className="text-[10px] text-gray-500 font-bold uppercase">
             Stok: {product.stock}
           </div>
        </div>
      </div>
    </div>
  );
}
