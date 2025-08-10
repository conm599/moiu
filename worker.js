/**
 * 想法分享应用的主Worker文件
 * 处理前端页面展示和API请求
 */
export default {
  async fetch(request, env, ctx) {
    // 解析请求URL
    const url = new URL(request.url);
    
    // 处理根路径请求，返回前端页面
    if (url.pathname === "/") {
      return new Response(generateHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }
    
    // 处理API请求
    if (url.pathname === "/api/ideas") {
      // 处理CORS
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
      };
      
      // 处理预检请求
      if (request.method === "OPTIONS") {
        return new Response(null, { headers });
      }
      
      // 获取所有想法
      if (request.method === "GET") {
        try {
          const result = await env.dl.prepare(
            "SELECT * FROM ideas ORDER BY createdAt DESC"
          ).all();
          
          return new Response(JSON.stringify({
            success: true,
            data: result.results
          }), { headers });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { 
            headers,
            status: 500 
          });
        }
      }
      
      // 提交新想法
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const ideaText = body.text?.trim();
          
          if (!ideaText) {
            return new Response(JSON.stringify({
              success: false,
              error: "想法内容不能为空"
            }), { 
              headers,
              status: 400 
            });
          }
          
          // 插入数据库
          const result = await env.dl.prepare(
            "INSERT INTO ideas (text, createdAt) VALUES (?, CURRENT_TIMESTAMP)"
          ).bind(ideaText).run();
          
          // 返回新创建的想法
          const newIdea = await env.dl.prepare(
            "SELECT * FROM ideas WHERE id = last_insert_rowid()"
          ).get();
          
          return new Response(JSON.stringify({
            success: true,
            data: newIdea
          }), { headers });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), { 
            headers,
            status: 500 
          });
        }
      }
      
      // 不支持的方法
      return new Response(JSON.stringify({
        success: false,
        error: "不支持的请求方法"
      }), { 
        headers,
        status: 405 
      });
    }
    
    // 404页面
    return new Response("页面未找到", { status: 404 });
  },
};

/**
 * 生成前端HTML页面
 */
