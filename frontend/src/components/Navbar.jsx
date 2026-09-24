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
    padding: '0.45rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontSize: '0.86rem',
    fontWeight: 600,
    color: isActive ? 'var(--dole-blue)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'var(--dole-blue-light)' : 'transparent',
    borderBottom: isActive ? '2px solid var(--dole-blue)' : '2px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  });

  return (
    <>
      <div className="dole-tricolor-bar" />
      <nav className="staff-navbar">
        <div className="staff-navbar-main">
          <div className="staff-navbar-brand">
            <img
              src="/dolelogo.png"
              alt="DOLE Logo"
              className="dole-logo-img staff-logo"
            />
            <div>
              <div className="staff-logo-sub">DOLE CTMS</div>
              <strong className="staff-logo-title">Staff Portal</strong>
            </div>
          </div>

          <div className="staff-navbar-user">
            <div className="staff-user-info">
              <div className="staff-user-name">{user?.username}</div>
              <div className="staff-user-office">
                {user?.is_superuser
                  ? 'DOLE Admin'
                  : (user?.assigned_offices?.[0]?.code || 'Staff')}
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-outline btn-sm staff-signout-btn">
              Sign Out
            </button>
          </div>
        </div>

        <div className="staff-navbar-links">
          <NavLink to="/staff/queue" style={navLinkStyle}>
            📋 Queue
          </NavLink>
          <NavLink to="/staff/transactions" style={navLinkStyle}>
            📊 Transactions
          </NavLink>
          <NavLink to="/staff/reports" style={navLinkStyle}>
            📈 Reports & Rate
          </NavLink>
          <NavLink to="/staff/qr" style={navLinkStyle}>
            🖨️ Check-in QR
          </NavLink>
        </div>
      </nav>
    </>
  );
}
