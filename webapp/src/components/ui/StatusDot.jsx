import React from 'react';

export function StatusDot({ color = 'default', type = 'status' }) {
  const classes = [];

  if (type === 'db') {
    classes.push('db-dot');
    if (color !== 'default') {
      classes.push(color);
    }
  } else {
    classes.push('status-dot');
    if (color === 'red') {
      classes.push('dot-red');
    } else if (color === 'purple') {
      classes.push('dot-purple');
    }
  }

  return <div className={classes.join(' ')} />;
}
