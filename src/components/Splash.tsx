import { motion } from 'motion/react';

export default function Splash({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1, delay: 2 }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-blue"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl mb-6 text-brand-blue font-extrabold text-4xl transform rotate-12">
          DA
        </div>
        <h1 className="text-white text-4xl font-extrabold tracking-tighter">DEN ANA</h1>
        <p className="text-blue-100 mt-2 font-medium opacity-80 uppercase tracking-widest text-xs">Digital Catalog System</p>
      </motion.div>
    </motion.div>
  );
}
