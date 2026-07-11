import React from 'react';

export function SearchInput({
  placeholder,
  value,
  onChange,
  onEnter,
  variant = 'form'
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      onEnter(e.target.value);
    }
  };

  // value가 주어지면 controlled, 아니면 uncontrolled로 동작한다.
  // (Topbar 검색창은 상태를 상위에서 관리하지 않으므로 uncontrolled여야 타이핑이 먹는다.)
  const isControlled = value !== undefined;
  const bindProps = isControlled
    ? { value, onChange: (e) => onChange && onChange(e.target.value) }
    : { defaultValue: '', onChange: (e) => onChange && onChange(e.target.value) };

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
          onKeyDown={handleKeyDown}
          autoComplete="off"
          {...bindProps}
        />
      </div>
    );
  }

  return (
    <input
      type="search"
      className="input-text"
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      autoComplete="off"
      {...bindProps}
    />
  );
}
