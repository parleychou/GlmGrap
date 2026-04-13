# GlmGrap

Automated Puppeteer script for grabbing GLM Coding Pro yearly subscriptions precisely at 10:00 AM. 
**[中文说明在下方 / Chinese version below](#中文说明)**

![GLM Coding Pro Dashboard](assets/demo.png)

## Features
- Headless / Non-headless Chromium automation
- Auto-login natively with credentials from `.env`
- Precisely waits for predefined target times (9:55 login, 9:59 prep, 10:00 burst)
- Burst grab clicks using high frequency (50ms interval)
- Recovers from `Server Busy` loops automatically.
- Automatically saves flow screenshots to local `screenshots/` directory.

## Setup
1. Clone this repository
2. Install dependencies: `npm install`
3. Create a `.env` file from `.env.example`
4. Add your phone number and password inside the `.env` file

```sh
GLM_PHONE=12345678910
GLM_PASSWORD=your_password
```

## CLI Parameters
You can append the following parameters to the script:
- `--quick` or `-q`: Run immediately, bypassing the wait-for-10AM logic.
- `--cycle=<value>`: Choose the subscription duration.
  - `monthly` (Monthly)
  - `quarterly` (Quarterly)
  - `annual` (Annually - Default)
- `--tier=<value>`: Choose the subscription type.
  - `lite` (Basic / 1st option)
  - `pro` (Professional / 2nd option - Default)
  - `max` (Ultimate / 3rd option)

### Examples
```sh
# Default: Scheduled grab for Annual Professional edition
node grab_glm_pro.js

# Instant grab for Monthly Lite edition
node grab_glm_pro.js --quick --cycle=monthly --tier=lite

# Scheduled grab for Quarterly Max edition
node grab_glm_pro.js --cycle=quarterly --tier=max
```

---

# 中文说明 (Chinese Version)

GLM Coding Pro 抢购自动化 Puppeteer 脚本。支持在每天早上 10:00 的补货高峰期，在本地环境中全自动完成【登录 -> 挂机等待 -> 无缝高频防拥挤抢购】的完整链路。

## 核心特性
- **本地 Chrome 直连**：规避无头模式的反爬审查（支持与 Chrome MCP 协同操作截取网页快照和节点验证）。
- **完全自动登录**：无需手动接管，通过写入 `.env` 文件即可突破验证器，自动切换账密标签登录。
- **高并发抢卡防抖**：抢购期会以 `50ms` 间隔针对“Pro连续包年”狂按 10000 次以上。
- **自动治愈拥挤崩溃**：如果在准点出现“访问人数过多/请刷新重试”阻断，脚本将进入最高 200 次的强制自我重刷救补环，并在恢复时瞬间切换回包年界面继续执行抢购逻辑。
- **自动留存快照体系**：无需外部工具即可自动按时间线保存诸如 `01_loaded.png` 等关键过程截图到本地的 `screenshots` 文件夹下，全程透明。如果你利用 Chrome/Puppeteer MCP 控制它，也可以调用浏览器快照验证流程。

## 安装步骤
1. 克隆当前项目
2. 运行环境依赖安装：`npm install`
3. 复制项目中提供的 `.env.example`，并将新文件命名为 `.env`。
4. 将你的 GLM 平台账号信息配置入 `.env` 文件。

```sh
GLM_PHONE=你的手机号
GLM_PASSWORD=你的密码
```

## 核心启动参数
任何启动模式都可以搭配自由组合的传参，用于精确指定你要抢购的具体规格：

* `--quick` 或 `-q` : 开启**快速实测模式**，跳过定时等待，立马开抢（适合补漏或测网）。
* `--cycle=<周期>` : 订阅时长。可选值：
  * `monthly` : 连续包月
  * `quarterly` : 连续包季
  * `annual` : 连续包年 **(默认值)**
* `--tier=<档次>` : 订阅类型。可选值：
  * `lite` : 基础版 (第1个按钮)
  * `pro` : 专业版 (第2个按钮) **(默认值)**
  * `max` : 旗舰版 (第3个按钮)

### 常用命令组合示例
```sh
# [推荐] 默认定时模式：等待到 10:00 抢购【连续包年 - 专业版 (Pro)】
node grab_glm_pro.js

# 测试模式：立刻开始抢购【连续包季 - 基础版 (Lite)】
node grab_glm_pro.js --quick --cycle=quarterly --tier=lite

# 定时模式：等待到 10:00 抢购【连续包月 - 旗舰版 (Max)】
node grab_glm_pro.js --cycle=monthly --tier=max

# 测试模式：立刻开始抢购【连续包年 - 旗舰版 (Max)】
node grab_glm_pro.js --quick --cycle=annual --tier=max
```

**系统级定时任务指引 (Windows)**
如果你觉得每天打开终端太麻烦，你可以将该脚本注册为 Windows 系统级的每日自动计划任务。
```sh
# 注册任务，系统会在每天 09:50 自动弹出系统终端执行挂机抢购程序
npm run task:register

# 取消注册该系统任务
npm run task:unregister
```
> **提示:** 如果在注册遇到“拒绝访问”相关的错误，请以**管理员身份**打开 PowerShell/CMD 再执行注册命令。

> **注意：** 当日志返回 `🎉 支付页面出现！抢购成功！` 并输出 `04_success.png` 截图时，请立即手动进入跳跃出的 Chrome 支付窗口用微信并支付宝完成订阅扣费。
