import Image from 'next/image';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withText?: boolean;
  type?: 'mark' | 'full';
}

export default function BrandLogo({ 
  size = 'md', 
  className = '', 
  withText = false,
  type = 'mark'
}: BrandLogoProps) {
  const sizes = {
    sm: 32,
    md: 48,
    lg: 80,
    xl: 120
  };

  const pixels = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative group">
        {/* Glow Effect */}
        <div className="absolute -inset-1 bg-emerald-500/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
        
        <Image
          src="/brand/logo.png"
          alt="SILA Logo"
          width={pixels}
          height={pixels}
          className="relative transition-transform duration-500 group-hover:scale-105"
          priority
        />
      </div>
      
      {withText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-white leading-none">
            SILA
          </span>
          <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-widest mt-1">
            Intelligence
          </span>
        </div>
      )}
    </div>
  );
}
