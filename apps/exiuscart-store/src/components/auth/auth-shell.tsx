import { Card } from '@/components/ui/card';
import { AuthHeader } from '@/components/auth/auth-header';

// Same chrome as the login page (top bar, warm background, white rounded
// card) so the password-reset screens read as part of the same flow.
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col">
      <AuthHeader />
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <Card className="w-full max-w-sm bg-white border-gray-200 rounded-3xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
          {subtitle && <p className="text-gray-500 text-sm mb-6">{subtitle}</p>}
          {children}
        </Card>
      </div>
    </div>
  );
}
