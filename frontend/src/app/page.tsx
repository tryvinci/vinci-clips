"use client";

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Add button click animations
    const buttons = document.querySelectorAll('.primary-button, .secondary-button');
    buttons.forEach(button => {
      const handleClick = function(this: Element) {
        (this as HTMLElement).style.transform = 'scale(0.95)';
        setTimeout(() => {
          (this as HTMLElement).style.transform = '';
        }, 150);
      };
      
      button.addEventListener('click', handleClick);
    });

    // Cleanup event listeners
    return () => {
      buttons.forEach(button => {
        button.removeEventListener('click', () => {});
      });
    };
  }, []);

  const handleTryBeta = () => {
    // Navigate to the upload page (your current functionality)
    window.location.href = '/upload';
  };

  const handleGitHub = () => {
    window.open('https://github.com/tryvinci/vinci-clips', '_blank');
  };

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          color: #ffffff;
          min-height: 100vh;
          overflow-x: hidden;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }

        .header-nav {
          position: relative;
          z-index: 10;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          backdrop-filter: blur(10px);
          background: rgba(10, 10, 10, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .logo-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }



        .brand-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffffff;
        }

        .nav-menu {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .nav-link {
          color: #9ca3af;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .nav-link:hover {
          color: #14b8a6;
        }

        .cta-button {
          background: linear-gradient(135deg, #14b8a6, #0d9488);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(20, 184, 166, 0.3);
        }

        .main-content {
          position: relative;
          z-index: 5;
          max-width: 1200px;
          margin: 0 auto;
          padding: 4rem 2rem;
          text-align: center;
        }

        .hero-badge {
          display: inline-block;
          background: rgba(20, 184, 166, 0.1);
          color: #14b8a6;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 2rem;
          border: 1px solid rgba(20, 184, 166, 0.2);
        }

        .hero-title {
          font-size: clamp(3rem, 8vw, 6rem);
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, #ffffff 0%, #14b8a6 50%, #ffffff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.25rem;
          color: #9ca3af;
          max-width: 600px;
          margin: 0 auto 3rem;
          line-height: 1.6;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }

        .primary-button {
          background: linear-gradient(135deg, #14b8a6, #0d9488);
          color: white;
          padding: 1rem 2rem;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .primary-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 35px rgba(20, 184, 166, 0.4);
        }

        .secondary-button {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          padding: 1rem 2rem;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.3s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          backdrop-filter: blur(10px);
        }

        .secondary-button:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-3px);
          box-shadow: 0 15px 35px rgba(255, 255, 255, 0.1);
        }

        .features {
          display: flex;
          justify-content: center;
          gap: 3rem;
          flex-wrap: wrap;
          margin-top: 4rem;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #9ca3af;
          font-weight: 500;
        }

        .feature-icon {
          width: 20px;
          height: 20px;
          background: #14b8a6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feature-icon::before {
          content: '✓';
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .github-icon {
          width: 24px;
          height: 24px;
          fill: currentColor;
        }

        .arrow-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
          transition: transform 0.3s ease;
        }

        .primary-button:hover .arrow-icon {
          transform: translateX(3px);
        }

        .fade-in {
          animation: fadeInUp 1s ease-out;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-badge { animation-delay: 0.1s; }
        .hero-title { animation-delay: 0.2s; }
        .hero-subtitle { animation-delay: 0.3s; }
        .button-group { animation-delay: 0.4s; }
        .features { animation-delay: 0.5s; }

        @media (max-width: 768px) {
          .nav-menu {
            gap: 1rem;
          }

          .main-content {
            padding: 2rem 1rem;
          }

          .button-group {
            flex-direction: column;
            align-items: center;
          }

          .features {
            flex-direction: column;
            gap: 1rem;
            align-items: center;
          }

          .hero-title {
            font-size: 2.5rem;
          }
        }
      `}</style>

      {/* Header */}
      <header className="header-nav">
        <div className="logo-container">
          <img src="/logo.png" alt="Vinci Clips" width="120" height="40" />
        </div>
        <nav className="nav-menu">
          {/* <a href="#" className="nav-link">Solutions</a>
          <a href="#" className="nav-link">Resources</a>
          <a href="#" className="nav-link">Artemis</a> */}
          <button
            className="cta-button"
            onClick={() => window.open("https://app.tryvinci.com", "_blank")}>
            Try Other Vinci Apps
          </button>

        </nav>
      </header>

      {/* Main content */}
      <main className="main-content">
        <div className="hero-badge fade-in">Open Source Video Tools</div>
        
        <h1 ref={titleRef} className="hero-title fade-in">
          Clips By Vinci<br/>
          <span style={{color: '#14b8a6'}}>free & open-source Video to Reels Editor</span><br/>
        </h1>
        
        <p className="hero-subtitle fade-in">
          Clips is an open-source AI tool that turns long videos into engaging, reel-ready and shorts-ready content.
          With full transparency, you have complete control over your clips and workflow.
          Perfect for creators, brands, and educators looking to repurpose content into viral-ready highlights in minutes.
        </p>

        <div className="button-group fade-in">
          <Link href="/upload" className="primary-button">
            Try Early Beta
            <svg className="arrow-icon" viewBox="0 0 24 24">
              <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none"/>
            </svg>
          </Link>
          
          <button className="secondary-button" onClick={handleGitHub}>
            <svg className="github-icon" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Contribute on GitHub
          </button>
        </div>

        <div className="features fade-in">
          <div className="feature">
            <div className="feature-icon"></div>
            <span>Open Source & Free</span>
          </div>
          <div className="feature">
            <div className="feature-icon"></div>
            <span>Community Driven</span>
          </div>
          <div className="feature">
            <div className="feature-icon"></div>
            <span>Cross Platform</span>
          </div>
        </div>
      </main>
    </>
  );
}

function handleGitHub() {
  window.open('https://github.com/tryvinci/vinci-clips', '_blank');
}