import React from 'react';

export function Badge({
  variant = 'status',
  status,
  color,
  done = false,
  children
}) {
  const classes = [];

  if (variant === 'status') {
    classes.push('status-badge');
    if (status) {
      classes.push(status);
    }
  } else if (variant === 'score') {
    classes.push('badge');
    if (color) {
      classes.push(color);
    }
  } else if (variant === 'pill') {
    classes.push('pill');
    if (done) {
      classes.push('done');
    }
  }

  return (
    <span className={classes.join(' ')}>
      {children}
    </span>
  );
}
