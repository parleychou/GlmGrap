/**
 * GLM Coding Pro 连续包年套餐 - 自动抢购脚本 v3
 * 
 * 核心改进: 遇到"访问人数较多"时自动刷新重试
 */

require('dotenv').config();
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const cycleArg = args.find(a => a.startsWith('--cycle='))?.split('=')[1] || 'annual';
const tierArg = args.find(a => a.startsWith('--tier='))?.split('=')[1] || 'pro';

const CYCLE_MAP = {
    'monthly': '连续包月',
    'quarterly': '连续包季',
    'annual': '连续包年'
};
const TIER_MAP = {
    'lite': 0,
    'pro': 1,
    'max': 2
};

const CONFIG = {
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    targetUrl: 'https://open.bigmodel.cn/glm-coding',
    phone: process.env.GLM_PHONE,
    password: process.env.GLM_PASSWORD,
    loginHour: 9, loginMinute: 55,
    prepareHour: 9, prepareMinute: 59, prepareSecond: 50,
    grabHour: 10, grabMinute: 0, grabSecond: 0,
    clickInterval: 50,
    maxClicks: 10000,
    maxRefreshes: 200,       // 最大刷新次数
    refreshCooldown: 1500,   // 刷新后等待 ms
    screenshotDir: path.join(__dirname, 'screenshots'),
    targetCycle: CYCLE_MAP[cycleArg] || '连续包年',
    targetTierIndex: TIER_MAP[tierArg] ?? 1,
};

function getTimeStr() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}.${String(n.getMilliseconds()).padStart(3,'0')}`;
}
function log(msg) { console.log(`[${getTimeStr()}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitUntil(hour, minute, second = 0) {
    const target = new Date();
    target.setHours(hour, minute, second, 0);
    if (target <= new Date()) {
        log(`⚠️ 目标时间 ${hour}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')} 已过，立即执行`);
        return;
    }
    const waitMs = target - new Date();
    log(`⏳ 等待到 ${hour}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}，还需 ${Math.floor(waitMs/60000)}分${Math.floor((waitMs%60000)/1000)}秒`);
    while (true) {
        const remaining = target - new Date();
        if (remaining <= 50) break;
        await sleep(Math.min(remaining - 50, 1000));
    }
    while (new Date() < target) {}
}

// ===== 检查是否已登录 =====
async function isLoggedIn(page) {
    return page.evaluate(() => {
        // 如果右上角没有"登录 / 注册"按钮，说明已登录
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
            if (b.textContent.includes('登录 / 注册')) return false;
        }
        return true;
    }).catch(() => false);
}

// ===== 执行一次登录操作 =====
async function doLoginOnce(page) {
    // 1. 点击"登录 / 注册"
    const clicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
            if (b.textContent.includes('登录') && b.textContent.includes('注册')) {
                b.click(); return true;
            }
        }
        return false;
    });
    if (!clicked) return true; // 没找到按钮 = 已登录

    await sleep(2000);

    // 2. 切换到"账号登录" tab
    await page.evaluate(() => { document.querySelector('#tab-password')?.click(); });
    await sleep(1000);

    // 3. 填入凭据
    await page.evaluate((phone, pwd) => {
        const dialog = document.querySelector('.login-content .el-dialog__body');
        if (!dialog) return;
        const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const phoneInput = dialog.querySelector('input[placeholder="请输入用户名/邮箱/手机号"]');
        if (phoneInput) { phoneInput.focus(); nativeSet.call(phoneInput, phone); phoneInput.dispatchEvent(new Event('input', { bubbles: true })); }
        const pwdInput = dialog.querySelector('input[type="password"]');
        if (pwdInput) { pwdInput.focus(); nativeSet.call(pwdInput, pwd); pwdInput.dispatchEvent(new Event('input', { bubbles: true })); }
    }, CONFIG.phone, CONFIG.password);
    await sleep(500);

    // 4. 点击登录
    await page.evaluate(() => {
        const dialog = document.querySelector('.login-content .el-dialog__body');
        if (!dialog) return;
        const btns = dialog.querySelectorAll('button');
        for (const b of btns) { if (b.textContent.trim() === '登录' && b.classList.contains('login-btn')) { b.click(); return; } }
    });

    // 5. 等待页面变化（登录成功后页面可能刷新）
    await sleep(3000);
    try {
        await page.waitForNavigation({ timeout: 5000, waitUntil: 'domcontentloaded' }).catch(() => {});
    } catch(e) {}
    await sleep(1000);

    return isLoggedIn(page);
}

