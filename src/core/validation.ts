/**
 * Zod validators for user-provided inputs (files / URLs).
 *
 * AGENTS.md requirement: validate import/export/upload (size + type).
 */

import { z } from 'zod';

export const MAX_HTML_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGE_BYTES = 200 * 1024; // 200KB

export const httpUrlSchema = z
    .string()
    .trim()
    .url()
    .refine((value) => {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }, { error: 'URL must use http/https' });

const fileSchema = z.custom<File>((value) => value instanceof File, {
    error: 'Invalid file',
});

export const htmlFileSchema = fileSchema
    .refine((file) => /\.html?$/i.test(file.name), { error: 'Only .html/.htm files are allowed' })
    .refine((file) => file.size <= MAX_HTML_FILE_BYTES, { error: `HTML file is too large (max ${MAX_HTML_FILE_BYTES} bytes)` });

export const imageFileSchema = fileSchema
    .refine((file) => file.size <= MAX_IMAGE_BYTES, { error: `Image is too large (max ${MAX_IMAGE_BYTES} bytes)` })
    .refine(
        (file) => ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type),
        { error: 'Only png/jpeg/webp/svg images are allowed' }
    );

