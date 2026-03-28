'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export default function BrandSpinner({ size = 80 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="relative">
        {/* Outer Glow Ring */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.6, 0.3],
            rotate: 360,
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -inset-8 rounded-full bg-gradient-to-tr from-[#10B981]/20 via-transparent to-[#02010A]/20 blur-2xl"
        />

        {/* Pulsing Emerald Border */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            borderColor: ['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.5)', 'rgba(16, 185, 129, 0.2)'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-4 rounded-3xl border-2 border-[#10B981]/30 z-0"
        />

        {/* The Logo */}
        <motion.div
          animate={{
            y: [0, -4, 0],
            filter: ['drop-shadow(0 0 0px rgba(16, 185, 129, 0))', 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.4))', 'drop-shadow(0 0 0px rgba(16, 185, 129, 0))']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 bg-[#0F172A] p-4 rounded-2xl border border-white/10 shadow-2xl"
        >
          <Image
            src="/brand/logo.png"
            alt="SILA AI"
            width={size}
            height={size}
            className="object-contain"
          />
        </motion.div>

        {/* Scanning Line Animation */}
        <motion.div
          animate={{
            top: ['0%', '100%', '0%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#10B981] to-transparent z-20 shadow-[0_0_10px_#10B981]"
        />
      </div>

      <div className="text-center space-y-2">
        <motion.h3
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[#10B981] font-bold tracking-[0.2em] uppercase text-xs"
        >
          Neural Analysis in Progress
        </motion.h3>
        <p className="text-slate-500 text-[10px] tracking-wider uppercase font-medium">
          Consulting SILA Knowledge Graph
        </p>
      </div>
    </div>
  );
}
