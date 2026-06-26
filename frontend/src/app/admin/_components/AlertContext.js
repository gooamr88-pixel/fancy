'use client';

import React, { createContext, useContext, useState } from 'react';
import { Button } from './Modal';
import { T } from './theme';

const AlertContext = createContext({
  showAlert: async () => {},
  showConfirm: async () => {},
  showPrompt: async () => {},
  showToast: () => {},
});

export const useAlert = () => useContext(AlertContext);

export function AlertProvider({ children }) {
  const [modal, setModal] = useState(null); // { title, message, type, defaultValue, confirmText, cancelText, resolve }
  const [toasts, setToasts] = useState([]); // Array of { id, message, type }

  const showAlert = (message, title = 'Notification', type = 'info') => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type,
        confirmText: 'OK',
        resolve: (val) => {
          setModal(null);
          resolve(val);
        },
      });
    });
  };

  const showConfirm = (message, title = 'Confirm Action', type = 'warning') => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        resolve: (val) => {
          setModal(null);
          resolve(val);
        },
      });
    });
  };

  const showPrompt = (message, title = 'Input Required', defaultValue = '') => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type: 'prompt',
        defaultValue,
        confirmText: 'Submit',
        cancelText: 'Cancel',
        resolve: (val) => {
          setModal(null);
          resolve(val);
        },
      });
    });
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Icon mapping for types
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: T.successSoft, color: T.success, border: `1px solid rgba(16, 185, 129, 0.2)` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
        );
      case 'danger':
      case 'error':
        return (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: T.dangerSoft, color: T.danger, border: `1px solid rgba(239, 68, 68, 0.2)` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          </span>
        );
      case 'warning':
        return (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: T.warningSoft, color: T.warning, border: `1px solid rgba(245, 158, 11, 0.2)` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </span>
        );
      default:
        return (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: T.primarySoft, color: T.primary, border: `1px solid rgba(184, 148, 79, 0.2)` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </span>
        );
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showPrompt, showToast }}>
      {children}

      {/* Modal Dialog */}
      {modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(25, 27, 30, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 99999,
          }}
        >
          <div
            style={{
              background: T.surface,
              borderRadius: T.radius,
              border: `1px solid ${T.border}`,
              boxShadow: T.shadowMd,
              width: '100%',
              maxWidth: 420,
              padding: '28px',
              boxSizing: 'border-box',
              animation: 'alertFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <AlertDialogInner modal={modal} getIcon={getIcon} />
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 999999, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              background: T.surface,
              borderLeft: `4px solid ${t.type === 'error' ? T.danger : t.type === 'warning' ? T.warning : T.success}`,
              borderTop: `1px solid ${T.border}`,
              borderRight: `1px solid ${T.border}`,
              borderBottom: `1px solid ${T.border}`,
              boxShadow: T.shadow,
              padding: '12px 20px',
              borderRadius: '0 8px 8px 0',
              fontSize: 13,
              fontWeight: 600,
              color: T.text900,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minWidth: 260,
              maxWidth: 380,
              animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {t.type === 'error' ? (
              <span style={{ color: T.danger, fontWeight: 800 }}>✕</span>
            ) : t.type === 'warning' ? (
              <span style={{ color: T.warning }}>⚠️</span>
            ) : (
              <span style={{ color: T.success, fontWeight: 800 }}>✓</span>
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  );
}

function AlertDialogInner({ modal, getIcon }) {
  const [inputValue, setInputValue] = useState(modal.defaultValue || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (modal.type === 'prompt') {
      modal.resolve(inputValue);
    } else {
      modal.resolve(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ marginBottom: 16 }}>{getIcon(modal.type)}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text900, margin: '0 0 10px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
        {modal.title}
      </h3>
      <p style={{ fontSize: 13.5, color: T.text700, margin: '0 0 20px', lineHeight: 1.5 }}>
        {modal.message}
      </p>

      {modal.type === 'prompt' && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            fontSize: 13,
            background: T.surfaceAlt,
            color: T.text900,
            outline: 'none',
            marginBottom: 20,
            boxSizing: 'border-box',
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
        {modal.cancelText && (
          <Button variant="ghost" type="button" onClick={() => modal.resolve(modal.type === 'prompt' ? null : false)}>
            {modal.cancelText}
          </Button>
        )}
        <Button variant={modal.type === 'danger' || modal.type === 'error' ? 'danger' : 'primary'} type="submit">
          {modal.confirmText}
        </Button>
      </div>
    </form>
  );
}
