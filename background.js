// 空配置避免自动创建标签页
const DEFAULT_CONFIG = {
  sites: [], // 初始为空数组
  checkInterval: 5
};

// 初始化存储
chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.sync.get('config');
  if (!config) {
    // 只保存基本配置，不包含URL
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
  }
  
  // 不立即执行检查
  await setupTimer();
});

// 设置定时器
async function setupTimer() {
  const { config } = await chrome.storage.sync.get('config');
  
  if (!config || !config.sites || config.sites.length === 0) {
    // 没有配置时不设置定时器
    await chrome.alarms.clear('tabCheck');
    return;
  }
  
  await chrome.alarms.clear('tabCheck');
  chrome.alarms.create('tabCheck', {
    periodInMinutes: config.checkInterval || DEFAULT_CONFIG.checkInterval
  });
}

// 浏览器启动时运行
chrome.runtime.onStartup.addListener(() => {
  // 有配置时才执行检查
  chrome.storage.sync.get('config', ({ config }) => {
    if (config && config.sites && config.sites.length > 0) {
      ensurePinnedTabs();
    }
  });
});

// 处理定时器事件
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tabCheck') ensurePinnedTabs();
});

// 获取存储的配置
async function getConfig() {
  const { config } = await chrome.storage.sync.get('config');
  return config || DEFAULT_CONFIG;
}

// 保存配置
async function setConfig(newConfig) {
  await chrome.storage.sync.set({ config: newConfig });
  
  if (newConfig.sites && newConfig.sites.length > 0) {
    // 保存后立即检查
    ensurePinnedTabs();
    // 设置定时器
    await setupTimer();
  } else {
    // 无站点时清除定时器
    await chrome.alarms.clear('tabCheck');
  }
}

// 主功能：检查所有需要固定的标签页
async function ensurePinnedTabs() {
  const config = await getConfig();
  if (!config?.sites?.length) return;
  
  for (const site of config.sites) {
    if (!site.pinned) continue;
    
    const tabs = await chrome.tabs.query({ url: site.pattern });
    if (tabs.some(tab => tab.pinned)) continue;
    
    await chrome.tabs.create({
      url: site.url, // 使用实际URL而非模板
      pinned: true,
      active: !!site.active
    });
  }
}

// 处理来自设置页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveConfig') {
    setConfig(request.config).then(() => sendResponse({ status: 'success' }));
    return true;
  }
  
  if (request.action === 'getConfig') {
    getConfig().then(config => sendResponse(config));
    return true;
  }
});

// 点击扩展图标打开设置页
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'settings/index.html' });
});