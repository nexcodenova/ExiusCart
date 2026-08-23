'use client';

import { useParams } from 'next/navigation';
import { BlogEditor } from '@/components/blog-editor';

export default function EditBlogPostPage() {
  const params = useParams();
  const id = Number(params.id);
  return <BlogEditor postId={id} />;
}
