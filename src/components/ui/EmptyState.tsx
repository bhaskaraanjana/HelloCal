import React from 'react';
import type { ReactNode } from 'react';

interface EmptyStateAction {
  icon: ReactNode;
  label: string;
  hint?: string;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: EmptyStateAction[]; // optional method cards (e.g. Voice ~5s, Photo ~3s, Type)
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actions
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
        gap: '0.75rem'
      }}
    >
      {/* Gradient halo behind the icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 50% 50%, var(--accent-purple-glow) 0%, transparent 70%)',
          color: 'var(--accent-purple)',
          marginBottom: '0.25rem',
          animation: 'float 4s ease-in-out infinite'
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.02em'
        }}
      >
        {title}
      </h3>

      {subtitle && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            margin: 0,
            maxWidth: '24rem',
            lineHeight: 1.5
          }}
        >
          {subtitle}
        </p>
      )}

      {actions && actions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.75rem',
            marginTop: '1rem',
            width: '100%'
          }}
        >
          {actions.map((action, index) => (
            <div
              key={`${action.label}-${index}`}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '1rem 0.75rem',
                borderRadius: '14px',
                minWidth: '88px',
                flex: '0 1 110px'
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-purple)'
                }}
              >
                {action.icon}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                {action.label}
              </span>
              {action.hint && (
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  {action.hint}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
