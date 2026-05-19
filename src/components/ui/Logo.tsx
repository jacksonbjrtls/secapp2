import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  const gradientId = React.useId().replace(/:/g, '');
  const filterId = React.useId().replace(/:/g, '');

  return (
    <div className={`flex items-center gap-2 aspect-[3/1] ${className}`}>
      <svg
        viewBox="0 0 240 80"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`grad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#064e3b', stopOpacity: 1 }} />
          </linearGradient>
          <filter id={`filter-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
            <feSpecularLighting in="blur" surfaceScale="5" specularConstant=".75" specularExponent="20" lightingColor="white" result="specOut">
              <fePointLight x="-5000" y="-10000" z="20000" />
            </feSpecularLighting>
            <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
            <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litGraphic" />
          </filter>
        </defs>
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          style={{
            fill: `url(#grad-${gradientId})`,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 900,
            fontSize: '64px',
            letterSpacing: '-2px',
            filter: `url(#filter-${filterId})`
          }}
        >
          SecApp
        </text>
      </svg>
    </div>
  );
};
