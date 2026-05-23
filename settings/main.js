document.addEventListener('DOMContentLoaded', init);

let currentConfig = null;

async function init() {
  // 获取当前配置
  currentConfig = await getConfig();
  
  // 渲染界面
  renderSites(currentConfig.sites);
  document.getElementById('check-interval').value = currentConfig.checkInterval;
  
  // 绑定事件
  document.getElementById('add-site').addEventListener('click', addNewSite);
  document.getElementById('save-config').addEventListener('click', saveConfig);
  document.getElementById('run-check').addEventListener('click', runImmediateCheck);
}

// 获取配置
async function getConfig() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getConfig' }, resolve);
  });
}

// 添加新站点
function addNewSite() {
  const patternInput = document.getElementById('site-pattern');
  const urlInput = document.getElementById('site-url');
  
  const pattern = patternInput.value.trim();
  const url = urlInput.value.trim() || pattern.replace(/\*.*$/, '');
  
  if (!pattern || !url) {
    alert('请至少提供URL匹配模式');
    return;
  }
  
  // 创建站点配置
  const siteConfig = {
    pattern,
    url,
    pinned: document.getElementById('site-pinned').checked,
    active: document.getElementById('site-active').checked
  };
  
  // 添加到当前配置
  if (!currentConfig.sites) currentConfig.sites = [];
  currentConfig.sites.push(siteConfig);
  
  // 清空表单
  patternInput.value = '';
  urlInput.value = '';
  
  // 重新渲染
  renderSites(currentConfig.sites);
}

// 渲染站点列表
function renderSites(sites = []) {
  const container = document.getElementById('sites-list');
  container.innerHTML = '';
  
  if (!sites || sites.length === 0) {
    container.innerHTML = '<p class="empty-message">尚未添加任何网站</p>';
    return;
  }
  
  sites.forEach((site, index) => {
    container.appendChild(createSiteElement(site, index));
  });
}

// 创建单个站点元素
function createSiteElement(site, index) {
  const element = document.createElement('div');
  element.className = 'site-item';
  element.dataset.index = index;
  
  // 图标处理
  let icon = '🌐';
  if (site.pattern.includes('chrome-extension://')) icon = '🧩';
  
  element.innerHTML = `
    <div class="site-info">
      <div class="site-url" title="${site.pattern}">检测标签页：${icon} ${site.pattern}</div>
      <div class="site-settings">
        <span title="${site.url}">实际打开URL: ${truncateText(site.url, 150)}</span>
        <span>固定: ${site.pinned ? '✓' : '✗'}</span>
        <span>前台: ${site.active ? '✓' : '✗'}</span>
      </div>
    </div>
    <div class="site-actions">
      <button class="action-delete">删除</button>
    </div>
  `;
  
  // 添加删除事件
  element.querySelector('.action-delete').addEventListener('click', () => {
    currentConfig.sites.splice(index, 1);
    renderSites(currentConfig.sites);
  });
  
  return element;
}

// 保存配置
async function saveConfig() {
  const checkInterval = parseInt(document.getElementById('check-interval').value) || 5;
  currentConfig.checkInterval = checkInterval;
  
  await chrome.runtime.sendMessage({
    action: 'saveConfig',
    config: currentConfig
  });
  
  alert('配置已保存！扩展将在后台为您检测');
}

// 立即执行检查
async function runImmediateCheck() {
  await chrome.runtime.sendMessage({ action: 'getConfig' }, async (config) => {
    if (config && config.sites && config.sites.length > 0) {
      await chrome.runtime.sendMessage({ action: 'runManualCheck' });
      alert('检查完成！');
    } else {
      alert('没有配置任何网页，请先添加需要固定的网页');
    }
  });
}

// 添加文本截断辅助函数
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}