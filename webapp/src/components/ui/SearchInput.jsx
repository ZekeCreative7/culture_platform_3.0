import React from 'react';

export function SearchInput({
  placeholder,
  value,
  onChange,
  onEnter,
  variant = 'form'
}) {
  const className = variant === 'topbar' ? 'searchbox' : 'input-text';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      onEnter(e.target.value);
    }
  };

  if (variant === 'topbar') {
    return (
      <div className="searchbox-wrap">
        <svg className="searchbox-icon" viewBox="0 0 16 16" fill="none" width="15" height="15">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          className="searchbox"
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>
    );
  }

  return (
    <input
      type="search"
      className="input-text"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange && onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      autoComplete="off"
    />
  );
}
