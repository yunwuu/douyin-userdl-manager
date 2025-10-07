// 当前选中的配置文件
let currentConfigFile = null;
let currentLinks = [];
let isModified = false;

// DOM 元素
const configFilesSelect = document.getElementById('configFiles');
const refreshConfigsBtn = document.getElementById('refreshConfigs');
const createConfigBtn = document.getElementById('createConfig');
const deleteConfigBtn = document.getElementById('deleteConfig');
const setCopyPathBtn = document.getElementById('setCopyPath');
const copyConfigBtn = document.getElementById('copyConfig');
const addLinkBtn = document.getElementById('addLink');
const saveLinksBtn = document.getElementById('saveLinks');
const linkList = document.getElementById('linkList');

// 模态框元素
const addLinkModal = document.getElementById('addLinkModal');
const createConfigModal = document.getElementById('createConfigModal');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const setCopyPathModal = document.getElementById('setCopyPathModal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const cancelDeleteBtn = document.querySelector('.cancel-delete');

// 表单
const addLinkForm = document.getElementById('addLinkForm');
const createConfigForm = document.getElementById('createConfigForm');
const setCopyPathForm = document.getElementById('setCopyPathForm');
const confirmDeleteBtn = document.getElementById('confirmDelete');

// 应用配置
let appConfig = { copyPaths: {} };

// 初始化
async function init() {
  await loadConfigFiles();
  await loadAppConfig();
  setupEventListeners();
}

// 加载配置文件列表
async function loadConfigFiles() {
  try {
    const response = await fetch('/api/configs');
    const files = await response.json();
    
    configFilesSelect.innerHTML = '';
    
    if (files.length === 0) {
      const option = document.createElement('option');
      option.textContent = '没有找到配置文件';
      option.disabled = true;
      configFilesSelect.appendChild(option);
    } else {
      files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        configFilesSelect.appendChild(option);
      });
      
      // 如果之前有选中的文件，保持选中
      if (currentConfigFile && files.includes(currentConfigFile)) {
        configFilesSelect.value = currentConfigFile;
        await loadConfigContent(currentConfigFile);
      } else if (files.length === 1) {
        // 如果只有一个配置文件，自动加载
        const firstFile = files[0];
        configFilesSelect.value = firstFile;
        await loadConfigContent(firstFile);
      }
    }
  } catch (error) {
    console.error('加载配置文件列表失败:', error);
    showNotification('加载配置文件列表失败，请刷新页面重试', 'error');
  }
}

// 加载配置文件内容
async function loadConfigContent(filename) {
  try {
    const response = await fetch(`/api/configs/${encodeURIComponent(filename)}`);
    const data = await response.json();
    
    currentConfigFile = filename;
    currentLinks = data.links || [];
    isModified = false;
    
    renderLinkList();
    updateButtonStates();
    
    // 高亮选中的文件
    configFilesSelect.value = filename;
  } catch (error) {
    console.error('加载配置文件内容失败:', error);
    showNotification('加载配置文件内容失败', 'error');
  }
}

// 渲染链接列表
function renderLinkList() {
  linkList.innerHTML = '';
  
  if (currentLinks.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = '此配置文件中没有链接';
    linkList.appendChild(emptyMessage);
  } else {
    currentLinks.forEach((link, index) => {
      const linkItem = document.createElement('div');
      linkItem.className = 'link-item';
      
      const linkInfo = document.createElement('div');
      linkInfo.className = 'link-info';
      
      const linkName = document.createElement('div');
      linkName.className = 'link-name';
      linkName.textContent = link.name;
      
      const linkUrl = document.createElement('div');
      linkUrl.className = 'link-url';
      linkUrl.textContent = link.link;
      
      const linkActions = document.createElement('div');
      linkActions.className = 'link-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-link';
      deleteBtn.textContent = '删除';
      deleteBtn.addEventListener('click', () => deleteLink(index));
      
      linkInfo.appendChild(linkName);
      linkInfo.appendChild(linkUrl);
      linkActions.appendChild(deleteBtn);
      linkItem.appendChild(linkInfo);
      linkItem.appendChild(linkActions);
      
      linkList.appendChild(linkItem);
    });
  }
}

