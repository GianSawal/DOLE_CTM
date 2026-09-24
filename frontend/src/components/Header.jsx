import React from 'react';
import { Link } from 'react-router-dom';

export default function Header({ lang, setLang, title, subtitle }) {
  return (
    <>
      <div className="dole-tricolor-bar" />
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: 'var(--border-hairline)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img
            src="/dolelogo.png"
            alt="Department of Labor and Employment Logo"
            className="dole-logo-img"
            style={{ width: '48px', height: '48px', display: 'block' }}
          />
          <div>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--dole-blue)',
            }}>
              Republic of the Philippines · DOLE
            </div>
            <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              {title || 'Client Transaction Monitoring System'}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {setLang && (
            <button
              onClick={() => setLang(lang === 'en' ? 'fil' : 'en')}
              className="btn btn-outline btn-sm"
              style={{ fontWeight: 600, minHeight: '36px' }}
            >
              🌐 {lang === 'en' ? 'Filipino' : 'English'}
            </button>
          )}
          <Link to="/staff/login" className="btn btn-outline btn-sm" style={{ minHeight: '36px' }}>
            Staff Portal
          </Link>
        </div>
      </header>
    </>
  );
}
