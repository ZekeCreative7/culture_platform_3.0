import React from 'react';

export function Button({
  variant = 'primary',
  size,
  danger = false,
  loading = false,
  children,
  className = '',
  ...props
}) {
  const classes = [];

  if (variant === 'primary') classes.push('primary');
  else if (variant === 'secondary') classes.push('secondary');
  else if (variant === 'ghost') classes.push('ghost');

  if (size === 'compact') classes.push('compact');
  if (danger) classes.push('danger');
  if (loading) classes.push('is-loading');

  if (className) classes.push(className);

  return (
    <button className={classes.join(' ')} {...props}>
      {children}
    </button>
  );
}
