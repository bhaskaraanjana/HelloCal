import React from 'react';
import { X } from 'lucide-react';

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}) => {
  if (!isOpen) return null;

  const getWidth = () => {
    switch (size) {
      case 'sm': return '360px';
      case 'lg': return '640px';
      default: return '480px';
    }
  };

  return (
    <div 
      className="no-collapse"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(9, 10, 16, 0.75)',
        backdropFilter: 'blur(12px) saturate(140%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1.5rem',
        boxSizing: 'border-box',
        animation: 'fadeInBackdrop 0.25s ease-out forwards'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: getWidth(),
          maxWidth: '100%',
          background: 'rgba(25, 26, 36, 0.95)',
          border: '1px solid var(--border-glass-glow)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleInModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          color: 'var(--text-primary)'
        }}
      >
        {/* Header */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
          }}
        >
          <h3 
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              color: 'var(--text-primary)'
            }}
          >
            {title}
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              padding: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div 
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            maxHeight: '70vh',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            color: 'var(--text-secondary)'
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div 
            style={{
              padding: '1.1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.04)',
              background: 'rgba(255, 255, 255, 0.01)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleInModal {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      ` }} />
    </div>
  );
};
export default CustomModal;
