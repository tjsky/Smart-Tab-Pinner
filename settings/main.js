document.addEventListener('DOMContentLoaded', init);

let currentConfig = null;
let editingIndex = null;
let hasOriginalSites = false;

async function init() {
  currentConfig = await getConfig();
  if (currentConfig && currentConfig.sites && currentConfig.sites.length > 0) {
    hasOriginalSites = true; 
  } else {
    hasOriginalSites = false;
  }
  renderSites(currentConfig.sites);
  document.getElementById('check-interval').value = currentConfig.checkInterval;
  document.getElementById('add-site').addEventListener('click', addNewSite);
  document.getElementById('save-config').addEventListener('click', () => saveConfig(true)); 
  document.getElementById('run-check').addEventListener('click', runImmediateCheck);
}

// 1. 获取配置
async function getConfig() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getConfig' }, resolve);
  });
}

// 2. 添加或更新站点
async function addNewSite() {
  const patternInput = document.getElementById('site-pattern');
  const urlInput = document.getElementById('site-url');
  const addButton = document.getElementById('add-site'); 
  
  const pattern = patternInput.value.trim();
  const url = urlInput.value.trim() || pattern.replace(/\*.*$/, '');
  
  if (!pattern || !url) {
    showToast('请提供URL匹配表达式');
    return;
  }

  const hasValidScheme = pattern.includes('://') && !pattern.startsWith('://');
  if (!hasValidScheme) {
    showToast('请输入合法的URL匹配表达式！\n比如您是否遗漏了协议头，如：\n- https://*.google.com/*\n- chrome-extension://abcdefg/*');
    return;
  }
  
  const siteConfig = {
    pattern,
    url,
    pinned: document.getElementById('site-pinned').checked,
    active: document.getElementById('site-active').checked
  };
  
  if (!currentConfig.sites) currentConfig.sites = [];

  let isEditMode = (editingIndex !== null); 

  if (isEditMode) {
    currentConfig.sites[editingIndex] = siteConfig;
    editingIndex = null; 
    addButton.textContent = '添加配置项';
    addButton.removeAttribute('style');
  } else {
    currentConfig.sites.push(siteConfig);
  }
  
  patternInput.value = '';
  urlInput.value = '';
  document.getElementById('site-pinned').checked = true; 
  document.getElementById('site-active').checked = false;
  
  renderSites(currentConfig.sites);

  if (isEditMode) {
    await saveConfig(false); 
    showToast('修改成功！新配置已自动保存并生效。');
  }
}

// 3. 渲染站点列表
function renderSites(sites = []) {
  const container = document.getElementById('sites-list');
  container.innerHTML = '';
  
  if (!sites || sites.length === 0) {
    container.innerHTML = '<p class="empty-message">您尚未添加任何配置</p>';
    return;
  }
  
  sites.forEach((site, index) => {
    container.appendChild(createSiteElement(site, index));
  });
}

// 4. 创建站点元素
function createSiteElement(site, index) {
  const element = document.createElement('div');
  element.className = 'site-item';
  element.dataset.index = index;
  
  let icon = '🌐';
  if (site.pattern.includes('chrome-extension://')) icon = '🧩';
  
  element.innerHTML = `
    <div class="site-info">
      <div class="site-url"></div>
      <div class="site-settings">
        <span class="js-actual-url"></span>
        <span>固定: ${site.pinned ? '✓' : '✗'}</span>
        <span>前台: ${site.active ? '✓' : '✗'}</span>
      </div>
    </div>
    <div class="site-actions">
      <button class="action-edit" style="background: #e8f0fe; color: #1a73e8;">修改</button>
      <button class="action-delete">删除</button>
    </div>
  `;
  
  const siteUrlDiv = element.querySelector('.site-url');
  siteUrlDiv.textContent = `检测标签页：${icon} ${site.pattern}`;
  siteUrlDiv.title = site.pattern; 
  
  const actualUrlSpan = element.querySelector('.js-actual-url');
  actualUrlSpan.textContent = `实际打开URL: ${truncateText(site.url, 150)}`;
  actualUrlSpan.title = site.url;
  
  element.querySelector('.action-edit').addEventListener('click', () => {
    document.getElementById('site-pattern').value = site.pattern;
    document.getElementById('site-url').value = site.url;
    document.getElementById('site-pinned').checked = site.pinned;
    document.getElementById('site-active').checked = site.active;
    editingIndex = index;
    
    const addButton = document.getElementById('add-site');
    addButton.textContent = '确认修改';
    addButton.style.background = '#e67e22'; 
    addButton.style.color = '#ffffff';
    
    document.querySelector('.add-site-form').scrollIntoView({ behavior: 'smooth' });
  });

  element.querySelector('.action-delete').addEventListener('click', async () => {
    if (editingIndex === index) {
      showToast('该条配置正在编辑中，请先确认修改或刷新页面后再操作！');
      return;
    }
    currentConfig.sites.splice(index, 1);
    if (editingIndex !== null && index < editingIndex) {
      editingIndex--;
    }
    renderSites(currentConfig.sites);
    await saveConfig(false);
  });
  
  return element;
}

