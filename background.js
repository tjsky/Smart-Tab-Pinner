// 1. 空配置避免自动创建标签页
const DEFAULT_CONFIG = {
  sites: [], // 初始为空数组
  checkInterval: 5
};

// 2. 初始化
chrome.runtime.onInstalled.addListener(async () => {
  const { config } = await chrome.storage.sync.get('config');
  if (!config) {
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
  }
  await setupTimer();
});

// 3. 设置定时器
async function setupTimer() {
  const { config } = await chrome.storage.sync.get('config');
  
  if (!config || !config.sites || config.sites.length === 0) {
    await chrome.alarms.clear('tabCheck');
    return;
  }
  
  await chrome.alarms.clear('tabCheck');
  chrome.alarms.create('tabCheck', {
    periodInMinutes: config.checkInterval || DEFAULT_CONFIG.checkInterval
  });
}

// 4. 浏览器启动时运行
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get('config', ({ config }) => {
    if (config && config.sites && config.sites.length > 0) {
      ensurePinnedTabs();
    }
  });
});

// 5. 处理定时器事件
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tabCheck') ensurePinnedTabs();
});

// 6. 获取存储的配置
async function getConfig() {
  const { config } = await chrome.storage.sync.get('config');
  return config || DEFAULT_CONFIG;
}

// 7. 保存配置
async function setConfig(newConfig) {
  await chrome.storage.sync.set({ config: newConfig });  
  if (newConfig.sites && newConfig.sites.length > 0) {
    await setupTimer(); 
  } else {
    await chrome.alarms.clear('tabCheck');
  }
}


// 8. 主功能：检查所有需要固定的标签页
async function ensurePinnedTabs(tempSite = null) {
  const config = await getConfig();
  let sitesToCheck = config?.sites ? [...config.sites] : [];

  if (tempSite) {
    sitesToCheck.push(tempSite);
  }
  
  if (sitesToCheck.length === 0) return;
  
  for (const site of sitesToCheck) {
    try {
      const tabs = await chrome.tabs.query({ url: site.pattern });
      
      if (site.pinned && tabs.some(tab => tab.pinned)) continue;
      if (!site.pinned && tabs.length > 0) continue;
      
      if (tabs.length > 0) {
        const exactMatchTab = tabs.find(tab => tab.url === site.url);
        if (exactMatchTab) {
          await chrome.tabs.update(exactMatchTab.id, {
            pinned: site.pinned,
            active: !!site.active
          });
        } else {
          await chrome.tabs.create({
            url: site.url,
            pinned: site.pinned,
            active: !!site.active
          });
        }
      } else {
        await chrome.tabs.create({
          url: site.url,
          pinned: site.pinned,
          active: !!site.active
        });
      }
    } catch (error) {
      console.error(`[Smart Tab Pinner] 检测失败: ${error.message}`);
    }
  }
}

// 9. 处理来自设置页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveConfig') {
    setConfig(request.config).then(() => sendResponse({ status: 'success' }));
    return true; 
  }
  if (request.action === 'getConfig') {
    getConfig().then(config => sendResponse(config));
    return true;
  }
  if (request.action === 'runManualCheck') {
    ensurePinnedTabs(request.tempSite).then(() => sendResponse({ status: 'success' }));
    return true;
  }
});

// 10. 点击扩展图标打开设置页
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'settings/index.html' });
});