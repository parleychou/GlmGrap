const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const mode = process.argv[2];
const taskName = "GLM_Coding_Pro_Grabber";
const batPath = path.join(__dirname, 'run.bat');

if (mode === 'register') {
    // 创建一个 run.bat 供计划任务调用，从而确保能够处于正确的执行目录
    // 默认执行包年 (annual) 专业版 (pro) 套餐
    const batContent = `@echo off\r\ncd /d "%~dp0"\r\nnode grab_glm_pro.js --cycle=annual --tier=pro\r\npause\r\n`;
    fs.writeFileSync(batPath, batContent, 'utf8');
    console.log('✅ 已生成辅助执行脚本: run.bat');

    // 注册到 Windows 计划任务
    const command = `schtasks /create /tn "${taskName}" /tr "\"${batPath}\"" /sc daily /st 09:50 /f`;
    try {
        console.log('正在注册 Windows 计划任务...');
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ 成功注册系统定时任务 [${taskName}]，每天上午 09:50 将自动弹出终端执行抢购。`);
    } catch (e) {
        console.error('❌ 注册失败:', e.message);
        console.error('如果在注册时提示拒绝访问，请尝试【以管理员身份运行】 CMD / PowerShell，然后再试。');
    }
} else if (mode === 'unregister') {
    const command = `schtasks /delete /tn "${taskName}" /f`;
    try {
        console.log('正在取消注册 Windows 计划任务...');
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ 成功取消系统定时任务 [${taskName}]。`);
    } catch (e) {
        console.error('❌ 取消失败 (任务可能不存在或没有权限):', e.message);
        console.error('如果在删除时提示拒绝访问，请尝试【以管理员身份运行】 CMD / PowerShell，然后再试。');
    }
} else {
    console.log(`
GLM 抢购计划任务管理工具

使用方法:
  node manage_task.js register     # 注册每天 09:50 弹窗执行自动抢购任务
  node manage_task.js unregister   # 取消注册该任务
`);
}
