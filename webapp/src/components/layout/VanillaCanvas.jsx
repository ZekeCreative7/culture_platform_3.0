import React, { useState, useEffect, useRef } from 'react';

// All views now have React page components — VanillaCanvas is no longer used
// but kept here in case a future view needs the bridge pattern.
const VANILLA_VIEWS = [];

export function isVanillaView(view) {
  return VANILLA_VIEWS.includes(view);
}

export function VanillaCanvas({ view }) {
  const [html, setHtml] = useState('');
  const divRef = useRef(null);

  useEffect(() => {
    if (!window.__vanillaRenderView) return;
    const rendered = window.__vanillaRenderView(view);
    setHtml(rendered || '');
  }, [view]);

  // After HTML is painted, bind event handlers
  useEffect(() => {
    if (!html || !divRef.current) return;
    requestAnimationFrame(() => {
      window.__vanillaBindCanvas?.();
    });
  }, [html]);

  return (
    <div
      ref={divRef}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
