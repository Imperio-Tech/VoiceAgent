'use client';

import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const UnicornScene = dynamic(() => import('unicornstudio-react'), { ssr: false });

export const RaycastBackground = () => {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!size) return null;

  return (
    <div
      className={cn('fixed inset-0 pointer-events-none')}
      style={{ zIndex: 0 }}
    >
      <UnicornScene
        production={true}
        projectId="cbmTT38A0CcuYxeiyj5H"
        width={size.width}
        height={size.height}
      />
    </div>
  );
};

export default RaycastBackground;
