import React from 'react';

export function PageHead({ eyebrow, title, description, actions }) {
  return (
    <section className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h1>{title}</h1>}
        {description && <p>{description}</p>}
      </div>
      <div>
        {actions}
      </div>
    </section>
  );
}
