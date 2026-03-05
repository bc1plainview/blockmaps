import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { MintPage } from './pages/MintPage.js';
import { GalleryPage } from './pages/GalleryPage.js';
import { DetailPage } from './pages/DetailPage.js';
import { MyBlockMapsPage } from './pages/MyBlockMapsPage.js';
import { TxDetailPage } from './pages/TxDetailPage.js';

export function App(): React.ReactElement {
    return (
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<MintPage />} />
                    <Route path="/gallery" element={<GalleryPage />} />
                    <Route path="/block/:height" element={<DetailPage />} />
                    <Route path="/my" element={<MyBlockMapsPage />} />
                    <Route path="/tx/:txid" element={<TxDetailPage />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}
