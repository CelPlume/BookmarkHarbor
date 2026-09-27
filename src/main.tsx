/**
 * BookmarkHarbor 入口文件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Providers } from './providers';

// 初始化 i18n
import './i18n';

// 样式
import './styles/index.css';

// 渲染应用
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Providers>
            <App />
        </Providers>
    </React.StrictMode>
);
