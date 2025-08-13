// ==UserScript==
// @name         BambooHR Employee Photo Downloader
// @namespace    https://github.com/OrbitingAncient/ats-userscripts/
// @version      25.8.13
// @description  Adds a button to download the full-resolution employee photo from BambooHR
// @match        https://*.bamboohr.com/employees/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// © 2025 Addiction Treatment Services
// Released under the MIT License

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the “Software”), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Disclaimer:
// This script is an independent tool created to enhance user experience on BambooHR.
// It is not affiliated with, endorsed by, or supported by BambooHR LLC.
// Use at your own risk and ensure compliance with your organization's policies and BambooHR's terms of service.

(function() {
    'use strict';

    const DEBUG = false;
    let lastLogMessage = '';

    const CONFIG = {
        nameSelector: '.PageHeader__title, [class*="PageHeader__title"], [class*="header"]',
        cropperSelector: '[class*="cropperWrapper"], [class*="cropper"], [class*="modal"]',
        imageSelector: '.cropper-canvas img, [class*="cropper"] img, img',
        buttonId: 'downloadPhotoButton'
    };

    function log(message, ...args) {
        if (DEBUG) {
            console.log(`[PhotoDownloader ${new Date().toLocaleString()}]: ${message}`, ...args);
        }
    }

    function logOnce(message, ...args) {
        if (DEBUG && message !== lastLogMessage) {
            console.log(`[PhotoDownloader ${new Date().toLocaleString()}]: ${message}`, ...args);
            lastLogMessage = message;
        }
    }

    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function fetchWithTimeout(url, options = {}, timeout = 10000) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), timeout)
            )
        ]);
    }

    function getEmployeeName() {
        const nameElement = document.querySelector(CONFIG.nameSelector);
        if (nameElement) {
            let rawText = nameElement.textContent.trim();
            rawText = rawText.replace(/[^a-zA-Z\s]/g, '');
            rawText = rawText.replace(/\s+/g, ' ').trim();
            const nameParts = rawText.split(' ').slice(0, 3);
            const cleanName = nameParts.join('_');
            log('Clean employee name extracted:', cleanName);
            return cleanName;
        }

        log('Employee name not found, falling back to employee ID');
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || 'unknown';
    }

    function addDownloadButton(imageElement, container) {
        if (!imageElement || !container) {
            logOnce('Missing image element or container');
            return;
        }

        if (document.querySelector(`#${CONFIG.buttonId}`)) {
            logOnce('Download button already exists');
            return;
        }

        const imageSrc = imageElement.src;
        if (!imageSrc) {
            logOnce('No valid image source found');
            return;
        }

        const downloadButton = document.createElement('button');
        downloadButton.id = CONFIG.buttonId;
        downloadButton.textContent = 'Download Full Resolution Photo';
        downloadButton.setAttribute('aria-label', 'Download employee photo');
        Object.assign(downloadButton.style, {
            margin: '10px',
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
        });

        downloadButton.addEventListener('mouseover', () => {
            downloadButton.style.backgroundColor = '#45a049';
        });
        downloadButton.addEventListener('mouseout', () => {
            downloadButton.style.backgroundColor = '#4CAF50';
        });

        downloadButton.addEventListener('click', async () => {
            const employeeName = getEmployeeName();
            try {
                let blob;
                if (imageSrc.startsWith('data:image/')) {
                    blob = await fetchWithTimeout(imageSrc).then(res => res.blob());
                } else {
                    blob = await fetchWithTimeout(imageSrc, { mode: 'cors' }).then(res => {
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        return res.blob();
                    });
                }

                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${employeeName}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                log('Photo download initiated for:', employeeName);
            } catch (err) {
                log('Error downloading image:', err);
                alert('Failed to download image. Check console for details.');
            }
        });

        container.appendChild(downloadButton);
        log('Download button added to container');
    }

    function removeDownloadButton() {
        const existingButton = document.querySelector(`#${CONFIG.buttonId}`);
        if (existingButton) {
            existingButton.remove();
            log('Download button removed');
        }
    }

    function checkAndAddButton() {
        const cropperWrapper = document.querySelector(CONFIG.cropperSelector);
        if (!cropperWrapper || cropperWrapper.offsetParent === null) {
            logOnce('Cropper popup not visible');
            removeDownloadButton();
            return;
        }

        const imageElement = cropperWrapper.querySelector(CONFIG.imageSelector);
        if (imageElement) {
            logOnce('Cropper image found');
            addDownloadButton(imageElement, cropperWrapper);
        } else {
            logOnce('Cropper image not found in popup');
            removeDownloadButton();
        }
    }

    function observePage() {
        const debouncedCheck = debounce(checkAndAddButton, 500);

        const observer = new MutationObserver(() => {
            debouncedCheck();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });

        log('MutationObserver started');
        checkAndAddButton();
    }

    function init() {
        log('Script initialized');
        log('BambooHR Photo Downloader v25.8.13.1 loaded');

        observePage();

        const photoContainer = document.querySelector('#employeePhoto');
        if (photoContainer) {
            photoContainer.addEventListener('click', () => {
                log('Photo container clicked, checking for cropper popup');
                checkAndAddButton();
            });
        } else {
            logOnce('Photo container not found');
        }

        const checkInterval = setInterval(() => {
            checkAndAddButton();
        }, 4000);

        setTimeout(() => {
            clearInterval(checkInterval);
            log('Stopped periodic checks');
        }, 120000);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
