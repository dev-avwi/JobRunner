interface XeroRibbonProps {
  size?: 'sm' | 'md';
}

export default function XeroRibbon({ size = 'md' }: XeroRibbonProps) {
  const isSm = size === 'sm';
  
  return (
    <div 
      className="absolute top-0 left-0 overflow-hidden pointer-events-none z-10"
      style={{
        width: isSm ? '64px' : '80px',
        height: isSm ? '64px' : '80px',
      }}
      data-testid="xero-ribbon"
    >
      <div
        className="absolute flex items-center justify-center text-white font-bold shadow-md"
        style={{
          width: isSm ? '90px' : '110px',
          height: isSm ? '18px' : '22px',
          fontSize: isSm ? '9px' : '10px',
          letterSpacing: '0.5px',
          backgroundColor: '#13B5EA',
          transform: 'rotate(-45deg)',
          top: isSm ? '14px' : '18px',
          left: isSm ? '-22px' : '-26px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}
      >
        XERO
      </div>
    </div>
  );
}
