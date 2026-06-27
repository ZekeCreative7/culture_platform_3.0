import React from 'react';
import { Button } from './Button.jsx';

export function FilterBar({
  filters = [],
  onSearch,
  searchLabel = '결과 보기'
}) {
  return (
    <div className="filter-bar">
      {filters.map((filter) => (
        <select
          key={filter.id}
          id={filter.id}
          value={filter.value ?? ''}
          onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
        >
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {onSearch && (
        <Button variant="primary" size="compact" onClick={onSearch}>
          {searchLabel}
        </Button>
      )}
    </div>
  );
}
