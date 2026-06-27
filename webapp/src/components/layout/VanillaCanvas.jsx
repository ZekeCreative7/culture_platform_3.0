import React, { useState, useEffect, useRef } from 'react';

const VANILLA_VIEWS = ['sessions', 'org', 'report', 'survey', 'comm', 'pulse', 'dashboard'];

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