function generateHTML() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>想法分享</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#3B82F6',
          },
        },
      }
    }
  </script>
  <style type="text/tailwindcss">
    @layer utilities {
      .content-auto {
        content-visibility: auto;
      }
      .idea-item {
        @apply bg-white p-4 rounded-lg shadow-sm mb-3 border border-gray-100 hover:shadow-md transition-shadow;
      }
      .btn-primary {
        @apply bg-primary text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors;
      }
      .input-field {
        @apply w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary;
      }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <header class="mb-8 text-center">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">想法分享</h1>
      <p class="text-gray-600">记录并分享你的想法，所有人都能看到</p>
    </header>

    <main>
      <!-- 输入区域 -->
      <div class="bg-white p-5 rounded-lg shadow-sm mb-8">
        <textarea 
          id="ideaInput" 
          class="input-field h-24 resize-none" 
          placeholder="输入你的想法..."></textarea>
        <div class="flex justify-between mt-3 items-center">
          <small class="text-gray-500 text-sm">按 Ctrl+Enter 快速提交</small>
          <button id="submitBtn" class="btn-primary flex items-center gap-2">
            <i class="fa fa-paper-plane"></i> 提交想法
          </button>
        </div>
        <div id="statusMessage" class="mt-2 text-sm hidden"></div>
      </div>

      <!-- 想法列表 -->
      <div>
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <i class="fa fa-comments text-primary"></i> 所有想法
        </h2>
        <div id="loadingIndicator" class="text-center py-6 text-gray-500">
          <i class="fa fa-spinner fa-spin mr-2"></i> 加载中...
        </div>
        <div id="errorMessage" class="text-center py-6 text-red-500 hidden"></div>
        <div id="ideasList" class="space-y-3"></div>
        <div id="emptyState" class="text-center py-12 text-gray-500 hidden">
          <i class="fa fa-lightbulb-o text-4xl mb-3 text-gray-300"></i>
          <p>还没有想法，快来分享第一个吧！</p>
        </div>
      </div>
    </main>

    <footer class="mt-12 text-center text-gray-500 text-sm">
      <p>想法分享 &copy; ${new Date().getFullYear()}</p>
    </footer>
  </div>

  <script>
    // DOM元素
    const ideaInput = document.getElementById('ideaInput');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    const ideasList = document.getElementById('ideasList');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const emptyState = document.getElementById('emptyState');

    // 加载所有想法
    async function loadIdeas() {
      try {
        const response = await fetch('/api/ideas');
        
        if (!response.ok) {
          throw new Error(\`HTTP错误: \${response.status}\`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(\`预期JSON响应，但收到: \${text.substring(0, 100)}...\`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          displayIdeas(data.data);
        } else {
          throw new Error(data.error || '加载想法失败');
        }
      } catch (error) {
        console.error('加载想法出错:', error);
        errorMessage.textContent = \`加载失败: \${error.message}\`;
        errorMessage.classList.remove('hidden');
        loadingIndicator.classList.add('hidden');
        ideasList.classList.add('hidden');
        emptyState.classList.add('hidden');
      }
    }

    // 显示想法列表
    function displayIdeas(ideas) {
      loadingIndicator.classList.add('hidden');
      errorMessage.classList.add('hidden');
      
      if (ideas.length === 0) {
        emptyState.classList.remove('hidden');
        ideasList.classList.add('hidden');
        return;
      }
      
      emptyState.classList.add('hidden');
      ideasList.classList.remove('hidden');
      ideasList.innerHTML = '';
      
      ideas.forEach(idea => {
        const ideaElement = document.createElement('div');
        ideaElement.className = 'idea-item';
        
        // 格式化日期
        const date = new Date(idea.createdAt);
        const formattedDate = date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        ideaElement.innerHTML = \`
          <div class="text-gray-800 mb-1">\${escapeHTML(idea.text)}</div>
          <div class="text-xs text-gray-500">\${formattedDate}</div>
        \`;
        
        ideasList.appendChild(ideaElement);
      });
    }

    // 提交新想法
    async function submitIdea() {
      const text = ideaInput.value.trim();
      
      if (!text) {
        showStatus('请输入想法内容', 'red');
        return;
      }
      
      // 禁用按钮和输入框
      submitBtn.disabled = true;
      ideaInput.disabled = true;
      submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> 提交中...';
      showStatus('正在提交...', 'blue');
      
      try {
        const response = await fetch('/api/ideas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
          throw new Error(\`提交失败，状态码: \${response.status}\`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          showStatus('提交成功！', 'green');
          ideaInput.value = '';
          // 重新加载想法列表
          loadIdeas();
        } else {
          throw new Error(data.error || '提交失败');
        }
      } catch (error) {
        console.error('提交想法出错:', error);
        showStatus(\`提交失败: \${error.message}\`, 'red');
      } finally {
        // 恢复按钮和输入框状态
        submitBtn.disabled = false;
        ideaInput.disabled = false;
        submitBtn.innerHTML = '<i class="fa fa-paper-plane"></i> 提交想法';
        // 3秒后隐藏状态消息
        setTimeout(() => {
          statusMessage.classList.add('hidden');
        }, 3000);
      }
    }

    // 显示状态消息
    function showStatus(message, color) {
      statusMessage.textContent = message;
      statusMessage.classList.remove('hidden', 'text-red-500', 'text-green-500', 'text-blue-500');
      
      if (color === 'red') {
        statusMessage.classList.add('text-red-500');
      } else if (color === 'green') {
        statusMessage.classList.add('text-green-500');
      } else if (color === 'blue') {
        statusMessage.classList.add('text-blue-500');
      }
    }

    // 防XSS处理
    function escapeHTML(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // 事件监听
    submitBtn.addEventListener('click', submitIdea);
    
    // 支持Ctrl+Enter提交
    ideaInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitIdea();
      }
    });

    // 页面加载时获取想法列表
    window.addEventListener('DOMContentLoaded', loadIdeas);
  </script>
</body>
</html>
  `;
}
    