// 5. 配置保存
async function saveConfig(showAlert = true) {
  const patternInput = document.getElementById('site-pattern');
  const patternValue = patternInput ? patternInput.value.trim() : '';
  if (showAlert && patternValue !== '') {
    if (editingIndex !== null) {
      showToast('检测到您有正在修改的配置未提交，请先点击下方的「确认修改」按钮应用您的修改，然后再「保存配置」！');
    } else {
      showToast('检测到您有正在编辑的配置未提交，请先点击下方的「添加配置项」按钮提交配置项，然后再「保存配置」！');
    }
    return;
  }

  if (showAlert && editingIndex !== null) {
    showToast('请先点击下方的「确认修改」按钮来应用您的修改，然后再进行保存！');
    return;
  }

  const hasSavedSites = currentConfig && currentConfig.sites && currentConfig.sites.length > 0;

  if (!hasSavedSites) {
    if (hasOriginalSites) {
      if (showAlert) {
        const confirmClear = confirm('⚠️ 高危提醒：\n\n检测到您清空了所有配置。保存后，扩展将停止后台的所有持续监测任务。\n\n是否确认清空并停用扩展功能？');
        if (!confirmClear) return; 
      }
      hasOriginalSites = false; 
    } else {
      if (showAlert) {
        showToast('保存失败：您尚未配置任何网站！请先在上方表单中填写并点击「添加网站」。');
      }
      return;
    }
  }

  const checkInterval = parseInt(document.getElementById('check-interval').value) || 5;
  currentConfig.checkInterval = checkInterval;
  
  await chrome.runtime.sendMessage({
    action: 'saveConfig',
    config: currentConfig
  });
  
  if (showAlert) {
    const isClose = confirm('配置已保存！扩展将在后台为您持续监测。\n\n是否需要关闭当前设置页面？');
    if (isClose) {
      window.close(); 
    }
  }
}

// 6. 立即执行检查
async function runImmediateCheck() {
  const patternInput = document.getElementById('site-pattern');
  const urlInput = document.getElementById('site-url');
  const pattern = patternInput.value.trim();
  const url = urlInput.value.trim() || pattern.replace(/\*.*$/, '');

  let tempSite = null;
  let isTargetActive = false;

  if (pattern) {
    const hasValidScheme = pattern.includes('://') && !pattern.startsWith('://');
    if (!hasValidScheme) {
      showToast('测试失败：输入的匹配表达式格式不正确，必须包含协议头（如 https://）');
      return;
    }
    isTargetActive = document.getElementById('site-active').checked;
    tempSite = {
      pattern,
      url,
      pinned: document.getElementById('site-pinned').checked,
      active: isTargetActive
    };
  } else if (currentConfig && currentConfig.sites && currentConfig.sites.length > 0) {
    isTargetActive = currentConfig.sites.some(s => s.active);
  }

  const hasSavedSites = currentConfig && currentConfig.sites && currentConfig.sites.length > 0;
  if (!hasSavedSites && !tempSite) {
    showToast('未检测到任何有效配置。请先在输入框填写内容，或者添加URL后再进行测试。');
    return;
  }

  chrome.runtime.sendMessage({ 
    action: 'runManualCheck',
    tempSite: tempSite,
    forceBackground: true 
  }, (response) => {
    
    if (isTargetActive && response && response.tabId) {
      const goNow = confirm('检查测试完成！\n\n检测到您有在前台打开的标签页，是否确定立刻前往该标签页查看？');
      if (goNow) {
        chrome.tabs.update(response.tabId, { active: true });
      }
    } else {
      showToast('检查测试完成！请检查标签页打开情况');
    }
  });
}

// 7. 文本截断辅助函数
function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// 8. 通知函数
function showToast(message) {
  const toast = document.getElementById('toast-container');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast-show';

  setTimeout(() => {
    toast.className = 'toast-hidden';
  }, 3000);
}