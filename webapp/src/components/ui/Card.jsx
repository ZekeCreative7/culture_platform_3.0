import React from 'react';

export function Card({
  tight = false,
  className = '',
  children,
  ...props
}) {
  const classes = ['panel'];

  if (tight) {
    classes.push('tight');
  }

  if (className) {
    classes.push(className);
  }

  return (
    <div className={classes.join(' ')} {...props}>
      {children}
    </div>
  );
}
