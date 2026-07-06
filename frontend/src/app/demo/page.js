import DemoPageClient from './DemoPageClient';

// This is an interactive sandbox tool, not indexable marketing content.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoPageClient />;
}
