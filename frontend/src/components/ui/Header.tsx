"use client";


export default function Header({ className }: { className?: string }) {
  const isDark = className?.includes('dark-header');
  return (
    <header
      className={className}
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '0.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: isDark ? '#000000' : '#ffffff',
        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
        margin: '0 auto',
        
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <img src={isDark ? "/logo.png" : "/logo-name-light.png"} alt="Vinci" width="100" height="32" />
        <span style={{
          
          fontSize: '1.5rem',
          color: '#21dad2',
          marginLeft: '0.0rem',
          fontWeight: '950'
        }}>
          clips
        </span>
      </div>
      <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <button
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'all 0.3s ease',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => window.open("https://app.tryvinci.com", "_blank")}>
          Try Other Vinci Apps
        </button>
      </nav>
    </header>
  );
}