'use client';

import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

// The article HTML comes from the admin's rich-text editor. It is cleaned in
// the browser (DOMPurify needs a DOM) before being shown.
export default function PostBody({ html }: { html: string }) {
  const [clean, setClean] = useState('');
  useEffect(() => { setClean(DOMPurify.sanitize(html)); }, [html]);
  return <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: clean }} />;
}
