'use client';

import { Suspense } from 'react';
import { AdminBlogEditor } from '@/components/blog-editor';

export default function NewAdminBlogPostPage() {
  return <Suspense fallback={null}><AdminBlogEditor /></Suspense>;
}
