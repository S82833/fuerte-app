import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {finalizeProductPwa} from './scripts/product-pwa.mjs';
export default defineConfig({plugins:[react(),{name:'fuerte-product-pwa',closeBundle(){finalizeProductPwa('dist-product');}}],css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:'dist-product',rolldownOptions:{input:{app:'product.html',landing:'landing.html'}}}});
