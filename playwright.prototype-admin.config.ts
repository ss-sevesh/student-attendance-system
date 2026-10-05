import { defineConfig } from '@playwright/test';
import config from './playwright.admin.config';
export default defineConfig({ ...config, testMatch: 'prototype.spec.ts', reporter: 'list' });
