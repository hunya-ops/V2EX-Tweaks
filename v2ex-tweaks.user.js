// ==UserScript==
// @name         v2ex-tweaks
// @namespace    https://github.com/hunya-ops/V2EX-Tweaks
// @version      0.2.0
// @description  V2EX 体验增强脚本集合（每日自动签到、粘贴图片自动上传）
// @author       hunya-ops
// @license      MIT
// @homepageURL  https://github.com/hunya-ops/V2EX-Tweaks
// @supportURL   https://github.com/hunya-ops/V2EX-Tweaks/issues
// @match        https://v2ex.com/*
// @match        https://www.v2ex.com/*
// @match        https://fast.v2ex.com/*
// @match        https://global.v2ex.com/*
// @match        https://cn.v2ex.com/*
// @exclude      https://v2ex.com/api/*
// @exclude      https://*.v2ex.com/api/*
// @icon         https://www.v2ex.com/static/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.imgur.com
// @connect      catbox.moe
// @connect      imgurl.org
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 仅在 HTML 页面中运行
    if (document.contentType && !document.contentType.includes('html')) {
        return;
    }

    const SCRIPT_NAME = 'v2ex-tweaks';

    /* =========================================================================
     * 工具模块 (Core Utilities)
     * ========================================================================= */

    const log = {
        info: (...args) => console.info(`[${SCRIPT_NAME}]`, ...args),
        warn: (...args) => console.warn(`[${SCRIPT_NAME}]`, ...args),
        error: (...args) => console.error(`[${SCRIPT_NAME}]`, ...args),
    };

    const storage = {
        get(key, defaultValue) {
            try {
                return GM_getValue(key, defaultValue);
            } catch {
                const raw = localStorage.getItem(`${SCRIPT_NAME}:${key}`);
                if (raw === null) return defaultValue;
                try {
                    return JSON.parse(raw);
                } catch {
                    return defaultValue;
                }
            }
        },
        set(key, value) {
            try {
                GM_setValue(key, value);
            } catch {
                localStorage.setItem(`${SCRIPT_NAME}:${key}`, JSON.stringify(value));
            }
        },
    };

    /**
     * 获取当前 UTC 日期字符串（YYYY-MM-DD）
     * V2EX 每日签到按 UTC 00:00（北京时间 08:00）刷新
     */
    function getUtcDateString() {
        return new Date().toISOString().slice(0, 10);
    }

    /**
     * 获取当前已登录的用户名；未登录时返回 null
     */
    function getCurrentUser() {
        const memberLink = document.querySelector(
            '#Top a[href^="/member/"], #menu-body a[href^="/member/"]'
        );
        if (!memberLink) return null;
        const match = memberLink.getAttribute('href')?.match(/^\/member\/([^/?#]+)/);
        return match ? match[1] : null;
    }

    function isDarkTheme() {
        return (
            document.documentElement.classList.contains('Night') ||
            document.body?.classList.contains('Night') ||
            Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)
        );
    }

    /**
     * 在页面右上角展示轻量提示条
     * @param {string} message
     * @param {'info'|'success'|'error'} type
     * @param {number} durationMs
     */
    function showToast(message, type = 'info', durationMs = 4000) {
        const isDark = isDarkTheme();

        const accentColors = {
            info: '#3b82f6',
            success: '#22c55e',
            error: '#ef4444',
        };

        let container = document.getElementById('v2ex-tweaks-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'v2ex-tweaks-toast-container';
            Object.assign(container.style, {
                position: 'fixed',
                top: '16px',
                right: '16px',
                zIndex: '99999',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'none',
            });
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            lineHeight: '1.4',
            color: isDark ? '#e5e7eb' : '#1f2937',
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderLeft: `4px solid ${accentColors[type] || accentColors.info}`,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            opacity: '0',
            transform: 'translateY(-6px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: 'auto',
            cursor: 'pointer',
            maxWidth: '320px',
            wordBreak: 'break-word',
        });

        const dismiss = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-6px)';
            setTimeout(() => toast.remove(), 220);
        };

        toast.addEventListener('click', dismiss);
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        if (durationMs > 0) {
            setTimeout(dismiss, durationMs);
        }
    }

    /* =========================================================================
     * 功能注册管理 (Feature Registry)
     * 后续新增功能时，只需按同样结构添加到 features 数组中即可
     * ========================================================================= */

    const features = [];

    function isFeatureEnabled(feature) {
        return storage.get(`feature:${feature.id}:enabled`, feature.defaultEnabled);
    }

    function registerFeature(feature) {
        features.push(feature);
    }

    function bootstrapFeatures() {
        for (const feature of features) {
            const enabled = isFeatureEnabled(feature);

            if (typeof GM_registerMenuCommand === 'function') {
                GM_registerMenuCommand(
                    `${enabled ? '✅' : '⬜'} ${feature.name}`,
                    () => {
                        storage.set(`feature:${feature.id}:enabled`, !enabled);
                        showToast(
                            `已${enabled ? '关闭' : '开启'}「${feature.name}」，刷新页面后生效`,
                            'info',
                            2500
                        );
                        setTimeout(() => location.reload(), 600);
                    }
                );
            }

            if (enabled) {
                try {
                    feature.init();
                } catch (err) {
                    log.error(`功能 [${feature.id}] 初始化失败:`, err);
                }
            }
        }
    }

    /* =========================================================================
     * 功能 1：每日自动签到 (autoCheckin)
     * ========================================================================= */

    const autoCheckinFeature = {
        id: 'autoCheckin',
        name: '每日自动签到',
        defaultEnabled: true,

        LOCK_KEY: `${SCRIPT_NAME}:checkin_lock`,
        LOCK_TTL_MS: 15_000,

        getDateStorageKey(username) {
            return `autoCheckin:lastDate:${username}`;
        },

        acquireLock() {
            const now = Date.now();
            const existing = Number(localStorage.getItem(this.LOCK_KEY) || 0);
            if (existing && now - existing < this.LOCK_TTL_MS) {
                return false;
            }
            localStorage.setItem(this.LOCK_KEY, String(now));
            return true;
        },

        releaseLock() {
            localStorage.removeItem(this.LOCK_KEY);
        },

        /**
         * 签到完成后，同步隐藏侧边栏的“领取今日的登录奖励”提示
         */
        updateSidebarPrompt() {
            const link = document.querySelector('#Rightbar a[href="/mission/daily"]');
            if (!link) return;
            const box = link.closest('.box');
            if (box && box.querySelectorAll('.cell, .inner').length === 1) {
                if (box.nextElementSibling?.classList.contains('sep20')) {
                    box.nextElementSibling.style.display = 'none';
                }
                box.style.display = 'none';
            } else {
                link.closest('.inner, .cell')?.style.setProperty('display', 'none');
            }
        },

        /**
         * 判断 /mission/daily 响应是否已领取今日奖励（兼容中英文界面）
         */
        isAlreadyClaimed(html) {
            return (
                html.includes('每日登录奖励已领取') ||
                html.includes('已成功领取每日登录奖励') ||
                (!html.includes('/mission/daily/redeem?once=') &&
                    html.includes("location.href = '/balance'"))
            );
        },

        /**
         * 从响应文本中解析连续登录天数
         */
        extractStreakText(html) {
            const match = html.match(/已连续登录\s*\d+\s*天/);
            return match ? match[0] : '';
        },

        /**
         * 执行签到流程
         * @param {{ force?: boolean }} options
         */
        async runCheckin({ force = false } = {}) {
            const username = getCurrentUser();
            if (!username) {
                if (force) {
                    showToast('当前未登录 V2EX，无法签到', 'error');
                }
                return;
            }

            const todayUtc = getUtcDateString();
            const storageKey = this.getDateStorageKey(username);

            if (!force && storage.get(storageKey, '') === todayUtc) {
                return;
            }

            if (!this.acquireLock()) {
                return;
            }

            const missionUrl = `${location.origin}/mission/daily`;

            try {
                // 1. 获取每日任务页，检查状态并提取 once 参数
                const missionResp = await fetch(missionUrl, {
                    method: 'GET',
                    credentials: 'same-origin',
                });

                if (!missionResp.ok) {
                    throw new Error(`请求 /mission/daily 失败 (HTTP ${missionResp.status})`);
                }

                // 如果会话失效被重定向到登录页
                if (missionResp.url.includes('/signin')) {
                    log.warn('登录状态已失效，跳过自动签到');
                    return;
                }

                const missionHtml = await missionResp.text();

                // 已经领取过今日奖励
                if (this.isAlreadyClaimed(missionHtml)) {
                    storage.set(storageKey, todayUtc);
                    this.updateSidebarPrompt();
                    log.info(`用户 ${username} 今日（UTC ${todayUtc}）已签到`);
                    if (force) {
                        const streak = this.extractStreakText(missionHtml);
                        showToast(
                            streak ? `今日已签到（${streak}）` : '今日已签到',
                            'info'
                        );
                    }
                    return;
                }

                // 提取动态签到路径：/mission/daily/redeem?once=XXXXX
                const redeemMatch = missionHtml.match(/\/mission\/daily\/redeem\?once=\d+/);
                if (!redeemMatch) {
                    log.warn('未在 /mission/daily 页面中找到 once 参数，可能页面结构变化或账号受限');
                    if (force) {
                        showToast('未找到签到入口，请手动前往每日任务页查看', 'error');
                    }
                    return;
                }

                const redeemUrl = `${location.origin}${redeemMatch[0]}`;

                // 2. 携带同源 Referer 发起领取请求
                const redeemResp = await fetch(redeemUrl, {
                    method: 'GET',
                    credentials: 'same-origin',
                    referrer: missionUrl,
                });

                if (!redeemResp.ok) {
                    throw new Error(`请求签到接口失败 (HTTP ${redeemResp.status})`);
                }

                const redeemHtml = await redeemResp.text();
                const isSuccess = this.isAlreadyClaimed(redeemHtml);

                if (isSuccess) {
                    storage.set(storageKey, todayUtc);
                    this.updateSidebarPrompt();
                    const streak = this.extractStreakText(redeemHtml);
                    const msg = streak
                        ? `V2EX 自动签到成功（${streak}）`
                        : 'V2EX 自动签到成功';
                    log.info(msg);
                    showToast(msg, 'success');

                    // 如果当前正停留在每日任务页，刷新展示最新状态
                    if (location.pathname === '/mission/daily') {
                        setTimeout(() => location.reload(), 1000);
                    }
                } else {
                    log.warn('签到请求已返回，但未确认成功状态');
                    if (force) {
                        showToast('签到结果未确认，请前往每日任务页检查', 'error');
                    }
                }
            } catch (err) {
                log.error('自动签到出错:', err);
                if (force) {
                    showToast(`签到失败：${err.message}`, 'error');
                }
            } finally {
                this.releaseLock();
            }
        },

        init() {
            if (typeof GM_registerMenuCommand === 'function') {
                GM_registerMenuCommand('🎯 立即检查 / 手动签到', () => {
                    this.runCheckin({ force: true });
                });
            }

            // 页面空闲时执行，避免阻塞页面首屏渲染
            const trigger = () => this.runCheckin({ force: false });
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(trigger, { timeout: 3000 });
            } else {
                setTimeout(trigger, 500);
            }
        },
    };

    registerFeature(autoCheckinFeature);

    /* =========================================================================
     * 功能 2：粘贴图片自动上传并插入 Markdown (pasteImageUpload)
     * 支持：Imgur（默认匿名免登录）、Catbox.moe（完全免注册）、ImgURL（自填 Token）
     * ========================================================================= */

    const pasteImageUploadFeature = {
        id: 'pasteImageUpload',
        name: '粘贴图片自动上传',
        defaultEnabled: true,

        IMGUR_UPLOAD_URL: 'https://api.imgur.com/3/image',
        IMGUR_DEFAULT_CLIENT_ID: '546c25a59c58ad7',
        CATBOX_UPLOAD_URL: 'https://catbox.moe/user/api.php',

        PROVIDER_LABELS: {
            imgur: 'Imgur',
            catbox: 'Catbox.moe',
            imgurl: 'ImgURL',
        },

        CONFIG_KEY: 'pasteImageUpload:config',
        DEFAULT_CONFIG: {
            provider: 'imgur',
            imgurClientId: '',
            catboxUserHash: '',
            imgurlApiVersion: 'v3',
            imgurlBaseUrl: 'https://www.imgurl.org',
            imgurlUid: '',
            imgurlToken: '',
            imgurlAlbumId: '',
        },

        uploadSeq: 0,

        getConfig() {
            const saved = storage.get(this.CONFIG_KEY, null);
            const merged = {
                ...this.DEFAULT_CONFIG,
                ...(saved && typeof saved === 'object' ? saved : {}),
            };
            if (!this.PROVIDER_LABELS[merged.provider]) {
                merged.provider = this.DEFAULT_CONFIG.provider;
            }
            return merged;
        },

        saveConfig(config) {
            const provider = this.PROVIDER_LABELS[config.provider]
                ? config.provider
                : this.DEFAULT_CONFIG.provider;
            storage.set(this.CONFIG_KEY, {
                provider,
                imgurClientId: String(config.imgurClientId || '')
                    .trim()
                    .replace(/^Client-ID\s+/i, ''),
                catboxUserHash: String(config.catboxUserHash || '').trim(),
                imgurlApiVersion: config.imgurlApiVersion === 'v2' ? 'v2' : 'v3',
                imgurlBaseUrl: String(
                    config.imgurlBaseUrl || this.DEFAULT_CONFIG.imgurlBaseUrl
                ).trim(),
                imgurlUid: String(config.imgurlUid || '').trim(),
                imgurlToken: String(config.imgurlToken || '')
                    .trim()
                    .replace(/^Bearer\s+/i, ''),
                imgurlAlbumId: String(config.imgurlAlbumId || '').trim(),
            });
        },

        isConfigReady(config) {
            if (config.provider === 'imgurl') {
                if (!config.imgurlToken) return false;
                if (config.imgurlApiVersion === 'v2' && !config.imgurlUid) return false;
            }
            return true;
        },

        resolveImgurlUploadUrl(config) {
            let base = (config.imgurlBaseUrl || this.DEFAULT_CONFIG.imgurlBaseUrl).trim();
            if (!/^https?:\/\//i.test(base)) {
                base = `https://${base}`;
            }
            base = base.replace(/\/+$/, '');
            if (/\/api\/v[23]\/upload$/i.test(base)) {
                return base;
            }
            const versionPath =
                config.imgurlApiVersion === 'v2' ? '/api/v2/upload' : '/api/v3/upload';
            return `${base}${versionPath}`;
        },

        getCodeMirrorInstance(cmEl) {
            if (!cmEl) return null;
            if (cmEl.CodeMirror && typeof cmEl.CodeMirror.getValue === 'function') {
                return cmEl.CodeMirror;
            }
            if (
                cmEl.wrappedJSObject?.CodeMirror &&
                typeof cmEl.wrappedJSObject.CodeMirror.getValue === 'function'
            ) {
                return cmEl.wrappedJSObject.CodeMirror;
            }
            try {
                const pageWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                const editor = pageWin?.editor;
                if (editor && typeof editor.getValue === 'function') {
                    const wrapper = editor.getWrapperElement?.();
                    if (!wrapper || wrapper === cmEl) {
                        return editor;
                    }
                }
            } catch {
                // ignore sandbox access errors
            }
            return null;
        },

        /**
         * 判断粘贴目标是否为 V2EX 发布主题 / 回复 / 附言 / 编辑输入框
         */
        resolveTargetEditor(target) {
            if (!target || target.nodeType !== 1) return null;

            // 1. CodeMirror 编辑器（如 /write、/new/*、/append/topic/* 等）
            const cmEl = target.closest('.CodeMirror');
            if (cmEl && cmEl.closest('#Main, form')) {
                const cm = this.getCodeMirrorInstance(cmEl);
                if (cm) {
                    return {
                        type: 'codemirror',
                        el: cmEl,
                        insertText(text) {
                            cm.replaceSelection(text);
                            cm.focus();
                        },
                        replaceText(search, replacement) {
                            const value = cm.getValue();
                            const idx = value.indexOf(search);
                            if (idx === -1) return false;
                            if (
                                typeof cm.posFromIndex === 'function' &&
                                typeof cm.replaceRange === 'function'
                            ) {
                                const from = cm.posFromIndex(idx);
                                const to = cm.posFromIndex(idx + search.length);
                                cm.replaceRange(replacement, from, to);
                            } else {
                                cm.setValue(
                                    value.slice(0, idx) +
                                        replacement +
                                        value.slice(idx + search.length)
                                );
                            }
                            return true;
                        },
                    };
                }
            }

            // 2. 原生 textarea（回复框 #reply_content、发帖/编辑/附言框等）
            if (target.tagName === 'TEXTAREA') {
                const id = target.id || '';
                const name = target.getAttribute('name') || '';
                const path = location.pathname;
                const isKnownEditorId =
                    id === 'reply_content' || id === 'topic_content' || id === 'editor';
                const isKnownContentField =
                    name === 'content' &&
                    /^\/(t\/|write\b|new\b|append\/topic\/|edit\/(topic|reply)\/)/.test(path);

                if (isKnownEditorId || isKnownContentField) {
                    return {
                        type: 'textarea',
                        el: target,
                        insertText(text) {
                            const start = target.selectionStart ?? target.value.length;
                            const end = target.selectionEnd ?? target.value.length;
                            const scrollTop = target.scrollTop;
                            if (typeof target.setRangeText === 'function') {
                                target.setRangeText(text, start, end, 'end');
                            } else {
                                target.value =
                                    target.value.slice(0, start) +
                                    text +
                                    target.value.slice(end);
                                target.selectionStart = start + text.length;
                                target.selectionEnd = start + text.length;
                            }
                            target.scrollTop = scrollTop;
                            target.focus?.();
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                        },
                        replaceText(search, replacement) {
                            const idx = target.value.indexOf(search);
                            if (idx === -1) return false;
                            const scrollTop = target.scrollTop;
                            if (typeof target.setRangeText === 'function') {
                                target.setRangeText(
                                    replacement,
                                    idx,
                                    idx + search.length,
                                    'preserve'
                                );
                            } else {
                                const selStart = target.selectionStart ?? 0;
                                const selEnd = target.selectionEnd ?? 0;
                                const delta = replacement.length - search.length;
                                target.value =
                                    target.value.slice(0, idx) +
                                    replacement +
                                    target.value.slice(idx + search.length);
                                target.selectionStart =
                                    selStart > idx ? Math.max(idx, selStart + delta) : selStart;
                                target.selectionEnd =
                                    selEnd > idx ? Math.max(idx, selEnd + delta) : selEnd;
                            }
                            target.scrollTop = scrollTop;
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                            return true;
                        },
                    };
                }
            }

            return null;
        },

        /**
         * 从粘贴事件中提取图片文件；若为富文本表格等携带文本的剪贴板内容则放行原粘贴
         */
        extractImageFiles(clipboardData) {
            if (!clipboardData) return [];

            const files = [];
            const items = clipboardData.items ? Array.from(clipboardData.items) : [];
            for (const item of items) {
                if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                }
            }

            if (files.length === 0 && clipboardData.files?.length) {
                for (const file of Array.from(clipboardData.files)) {
                    if (file.type && file.type.startsWith('image/')) {
                        files.push(file);
                    }
                }
            }

            if (files.length === 0) return [];

            // 兼容 Excel / Word 等同时写入 text/plain、text/html 和预览图的场景
            const plainText = (clipboardData.getData('text/plain') || '').trim();
            const htmlText = (clipboardData.getData('text/html') || '').trim();
            const isFilenameText = files.some((f) => f.name && f.name.trim() === plainText);
            const isSingleImgHtml =
                htmlText &&
                /^(\s*<!--[\s\S]*?-->\s*)*<img\b[^>]*>(\s*<!--[\s\S]*?-->\s*)*$/i.test(htmlText);

            if (plainText && htmlText && !isFilenameText && !isSingleImgHtml) {
                return [];
            }

            return files;
        },

        buildUploadFilename(file) {
            const mimeExtMap = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/gif': 'gif',
                'image/webp': 'webp',
                'image/bmp': 'bmp',
                'image/x-icon': 'ico',
                'image/vnd.microsoft.icon': 'ico',
            };
            const ext = mimeExtMap[file.type?.toLowerCase()] || 'png';
            const rawName = (file.name || '').trim();
            if (rawName && /\.[a-z0-9]{2,5}$/i.test(rawName)) {
                return rawName;
            }
            const base = rawName || `paste-${Date.now()}`;
            return `${base}.${ext}`;
        },

        buildMarkdownAlt(filename) {
            const stripped = filename
                .replace(/\.[^.]+$/, '')
                .replace(/[\[\]\r\n]/g, '')
                .trim();
            return stripped || 'image';
        },

        requestUpload({ url, headers = {}, formData, anonymous = false }) {
            return new Promise((resolve, reject) => {
                if (typeof GM_xmlhttpRequest !== 'function') {
                    reject(new Error('当前脚本管理器不支持 GM_xmlhttpRequest'));
                    return;
                }

                GM_xmlhttpRequest({
                    method: 'POST',
                    url,
                    anonymous,
                    headers,
                    data: formData,
                    timeout: 30_000,
                    onload: resolve,
                    onerror() {
                        reject(new Error('网络请求失败，请检查网络或图床连通性'));
                    },
                    ontimeout() {
                        reject(new Error('上传超时，请重试'));
                    },
                    onabort() {
                        reject(new Error('上传已取消'));
                    },
                });
            });
        },

        async uploadToImgur(file, config) {
            const filename = this.buildUploadFilename(file);
            const formData = new FormData();
            formData.append('image', file, filename);

            const clientId = config.imgurClientId || this.IMGUR_DEFAULT_CLIENT_ID;
            const resp = await this.requestUpload({
                url: this.IMGUR_UPLOAD_URL,
                anonymous: true,
                headers: { Authorization: `Client-ID ${clientId}` },
                formData,
            });

            let json = null;
            try {
                json = JSON.parse(resp.responseText || '{}');
            } catch {
                throw new Error(`接口返回异常 (HTTP ${resp.status})`);
            }

            const rawLink = json?.data?.link || '';
            if (resp.status >= 200 && resp.status < 300 && json.success && rawLink) {
                return { url: rawLink.replace(/^http:\/\//i, 'https://'), filename };
            }

            if (resp.status === 429) {
                throw new Error('Imgur 限流，可在图床设置切换图床或填写 Client-ID');
            }

            const rawErr = json?.data?.error;
            const errMsg =
                (typeof rawErr === 'string' ? rawErr : rawErr?.message) ||
                `上传失败 (HTTP ${resp.status})`;
            throw new Error(errMsg);
        },

        async uploadToCatbox(file, config) {
            const filename = this.buildUploadFilename(file);
            const formData = new FormData();
            formData.append('reqtype', 'fileupload');
            if (config.catboxUserHash) {
                formData.append('userhash', config.catboxUserHash);
            }
            formData.append('fileToUpload', file, filename);

            const resp = await this.requestUpload({
                url: this.CATBOX_UPLOAD_URL,
                anonymous: true,
                formData,
            });

            const text = (resp.responseText || '').trim();
            if (resp.status >= 200 && resp.status < 300 && /^https?:\/\/\S+$/i.test(text)) {
                return { url: text, filename };
            }

            throw new Error(text || `上传失败 (HTTP ${resp.status})`);
        },

        async uploadToImgurl(file, config) {
            const url = this.resolveImgurlUploadUrl(config);
            const filename = this.buildUploadFilename(file);
            const formData = new FormData();
            formData.append('file', file, filename);

            const headers = {};
            if (config.imgurlApiVersion === 'v2') {
                formData.append('uid', config.imgurlUid);
                formData.append('token', config.imgurlToken);
                if (config.imgurlAlbumId) {
                    formData.append('album_id', config.imgurlAlbumId);
                }
            } else {
                headers.Authorization = `Bearer ${config.imgurlToken}`;
                if (config.imgurlAlbumId && /^\d+$/.test(config.imgurlAlbumId)) {
                    formData.append(
                        'params',
                        JSON.stringify({ album_id: Number(config.imgurlAlbumId) })
                    );
                }
            }

            const resp = await this.requestUpload({ url, headers, formData });

            let json = null;
            try {
                json = JSON.parse(resp.responseText || '{}');
            } catch {
                throw new Error(`接口返回异常 (HTTP ${resp.status})`);
            }

            const codeOk =
                json.code === 200 || String(json.code) === '200' || json.success === true;
            const imageUrl = json?.data?.url || json?.data?.links?.url || json?.url || '';

            if (resp.status >= 200 && resp.status < 300 && codeOk && imageUrl) {
                return { url: imageUrl, filename };
            }

            throw new Error(json?.msg || json?.message || `上传失败 (HTTP ${resp.status})`);
        },

        uploadImage(file, config) {
            if (config.provider === 'catbox') {
                return this.uploadToCatbox(file, config);
            }
            if (config.provider === 'imgurl') {
                return this.uploadToImgurl(file, config);
            }
            return this.uploadToImgur(file, config);
        },

        async uploadFilesToEditor(files, editor) {
            const config = this.getConfig();
            if (!this.isConfigReady(config)) {
                showToast('请先填写 ImgURL Token，或切换为匿名图床', 'info');
                this.openConfigModal(() => {
                    this.uploadFilesToEditor(files, editor);
                });
                return;
            }

            const providerName = this.PROVIDER_LABELS[config.provider] || 'Imgur';
            const tasks = files.map((file) => {
                const seq = ++this.uploadSeq;
                const filename = this.buildUploadFilename(file);
                const placeholder = `![Uploading ${filename}...](#v2ex-tweaks-upload-${seq})`;
                return { file, filename, placeholder };
            });

            editor.insertText(tasks.map((t) => t.placeholder).join('\n'));
            showToast(
                tasks.length > 1
                    ? `正在上传 ${tasks.length} 张图片到 ${providerName}...`
                    : `正在上传图片到 ${providerName}...`,
                'info',
                2500
            );

            await Promise.all(
                tasks.map(async ({ file, filename, placeholder }) => {
                    try {
                        const result = await this.uploadImage(file, config);
                        const alt = this.buildMarkdownAlt(result.filename || filename);
                        const markdown = `![${alt}](${result.url})`;
                        const replaced = editor.replaceText(placeholder, markdown);
                        if (!replaced) {
                            editor.insertText(markdown);
                        }
                        log.info(`${providerName} 上传成功:`, result.url);
                        showToast('图片上传成功', 'success', 2500);
                    } catch (err) {
                        editor.replaceText(placeholder, '');
                        log.error(`${providerName} 上传失败:`, err);
                        showToast(`图片上传失败：${err.message}`, 'error', 5000);
                    }
                })
            );
        },

        openConfigModal(onSaved) {
            const existing = document.getElementById('v2ex-tweaks-upload-modal');
            if (existing) existing.remove();

            const isDark = isDarkTheme();
            const config = this.getConfig();

            const overlay = document.createElement('div');
            overlay.id = 'v2ex-tweaks-upload-modal';
            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '100000',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
            });

            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                width: '100%',
                maxWidth: '380px',
                borderRadius: '8px',
                padding: '18px 20px',
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                color: isDark ? '#e5e7eb' : '#111827',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                fontSize: '13px',
                lineHeight: '1.5',
            });

            const title = document.createElement('div');
            title.textContent = '图床设置';
            Object.assign(title.style, {
                fontSize: '15px',
                fontWeight: '600',
                marginBottom: '14px',
            });

            const form = document.createElement('form');
            Object.assign(form.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
            });

            const inputStyle = {
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 10px',
                borderRadius: '5px',
                border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
                backgroundColor: isDark ? '#111827' : '#ffffff',
                color: isDark ? '#f3f4f6' : '#111827',
                fontSize: '13px',
                outline: 'none',
            };

            const createField = (labelText, control) => {
                const wrapper = document.createElement('label');
                Object.assign(wrapper.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                });
                const label = document.createElement('span');
                label.textContent = labelText;
                Object.assign(label.style, {
                    fontSize: '12px',
                    color: isDark ? '#9ca3af' : '#4b5563',
                });
                wrapper.append(label, control);
                return wrapper;
            };

            const createSection = () => {
                const section = document.createElement('div');
                Object.assign(section.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                });
                return section;
            };

            // 图床选择
            const providerSelect = document.createElement('select');
            Object.assign(providerSelect.style, inputStyle);
            providerSelect.add(new Option('Imgur（匿名免登录）', 'imgur'));
            providerSelect.add(new Option('Catbox.moe（完全免注册）', 'catbox'));
            providerSelect.add(new Option('ImgURL（自填 Token）', 'imgurl'));
            providerSelect.value = config.provider;

            // Imgur 配置区
            const imgurSection = createSection();
            const imgurClientIdInput = document.createElement('input');
            imgurClientIdInput.type = 'text';
            imgurClientIdInput.value = config.imgurClientId;
            imgurClientIdInput.placeholder = '可选，留空使用默认匿名';
            Object.assign(imgurClientIdInput.style, inputStyle);
            imgurSection.append(createField('Client-ID', imgurClientIdInput));

            // Catbox 配置区
            const catboxSection = createSection();
            const catboxUserHashInput = document.createElement('input');
            catboxUserHashInput.type = 'text';
            catboxUserHashInput.value = config.catboxUserHash;
            catboxUserHashInput.placeholder = '可选，留空匿名上传';
            Object.assign(catboxUserHashInput.style, inputStyle);
            catboxSection.append(createField('User Hash', catboxUserHashInput));

            // ImgURL 配置区
            const imgurlSection = createSection();
            const imgurlVersionSelect = document.createElement('select');
            Object.assign(imgurlVersionSelect.style, inputStyle);
            imgurlVersionSelect.add(new Option('API v3（Bearer Token）', 'v3'));
            imgurlVersionSelect.add(new Option('API v2（UID + Token）', 'v2'));
            imgurlVersionSelect.value = config.imgurlApiVersion;

            const imgurlBaseUrlInput = document.createElement('input');
            imgurlBaseUrlInput.type = 'text';
            imgurlBaseUrlInput.value = config.imgurlBaseUrl;
            imgurlBaseUrlInput.placeholder = this.DEFAULT_CONFIG.imgurlBaseUrl;
            Object.assign(imgurlBaseUrlInput.style, inputStyle);

            const imgurlUidInput = document.createElement('input');
            imgurlUidInput.type = 'text';
            imgurlUidInput.value = config.imgurlUid;
            imgurlUidInput.placeholder = 'ImgURL UID';
            Object.assign(imgurlUidInput.style, inputStyle);
            const imgurlUidField = createField('UID', imgurlUidInput);

            const imgurlTokenInput = document.createElement('input');
            imgurlTokenInput.type = 'password';
            imgurlTokenInput.value = config.imgurlToken;
            Object.assign(imgurlTokenInput.style, inputStyle);

            const imgurlAlbumInput = document.createElement('input');
            imgurlAlbumInput.type = 'text';
            imgurlAlbumInput.value = config.imgurlAlbumId;
            imgurlAlbumInput.placeholder = '可选，默认 0';
            Object.assign(imgurlAlbumInput.style, inputStyle);

            imgurlSection.append(
                createField('接口版本', imgurlVersionSelect),
                createField('服务地址', imgurlBaseUrlInput),
                imgurlUidField,
                createField('API Token', imgurlTokenInput),
                createField('相册 ID', imgurlAlbumInput)
            );

            const syncUI = () => {
                const p = providerSelect.value;
                imgurSection.style.display = p === 'imgur' ? 'flex' : 'none';
                catboxSection.style.display = p === 'catbox' ? 'flex' : 'none';
                imgurlSection.style.display = p === 'imgurl' ? 'flex' : 'none';

                const isV2 = imgurlVersionSelect.value === 'v2';
                imgurlUidField.style.display = isV2 ? 'flex' : 'none';
                imgurlTokenInput.placeholder = isV2 ? 'API Token' : 'sk-...';
            };
            providerSelect.addEventListener('change', syncUI);
            imgurlVersionSelect.addEventListener('change', syncUI);
            syncUI();

            const actions = document.createElement('div');
            Object.assign(actions.style, {
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '6px',
            });

            const btnBase = {
                padding: '6px 14px',
                borderRadius: '5px',
                fontSize: '13px',
                cursor: 'pointer',
                border: 'none',
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.textContent = '取消';
            Object.assign(cancelBtn.style, btnBase, {
                backgroundColor: isDark ? '#374151' : '#e5e7eb',
                color: isDark ? '#e5e7eb' : '#374151',
            });

            const saveBtn = document.createElement('button');
            saveBtn.type = 'submit';
            saveBtn.textContent = '保存';
            Object.assign(saveBtn.style, btnBase, {
                backgroundColor: '#3b82f6',
                color: '#ffffff',
            });

            const close = () => {
                document.removeEventListener('keydown', onKeyDown);
                overlay.remove();
            };
            const onKeyDown = (e) => {
                if (e.key === 'Escape') close();
            };
            document.addEventListener('keydown', onKeyDown);

            cancelBtn.addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const nextConfig = {
                    provider: providerSelect.value,
                    imgurClientId: imgurClientIdInput.value
                        .trim()
                        .replace(/^Client-ID\s+/i, ''),
                    catboxUserHash: catboxUserHashInput.value.trim(),
                    imgurlApiVersion: imgurlVersionSelect.value,
                    imgurlBaseUrl:
                        imgurlBaseUrlInput.value.trim() || this.DEFAULT_CONFIG.imgurlBaseUrl,
                    imgurlUid: imgurlUidInput.value.trim(),
                    imgurlToken: imgurlTokenInput.value.trim().replace(/^Bearer\s+/i, ''),
                    imgurlAlbumId: imgurlAlbumInput.value.trim(),
                };

                if (!this.isConfigReady(nextConfig)) {
                    showToast(
                        nextConfig.imgurlApiVersion === 'v2'
                            ? '请填写 UID 和 Token'
                            : '请填写 Token',
                        'error'
                    );
                    return;
                }

                this.saveConfig(nextConfig);
                close();
                showToast(
                    `图床已保存（${this.PROVIDER_LABELS[nextConfig.provider]}）`,
                    'success',
                    2000
                );
                if (typeof onSaved === 'function') {
                    onSaved();
                }
            });

            actions.append(cancelBtn, saveBtn);
            form.append(
                createField('图床', providerSelect),
                imgurSection,
                catboxSection,
                imgurlSection,
                actions
            );
            dialog.append(title, form);
            overlay.append(dialog);
            document.body.appendChild(overlay);
            providerSelect.focus();
        },

        handlePaste(e) {
            const editor = this.resolveTargetEditor(e.target);
            if (!editor) return;

            const files = this.extractImageFiles(e.clipboardData);
            if (files.length === 0) return;

            e.preventDefault();
            e.stopPropagation();
            this.uploadFilesToEditor(files, editor);
        },

        init() {
            if (typeof GM_registerMenuCommand === 'function') {
                GM_registerMenuCommand('🖼️ 图床设置', () => {
                    this.openConfigModal();
                });
            }

            document.addEventListener('paste', (e) => this.handlePaste(e), true);
        },
    };

    registerFeature(pasteImageUploadFeature);

    /* =========================================================================
     * 启动脚本 (Bootstrap)
     * ========================================================================= */

    bootstrapFeatures();
})();
