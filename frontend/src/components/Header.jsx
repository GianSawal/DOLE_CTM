import React from 'react';
import { Link } from 'react-router-dom';

export default function Header({ lang, setLang, title, subtitle }) {
  return (
    <>
      <div className="dole-tricolor-bar" />
      <header className="dole-public-header">
        <div className="dole-header-brand">
          <img
            src="/dolelogo.png"
            alt="Department of Labor and Employment Logo"
            className="dole-logo-img dole-header-logo"
          />
          <div className="dole-header-info">
            <div className="dole-header-rep">
              Republic of the Philippines · DOLE
            </div>
            <h1 className="dole-header-title">
              {title || 'Client Transaction Monitoring System'}
            </h1>
            {subtitle && (
              <p className="dole-header-subtitle">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="dole-header-actions">
          {setLang && (
            <button
              onClick={() => setLang(lang === 'en' ? 'fil' : 'en')}
              className="btn btn-outline btn-sm"
              style={{ fontWeight: 600 }}
              title={lang === 'en' ? 'Switch to Filipino' : 'Switch to English'}
            >
              <span>🌐</span>
              <span className="lang-text-desktop">{lang === 'en' ? 'Filipino' : 'English'}</span>
              <span className="lang-text-mobile">{lang === 'en' ? 'FIL' : 'ENG'}</span>
            </button>
          )}
          <Link to="/staff/login" className="btn btn-outline btn-sm" title="Go to Staff Portal">
            <span className="staff-text-desktop">Staff Portal</span>
            <span className="staff-text-mobile">Staff</span>
          </Link>
        </div>
      </header>
    </>
  );
}
