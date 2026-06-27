import React from 'react';

export function Drawer({ open, onClose, title, subtitle, children, actions }) {
  if (!open) return null;

  return (
    <>
      {/* Mobile: Bottom Sheet Backdrop */}
      <div className="org-bottomsheet-backdrop is-open" onClick={onClose} />
      
      {/* Mobile: Bottom Sheet */}
      <div className="org-bottomsheet is-open">
        <div className="org-bottomsheet-handle" />
        <div className="org-bottomsheet-header">
          <div>
            <div className="org-panel-team-name">{title}</div>
            <div className="org-panel-team-meta">{subtitle}</div>
          </div>
          <button className="org-bottomsheet-close" onClick={onClose}>
            ×
          </button>
        </div>
        {actions && <div className="org-bottomsheet-actions">{actions}</div>}
        <div className="org-bottomsheet-members">{children}</div>
      </div>

      {/* Desktop: Right Side Panel */}
      <aside className="org-team-panel panel">
        <div className="org-panel-header">
          <div>
            <div className="org-panel-team-name">{title}</div>
            <div className="org-panel-team-meta">{subtitle}</div>
          </div>
          <button
            className="ghost compact"
            onClick={onClose}
            title="닫기"
            style={{ marginLeft: 'auto', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}
          >
            ×
          </button>
        </div>
        {actions && <div className="org-panel-actions">{actions}</div>}
        <div className="org-panel-members">{children}</div>
      </aside>
    </>
  );
}