// ===== 自动登录（带重试） =====
async function autoLogin(page) {
    log('🔐 开始自动登录...');

    if (await isLoggedIn(page)) { log('✅ 已登录'); return true; }

    for (let attempt = 1; attempt <= 3; attempt++) {
        log(`📋 登录尝试 ${attempt}/3...`);
        const ok = await doLoginOnce(page);
        if (ok) { log('✅ 登录成功！'); return true; }
        log(`  ⚠️ 第 ${attempt} 次登录未成功`);
        // 刷新页面重试
        if (attempt < 3) {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            await sleep(2000);
        }
    }
    log('❌ 3次登录均失败');
    return false;
}

// ===== 关闭登录弹窗（抢购中弹出时用） =====
async function dismissLoginDialog(page) {
    return page.evaluate(() => {
        const closeBtn = document.querySelector('.login-content .el-dialog__headerbtn');
        if (closeBtn) { closeBtn.click(); return true; }
        return false;
    }).catch(() => false);
}

// ===== 准备页面（滚动+切换连续包年） =====
async function setupPage(page) {
    try {
        await page.evaluate(() => {
            const h = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Coding') && h.textContent.includes('GLM'));
            if (h) { const r = h.getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - 50, behavior: 'instant' }); }
        });
        await sleep(300);
        await page.evaluate((targetCycle) => {
            for (const el of document.querySelectorAll('*')) {
                if (el.textContent.trim() === targetCycle && el.children.length === 0) { el.click(); return; }
            }
            // fallback
            for (const el of document.querySelectorAll('*')) {
                if (el.textContent.trim().startsWith(targetCycle) && el.children.length <= 2 && el.tagName !== 'HTML' && el.tagName !== 'BODY') { el.click(); return; }
            }
        }, CONFIG.targetCycle);
        await sleep(300);
    } catch (e) {
        log(`  ⚠️ setupPage: ${e.message.substring(0, 50)}`);
    }
}

// ===== 核心抢购循环（带自动刷新） =====
async function grabWithRefresh(page) {
    log('🔥🔥🔥 开始抢购（带自动刷新）！ 🔥🔥🔥');

    let totalClicks = 0;
    let refreshCount = 0;
    let grabbed = false;
    const startTime = Date.now();

    while (!grabbed && refreshCount < CONFIG.maxRefreshes && totalClicks < CONFIG.maxClicks) {
        // 检查页面是否有"访问人数较多"或页面不正常
        const pageStatus = await page.evaluate(() => {
            const text = document.body?.innerText || '';
            if (text.includes('访问人数较多') || text.includes('请刷新重试') || text.includes('服务繁忙')) {
                return 'busy';
            }
            const btns = Array.from(document.querySelectorAll('button'));
            const hasSubscribe = btns.some(b => {
                const t = b.textContent.trim();
                return t.includes('特惠订阅') || t.includes('暂时售罄') || t.includes('补货');
            });
            if (hasSubscribe) return 'ready';
            if (text.includes('微信支付') || text.includes('支付宝') || text.includes('确认订阅') || text.includes('支付金额')) {
                return 'pay';
            }
            return 'unknown';
        }).catch(() => 'error');

        if (pageStatus === 'pay') {
            log('🎉🎉🎉 支付页面出现！抢购成功！');
            grabbed = true;
            break;
        }

        if (pageStatus === 'busy' || pageStatus === 'unknown' || pageStatus === 'error') {
            refreshCount++;
            if (refreshCount % 10 === 0) {
                log(`🔄 页面状态: ${pageStatus}，第 ${refreshCount} 次刷新...`);
            }
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 });
            } catch (e) {
                // reload timeout, continue anyway
            }
            await sleep(CONFIG.refreshCooldown);
            await setupPage(page);
            continue;
        }

        // pageStatus === 'ready'，开始点击
        let batchClicks = 0;
        const batchMax = 50;

        while (batchClicks < batchMax && totalClicks < CONFIG.maxClicks) {
            try {
                const result = await page.evaluate((targetTierIndex) => {
                    // 先检查是否弹出了登录弹窗
                    const loginDialog = document.querySelector('.login-content');
                    if (loginDialog && loginDialog.offsetParent !== null) {
                        return { ok: false, loginPopup: true };
                    }

                    const btns = Array.from(document.querySelectorAll('button'));
                    const cardBtns = btns.filter(b => {
                        const t = b.textContent.trim();
                        return t.includes('特惠订阅') || t.includes('暂时售罄') || t.includes('补货');
                    });
                    if (cardBtns.length > 0) {
                        const targetIdx = Math.min(cardBtns.length - 1, targetTierIndex);
                        cardBtns[targetIdx].click();
                        return { ok: true, text: cardBtns[targetIdx].textContent.trim().substring(0, 25) };
                    }
                    return { ok: false };
                }, CONFIG.targetTierIndex);

                totalClicks++;
                batchClicks++;

                // 如果弹出了登录框，说明未登录，需要先登录
                if (result.loginPopup) {
                    log('  🔐 检测到登录弹窗，自动登录...');
                    await doLoginOnce(page);
                    await sleep(1000);
                    await setupPage(page);
                    break;
                }

                if (!result.ok) break;

                if (totalClicks % 100 === 0) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    log(`  📌 ${totalClicks}次 (${elapsed}s) R${refreshCount} btn="${result.text}"`);
                }

                const url = page.url();
                if (!url.includes('glm-coding')) {
                    log(`🎉 页面跳转: ${url}`);
                    grabbed = true;
                    break;
                }

                if (totalClicks % 20 === 0) {
                    const payCheck = await page.evaluate(() => {
                        const t = document.body.innerText;
                        if (t.includes('微信支付') || t.includes('支付宝') || t.includes('确认订阅') ||
                            t.includes('付款') || t.includes('支付金额')) return 'pay';
                        if (t.includes('访问人数较多') || t.includes('请刷新重试')) return 'busy';
                        return 'ok';
                    });
                    if (payCheck === 'pay') {
                        log('🎉🎉🎉 支付页面出现！');
                        grabbed = true;
                        break;
                    }
                    if (payCheck === 'busy') {
                        log('  ⚠️ 页面繁忙，需刷新');
                        break;
                    }
                }

            } catch (err) {
                if (err.message.includes('context was destroyed') || err.message.includes('navigation')) {
                    log('  ⚠️ 页面导航中...');
                    await sleep(500);
                    break;
                }
                log(`  ⚠️ 错误: ${err.message.substring(0, 60)}`);
                break;
            }

            if (CONFIG.clickInterval > 0) await sleep(CONFIG.clickInterval);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('=========================================');
    if (grabbed) {
        log(`🎉 抢购成功！ 点击${totalClicks}次 刷新${refreshCount}次 耗时${elapsed}s`);
        await page.screenshot({ path: path.join(CONFIG.screenshotDir, '04_success.png'), fullPage: true });
        log('⚠️ 请在浏览器中完成支付！');
    } else {
        log(`😢 未成功。 点击${totalClicks}次 刷新${refreshCount}次 耗时${elapsed}s`);
        await page.screenshot({ path: path.join(CONFIG.screenshotDir, '04_failed.png'), fullPage: true });
    }
    return grabbed;
}

