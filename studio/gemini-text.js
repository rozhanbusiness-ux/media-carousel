// ============================================================
//  studio/gemini-text.js — one place for the studio's text model.
//  Gemini 2.5 Flash is retired on 2026-12-01 (requests are then
//  redirected to 3.5 Flash-Lite, which rejects or ignores some of the
//  old settings). Flash-Lite: `thinkingLevel` instead of a numeric
//  `thinkingBudget`; temperature/topP/topK are ignored, so they are
//  not sent (style and determinism come from the prompt).
// ============================================================

const TEXT_MODEL = 'gemini-3.5-flash-lite';

/** generationConfig for JSON answers; `maxOutputTokens` per call. */
const jsonConfig = (maxOutputTokens) => ({ responseMimeType: 'application/json', maxOutputTokens, thinkingConfig: { thinkingLevel: 'minimal' } });

const endpoint = () => `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`;

module.exports = { TEXT_MODEL, jsonConfig, endpoint };