// 添加链接
function addLink(name, link) {
  currentLinks.push({ name, link });
  isModified = true;
  renderLinkList();
  updateButtonStates();
}

// 删除链接
function deleteLink(index) {
  currentLinks.splice(index, 1);
  isModified = true;
  renderLinkList();
  updateButtonStates();
}

// 保存链接更改
async function saveLinks() {
  if (!currentConfigFile || !isModified) return;
  
  try {
    const response = await fetch(`/api/configs/${encodeURIComponent(currentConfigFile)}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ links: currentLinks })
    });
    
    const data = await response.json();
    
    if (data.success) {
      isModified = false;
      updateButtonStates();
      showNotification('链接已保存', 'success');
    } else {
      showNotification('保存失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('保存链接失败:', error);
    showNotification('保存链接失败，请重试', 'error');
  }
}

// 创建新配置文件
async function createConfig(filename) {
  try {
    const response = await fetch('/api/configs/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename, links: [] })
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal(createConfigModal);
      await loadConfigFiles();
      // 自动选择新创建的配置文件
      configFilesSelect.value = data.filename;
      await loadConfigContent(data.filename);
      showNotification('配置文件已创建', 'success');
    } else {
      showNotification('创建失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('创建配置文件失败:', error);
    showNotification('创建配置文件失败，请重试', 'error');
  }
}

// 删除配置文件
async function deleteConfig(filename) {
  try {
    const response = await fetch(`/api/configs/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      closeModal(confirmDeleteModal);
      
      // 如果删除的是当前选中的文件，重置状态
      if (filename === currentConfigFile) {
        currentConfigFile = null;
        currentLinks = [];
        isModified = false;
        renderLinkList();
      }
      
      await loadConfigFiles();
      updateButtonStates();
      showNotification('配置文件已删除', 'success');
    } else {
      showNotification('删除失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('删除配置文件失败:', error);
    showNotification('删除配置文件失败，请重试', 'error');
  }
}

// 加载应用配置
async function loadAppConfig() {
  try {
    const response = await fetch('/api/app-config');
    const config = await response.json();
    appConfig = config;
  } catch (error) {
    console.error('加载应用配置失败:', error);
    appConfig = { copyPaths: {} };
  }
}

// 设置复制路径
async function setCopyPath(filename, copyPath) {
  try {
    const response = await fetch('/api/app-config/update-copy-path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename, copyPath })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // 更新本地配置
      appConfig.copyPaths = appConfig.copyPaths || {};
      appConfig.copyPaths[filename] = copyPath;
      closeModal(setCopyPathModal);
      showNotification('复制路径已保存', 'success');
    } else {
      showNotification('保存失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('保存复制路径失败:', error);
    showNotification('保存复制路径失败，请重试', 'error');
  }
}

// 复制配置文件
async function copyConfig(filename) {
  try {
    // 检查是否设置了复制路径
    const savedCopyPath = appConfig.copyPaths && appConfig.copyPaths[filename];
    
    if (!savedCopyPath) {
      // 如果没有设置复制路径，打开设置复制路径的模态框
      document.getElementById('copyPath').value = '';
      openModal(setCopyPathModal);
      showNotification('请先设置复制路径', 'info');
      return;
    }
    
    const response = await fetch(`/api/configs/${encodeURIComponent(filename)}/copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification(`配置文件已复制到: ${data.targetPath}`, 'success');
    } else {
      showNotification('复制失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('复制配置文件失败:', error);
    showNotification('复制配置文件失败，请重试', 'error');
  }
}

// 更新按钮状态
function updateButtonStates() {
  deleteConfigBtn.disabled = !currentConfigFile || currentConfigFile.toLowerCase() === 'example.yml';
  addLinkBtn.disabled = !currentConfigFile;
  saveLinksBtn.disabled = !currentConfigFile || !isModified;
  setCopyPathBtn.disabled = !currentConfigFile;
  copyConfigBtn.disabled = !currentConfigFile;
}

// 显示通知
function showNotification(message, type = 'info') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // 添加到body
  document.body.appendChild(notification);
  
  // 设置样式
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.padding = '12px 20px';
  notification.style.borderRadius = '4px';
  notification.style.color = 'white';
  notification.style.fontSize = '14px';
  notification.style.zIndex = '1000';
  notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  notification.style.opacity = '0';
  notification.style.transition = 'opacity 0.3s ease';
  
  // 根据类型设置背景色
  if (type === 'success') {
    notification.style.backgroundColor = '#52c41a';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#ff4d4f';
  } else {
    notification.style.backgroundColor = '#1890ff';
  }
  
  // 显示通知
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);
  
  // 3秒后隐藏并移除
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// 打开模态框
function openModal(modal) {
  modal.style.display = 'block';
}

// 关闭模态框
function closeModal(modal) {
  modal.style.display = 'none';
}

// 设置事件监听器
function setupEventListeners() {
  // 配置文件选择器改变事件
  configFilesSelect.addEventListener('change', async () => {
    if (isModified) {
      if (!confirm('当前有未保存的更改，确定要切换配置文件吗？')) {
        // 恢复之前的选中状态
        configFilesSelect.value = currentConfigFile || '';
        return;
      }
    }
    
    const selectedFile = configFilesSelect.value;
    if (selectedFile) {
      await loadConfigContent(selectedFile);
    }
  });
  
  // 刷新配置文件列表
  refreshConfigsBtn.addEventListener('click', loadConfigFiles);
  
  // 创建新配置文件
  createConfigBtn.addEventListener('click', () => {
    // 清空表单
    document.getElementById('configFilename').value = '';
    openModal(createConfigModal);
  });
  
  // 删除配置文件
  deleteConfigBtn.addEventListener('click', () => {
    if (currentConfigFile) {
      openModal(confirmDeleteModal);
    }
  });
  
  // 设置复制路径
  setCopyPathBtn.addEventListener('click', () => {
    if (currentConfigFile) {
      // 显示当前已保存的复制路径（如果有）
      const savedCopyPath = appConfig.copyPaths && appConfig.copyPaths[currentConfigFile] || '';
      document.getElementById('copyPath').value = savedCopyPath;
      openModal(setCopyPathModal);
    }
  });
  
  // 复制配置文件
  copyConfigBtn.addEventListener('click', () => {
    if (currentConfigFile) {
      copyConfig(currentConfigFile);
    }
  });
  
  // 添加链接
  addLinkBtn.addEventListener('click', () => {
    // 清空表单
    document.getElementById('linkName').value = '';
    document.getElementById('linkUrl').value = '';
    openModal(addLinkModal);
  });
  
  // 保存链接
  saveLinksBtn.addEventListener('click', saveLinks);
  
  // 添加链接表单提交
  addLinkForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('linkName').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    
    if (name && url) {
      addLink(name, url);
      closeModal(addLinkModal);
      showNotification('链接已添加', 'success');
    }
  });
  
  // 创建配置文件表单提交
  createConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const filename = document.getElementById('configFilename').value.trim();
    
    if (filename) {
      createConfig(filename);
    }
  });
  
  // 设置复制路径表单提交
  setCopyPathForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentConfigFile) {
      const copyPath = document.getElementById('copyPath').value.trim();
      if (copyPath) {
        setCopyPath(currentConfigFile, copyPath);
      } else {
        showNotification('请输入有效的复制路径', 'error');
      }
    }
  });
  
  // 确认删除
  confirmDeleteBtn.addEventListener('click', () => {
    if (currentConfigFile) {
      deleteConfig(currentConfigFile);
    }
  });
  
  // 关闭模态框按钮
  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      closeModal(modal);
    });
  });
  
  // 取消删除
  cancelDeleteBtn.addEventListener('click', () => {
    closeModal(confirmDeleteModal);
  });
  
  // 点击模态框外部关闭
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  });
  
  // 监听窗口关闭事件，提示保存
  window.addEventListener('beforeunload', (e) => {
    if (isModified) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// 启动应用
init();