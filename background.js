// 监听插件安装完成事件
chrome.runtime.onInstalled.addListener((details) => {
    // 仅在初次安装时触发
    if (details.reason === 'install') {
        refreshTargetPages();
    }
});
// 刷新所有匹配目标URL的标签页
function refreshTargetPages() {
    const targetUrl = ["https://www.onlyfans-downloader.com/*", "https://onlyfans-downloader.com/*", "http://localhost:3000/*"];
    // 查找所有匹配的标签页
    chrome.tabs.query({ url: targetUrl }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error('Query error:', chrome.runtime.lastError);
            return;
        }

        // 遍历并刷新每个标签页
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.reload(tab.id, {}, () => {
                    if (chrome.runtime.lastError) {
                        console.error('Reload error:', chrome.runtime.lastError);
                    }
                });
            }
        });
    });
}


// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'fetchHTML' && message.url) {
        const pageObj = await openTab(message);
        sendResponse({ pageObj });
    }
});


// 监听来自目标网站的消息
chrome.runtime.onMessageExternal.addListener(async (request, sender, sendResponse) => {

    // 只允许目标网站消息
    if (sender.origin !== 'https://onlyfans-downloader.com' && sender.origin !== 'https://www.onlyfans-downloader.com' && sender.origin !== 'http://localhost:3000') {
        return
    }

    // 打开新tab页
    if (request.type && request.type === 'ext-tab') {

        const result = await openTab(request)

        sendResponse(result)

    }


    // 下载
    if (request.type && request.type === 'ext-download') {

        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: false
        }, (downloadId) => {
            sendResponse(downloadId)
        })

    }
})

async function getTitle() {
    function LLClick(selector) {
        const el = document.querySelector(selector);
        if (!el) {
            LLData.err.push('DOM error: Click element ' + selector + ' not found.');
            return false;
        } else {
            el.click();
            return true;
        }
    }

    async function LLElement(selector, nth = 0, reloadInMs = 100, maxAttempts = 8) {
        const el = document.querySelectorAll(selector);
        maxAttempts--;

        if (!el[nth]) {
            if (maxAttempts < 1) {
                LLData.err.push('DOM error: Element ' + selector + ' not found.');
                return false;
            }

            await LLWait(reloadInMs);
            return LLElement(selector, nth, reloadInMs, maxAttempts);

        } else {
            return el[nth];
        }
    }

    async function LLElements(selector, el = null, reloadInMs = 250, maxAttempts = 8) {
        if (el == null) {
            el = document.querySelectorAll(selector);
        } else {
            el = el.querySelectorAll(selector);
        }

        maxAttempts--;

        if (!el.length) {
            if (maxAttempts < 1) {
                LLData.err.push('DOM error: Element ' + selector + ' not found.');
                return false;
            }

            await LLWait(reloadInMs);
            return LLElements(selector, el, reloadInMs, maxAttempts);

        } else {
            return el;
        }
    }

    async function LLLoadInitializedDOM(regExp, reloadInMs = 100, maxAttempts = 10) {
        const LLPageDom = new XMLSerializer().serializeToString(document.doctype) + document.getElementsByTagName('html')[0].outerHTML;
        if (maxAttempts < 1) return LLPageDom;
        if (LLPageDom.match(regExp)) {
            return LLPageDom;
        }
        maxAttempts--;
        await LLWait(reloadInMs);
        return LLLoadInitializedDOM(regExp, reloadInMs, maxAttempts);
    }

    function LLDetectExtractors(LLPageDom) {
        let extractors = {};

        const LLPlayerUrl = LLPageDom.match(`/https?:\\/\\/player\\.zype[^"']+/`);
        if (LLPlayerUrl) {
            extractors[2] = LLPlayerUrl[0];
        }

        if (LLPageDom.match(/vjs-big-play-button/)) {
            extractors[1] = true;
        }

        if (LLPageDom.match(/img-responsive/)) {
            extractors[3] = true;
        }

        if (LLPageDom.match(/swiper-container/)) {
            extractors[4] = true;
        }

        if (LLPageDom.match(/oftv_container/)) {
            extractors[5] = true;
        }

        if (!Object.keys(extractors).length) {
            LLData.err.push(`'Extraction error: Can\\'t determine the extractor.'`);
            return LLData;
        }

        return extractors;
    }

    function LLWait(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    // Data we return
    var LLData = {
        'err': [],
        'content': [],
    };



    async function LLExtract(extractors, omit = {}, slide = 0) {
        if (!omit[1] && extractors[1]) {
            if (!LLClick('[class="vjs-big-play-button has-tooltip"]')) return;
            await LLWait(1000);

            const el = await LLElement('video', slide);
            if (!el) {
                LLData.err.push(`'Extraction error: Can\\'t extract video.'`);
            }

            const els = await LLElements('source', el);
            if (!els || !els.length) return;

            const thumb = el.poster || '';
            if (!thumb) {
                LLData.err.push(`'Extraction error: Can\\'t extract poster.'`);
            }

            const LLLinks = [];
            for (const el of els) {
                if (!el.src) {
                    LLData.err.push(`'Extraction error: \\'src\\' video attribute is empty or missing.'`);
                    return;
                }

                if (!el.getAttribute('label')) {
                    LLData.err.push(`'Extraction error: \\'label\\' video attribute is empty or missing.'`);
                }

                LLLinks.push({
                    'url': el.src,
                    'type': 'video',
                    'width': 0,
                    'height': el.getAttribute('label') ? el.getAttribute('label') : LLGetLinkQuality(el.src)
                });
            }
            const truncatedText = await LLElement('div[class~="g-truncated-text"]');

            const title = truncatedText && truncatedText.textContent ? truncatedText.textContent : '';
            LLData.content.push({
                'title': title,
                'thumb': thumb,
                'links': LLLinks,
            });
        }

    }

    return new Promise(async (resolve) => {
        const LLPageDom = await LLLoadInitializedDOM(/vjs-big-play-button|player\\.zype\\.com|img-responsive|swiper-container|oftv_container/, 1000);
        const extractors = LLDetectExtractors(LLPageDom);


        await LLExtract(extractors, extractors[4] ? { 1: true, 2: true, 3: true, 5: true } : {});
        resolve(LLData)
    });
}

function openTab(request) {
    return new Promise(async (resolve, reject) => {

        chrome.tabs.create({
            active: false,
            url: request.url
        }, (tab) => {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: getTitle
            }, (results) => {
                resolve(results[0].result)
                chrome.tabs.remove(tab.id)
            });
        });
    })
}