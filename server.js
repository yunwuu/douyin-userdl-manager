const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const util = require('util');
const copyFile = util.promisify(fs.copyFile);

const app = express();
const PORT = 3000;
const CONFIG_DIR = path.resolve(__dirname);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 读取所有YAML文件
app.get('/api/configs', (req, res) => {
  try {
    const files = fs.readdirSync(CONFIG_DIR).filter(file => path.extname(file) === '.yml' || path.extname(file) === '.yaml');
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: '读取配置文件失败', details: error.message });
  }
});

// 读取特定YAML文件的内容
app.get('/api/configs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(CONFIG_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const yamlContent = yaml.load(fileContent);
    
    // 解析注释中的名字
    const linksWithNames = [];
    if (yamlContent.link && Array.isArray(yamlContent.link)) {
      const lines = fileContent.split('\n');
      lines.forEach(line => {
        const linkMatch = line.match(/^(\s*-\s+)(https:\/\/[^\s]+)(.*)$/);
        if (linkMatch) {
          const link = linkMatch[2].trim();
          let name = linkMatch[3].replace('#', '').trim();
          
          // 如果没有注释或者注释只是数字/空，设置默认名称
          if (!name || /^\d*$/.test(name)) {
            name = `链接 ${linksWithNames.length + 1}`;
          }
          
          linksWithNames.push({ link, name });
        }
      });
    }
    
    res.json({
      filename,
      links: linksWithNames,
      rawContent: fileContent
    });
  } catch (error) {
    res.status(500).json({ error: '读取配置文件内容失败', details: error.message });
  }
});

// 更新YAML文件的link字段
app.post('/api/configs/:filename/update', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(CONFIG_DIR, filename);
    const { links } = req.body;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const yamlContent = yaml.load(fileContent);
    
    // 更新link字段
    yamlContent.link = links.map(item => item.link);
    
    // 生成带注释的新内容
    let newContent = '';
    const lines = fileContent.split('\n');
    let inLinkSection = false;
    
    lines.forEach((line, index) => {
      if (line.trim() === 'link:') {
        newContent += line + '\n';
        inLinkSection = true;
        
        // 插入新的link内容
        links.forEach((item, linkIndex) => {
          newContent += `  - ${item.link}`;
          if (item.name && item.name !== `链接 ${linkIndex + 1}`) {
            newContent += `  # ${item.name}`;
          }
          newContent += '\n';
        });
      } else if (inLinkSection && line.trim().startsWith('- ')) {
        // 跳过旧的link内容
      } else if (inLinkSection && line.trim() !== '' && !line.trim().startsWith('- ') && !line.trim().startsWith('#')) {
        // 发现link段落结束
        inLinkSection = false;
        newContent += line + '\n';
      } else if (!inLinkSection) {
        newContent += line + '\n';
      }
    });
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    res.json({ success: true, message: '配置文件已更新' });
  } catch (error) {
    res.status(500).json({ error: '更新配置文件失败', details: error.message });
  }
});

// 创建新的YAML配置文件
app.post('/api/configs/create', (req, res) => {
  try {
    const { filename, links } = req.body;
    
    // 确保文件名以.yml结尾
    let validFilename = filename;
    if (!validFilename.endsWith('.yml') && !validFilename.endsWith('.yaml')) {
      validFilename += '.yml';
    }
    
    const filePath = path.join(CONFIG_DIR, validFilename);
    
    if (fs.existsSync(filePath)) {
      return res.status(400).json({ error: '文件已存在' });
    }
    
    // 生成默认配置内容
    let content = `#######################################
# 说明:
# 1. 井号(#)为注释
# 2. 缩进严格对齐，使用空格缩进, 注意有些冒号后面有一个空格, 有些没有空格
# 3. 请使用英文字符
# 4. 更多yaml语法请上网查看
#######################################


# 作品(视频或图集)、直播、合集、音乐集合、个人主页的分享链接或者电脑浏览器网址
# (删除文案, 保证只有URL, https://v.douyin.com/kcvMpuN/ 或者 https://www.douyin.com/开头的)
# 可以设置多个链接, 确保至少一个链接
# 必选
link:\n`;
    
    if (links && links.length > 0) {
      links.forEach(item => {
        content += `  - ${item.link}`;
        if (item.name) {
          content += `  # ${item.name}`;
        }
        content += '\n';
      });
    }
    
    content += `
# 下载保存位置, 默认当前文件位置
# 必选
path: /vol2/1000/Videos/UGC/抖音/self/users/

# 是否下载视频中的音乐(True/False), 默认为True
# 可选
music: True

# 是否下载视频的封面(True/False), 默认为True, 当下载视频时有效
# 可选
cover: True

# 是否下载作者的头像(True/False), 默认为True
# 可选
avatar: True
`;
    
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, message: '配置文件已创建', filename: validFilename });
  } catch (error) {
    res.status(500).json({ error: '创建配置文件失败', details: error.message });
  }
});

// 删除YAML配置文件
app.delete('/api/configs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(CONFIG_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 不允许删除example.yml
    if (filename.toLowerCase() === 'example.yml') {
      return res.status(403).json({ error: '不允许删除示例配置文件' });
    }
    
    fs.unlinkSync(filePath);
    res.json({ success: true, message: '配置文件已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除配置文件失败', details: error.message });
  }
});

// 读取配置文件
function readConfigFile() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    return { copyPaths: {} };
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return { copyPaths: {} };
  }
}

// 保存配置文件
function saveConfigFile(config) {
  try {
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存配置文件失败:', error);
    return false;
  }
}

// 获取配置
app.get('/api/app-config', (req, res) => {
  try {
    const config = readConfigFile();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: '读取应用配置失败', details: error.message });
  }
});

// 更新复制路径
app.post('/api/app-config/update-copy-path', (req, res) => {
  try {
    const { filename, copyPath } = req.body;
    
    if (!filename || !copyPath) {
      return res.status(400).json({ error: '文件名和复制路径不能为空' });
    }
    
    const config = readConfigFile();
    config.copyPaths = config.copyPaths || {};
    config.copyPaths[filename] = copyPath;
    
    if (saveConfigFile(config)) {
      res.json({ success: true, message: '复制路径已保存' });
    } else {
      res.status(500).json({ error: '保存复制路径失败' });
    }
  } catch (error) {
    res.status(500).json({ error: '更新复制路径失败', details: error.message });
  }
});

// 复制配置文件到指定位置
app.post('/api/configs/:filename/copy', (req, res) => {
  try {
    const filename = req.params.filename;
    const { copyPath } = req.body;
    
    const sourcePath = path.join(CONFIG_DIR, filename);
    
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: '源文件不存在' });
    }
    
    // 如果没有提供复制路径，尝试从配置中获取
    let targetPath;
    if (copyPath) {
      targetPath = copyPath;
    } else {
      const config = readConfigFile();
      if (!config.copyPaths || !config.copyPaths[filename]) {
        return res.status(400).json({ error: '未设置复制路径' });
      }
      targetPath = config.copyPaths[filename];
    }
    
    // 确保目标目录存在
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (mkdirError) {
        return res.status(500).json({ error: '创建目标目录失败', details: mkdirError.message });
      }
    }
    
    // 执行复制操作
    copyFile(sourcePath, targetPath).then(() => {
      res.json({ success: true, message: '配置文件已复制到指定位置', targetPath });
    }).catch(copyError => {
      res.status(500).json({ error: '复制文件失败', details: copyError.message });
    });
  } catch (error) {
    res.status(500).json({ error: '复制配置文件失败', details: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});