'use client';

import { useParams } from 'next/navigation';
import { AdminBlogEditor } from '@/components/blog-editor';

export default function EditAdminBlogPostPage() {
  const params = useParams();
  const id = Number(params.id);
  return <AdminBlogEditor postId={id} />;
}
