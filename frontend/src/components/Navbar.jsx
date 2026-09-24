import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/staff/login');
  };

  const navLinkStyle = ({ isActive }) => ({
    padding: '0.5rem 0.875rem',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: isActive ? 'var(--dole-blue)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--dole-blue-light)' : 'transparent',
    borderBottom: isActive ? '2px solid var(--dole-blue)' : '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'all 0.15s ease',
  });

  return (
    <>
      <div className="dole-tricolor-bar" />
      <nav style={{
        backgroundColor: '#ffffff',
        borderBottom: 'var(--border-hairline)',
        padding: '0.65rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/dolelogo.png"
              alt="DOLE Logo"
              className="dole-logo-img"
              style={{ width: '38px', height: '38px' }}
            />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--dole-red)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                DOLE CTMS
              </div>
              <strong style={{ color: 'var(--dole-blue)', fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                Staff Portal
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <NavLink to="/staff/queue" style={navLinkStyle}>
              📋 Queue Management
            </NavLink>
            <NavLink to="/staff/transactions" style={navLinkStyle}>
              📊 Transactions
            </NavLink>
            <NavLink to="/staff/reports" style={navLinkStyle}>
              📈 Reports & Survey Rate
            </NavLink>
            <NavLink to="/staff/qr" style={navLinkStyle}>
              🖨️ Check-in QR
            </NavLink>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--dole-blue)' }}>{user?.username}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
              {user?.is_superuser
                ? 'DOLE Administrator (All Offices)'
                : (user?.assigned_offices?.[0]
                    ? `${user.assigned_offices[0].name} (${user.assigned_offices[0].code})`
                    : 'Window Staff')}
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ minHeight: '34px' }}>
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
}
