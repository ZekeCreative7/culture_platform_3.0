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

  return (
    <input
      type="search"
      className={className}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange && onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      autoComplete="off"
    />
  );
}
