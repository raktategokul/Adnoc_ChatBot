import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked with GitHub Flavored Markdown and line breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Enterprise Markdown & Table Renderer for OASIS AI Copilot
 * Renders Markdown tables, headers, lists, code, callouts, bold, and links cleanly.
 */
export default function MarkdownRenderer({ content }) {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content);
    } catch (e) {
      console.warn('Markdown parsing error:', e);
      return content;
    }
  }, [content]);

  return (
    <div
      className="oasis-markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
