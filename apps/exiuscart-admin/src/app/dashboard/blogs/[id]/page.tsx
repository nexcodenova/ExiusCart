'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { AdminBlogEditor } from '@/components/blog-editor';

export default function EditAdminBlogPostPage() {
  const params = useParams();
  const id = Number(params.id);
  return <Suspense fallback={null}><AdminBlogEditor postId={id} /></Suspense>;
}