// ===== 主流程 =====
async function main() {
    log(`🚀 GLM Coding Pro ${CONFIG.targetCycle} 抢购脚本 v3（定时模式）`);
    log('=========================================');
    if (!CONFIG.phone || !CONFIG.password) { log('❌ 缺少 .env 配置'); process.exit(1); }
    if (!fs.existsSync(CONFIG.screenshotDir)) fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: CONFIG.chromePath, headless: false, defaultViewport: null,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });

    await waitUntil(CONFIG.loginHour, CONFIG.loginMinute);
    log('📄 打开页面...');
    await page.goto(CONFIG.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await autoLogin(page);
    await page.screenshot({ path: path.join(CONFIG.screenshotDir, '02_logged_in.png') });

    await waitUntil(CONFIG.prepareHour, CONFIG.prepareMinute, CONFIG.prepareSecond);
    log('🔄 预准备刷新...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await sleep(1000);
    await setupPage(page);
    await page.screenshot({ path: path.join(CONFIG.screenshotDir, '03_prepared.png') });

    await waitUntil(CONFIG.grabHour, CONFIG.grabMinute, CONFIG.grabSecond);
    await grabWithRefresh(page);

    log('💡 浏览器保持打开，按 Ctrl+C 退出');
    await new Promise(() => {});
}

// ===== 快速模式 =====
async function quickMode() {
    log(`🚀 快速模式 v3 - 立即开始（带自动刷新） - 抢购: ${CONFIG.targetCycle}`);
    log('=========================================');
    if (!CONFIG.phone || !CONFIG.password) { log('❌ 缺少 .env 配置'); process.exit(1); }
    if (!fs.existsSync(CONFIG.screenshotDir)) fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: CONFIG.chromePath, headless: false, defaultViewport: null,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    });
    const page = (await browser.pages())[0] || await browser.newPage();
    await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });

    log('📄 打开页面...');
    await page.goto(CONFIG.targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await autoLogin(page);
    await sleep(1000);
    await setupPage(page);
    await grabWithRefresh(page);

    log('💡 浏览器保持打开，按 Ctrl+C 退出');
    await new Promise(() => {});
}

const isQuick = process.argv.includes('--quick') || process.argv.includes('-q');
(isQuick ? quickMode : main)().catch(err => { console.error('❌', err); process.exit(1); });
