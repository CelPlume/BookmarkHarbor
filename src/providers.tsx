/**
 * HeroUI Provider 配置
 */

import React from 'react';
import { Toast } from '@heroui/react';

interface ProvidersProps {
    children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <>
            <Toast.Provider placement="top" maxVisibleToasts={3} className="mt-14" />
            {children}
        </>
    );
}
