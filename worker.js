addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // 处理API请求
  if (url.pathname === '/api/ideas') {
    return handleApiRequest(request)
  }
  
  // 处理根路径请求，返回前端页面
  if (url.pathname === '/') {
    return new Response(frontendHtml, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
      },
    })
  }
  
  // 404 Not Found
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handleApiRequest(request) {
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }
  
  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers })
  }
  
  // 确保数据库绑定存在
  if (!env.dl) {
    return new Response(JSON.stringify({ error: '数据库未正确绑定' }), {
      status: 500,
      headers,
    })
  }
  
  try {
    // 处理GET请求 - 获取所有想法
    if (request.method === 'GET') {
      const { results } = await env.dl.prepare(
        'SELECT * FROM ideas ORDER BY createdAt DESC'
      ).all()
      
      return new Response(JSON.stringify(results), { headers })
    }
    
    // 处理POST请求 - 添加新想法
    if (request.method === 'POST') {
      const body = await request.json()
      
      // 验证输入
      if (!body.text || typeof body.text !== 'string' || body.text.trim() === '') {
        return new Response(JSON.stringify({ error: '想法内容不能为空' }), {
          status: 400,
          headers,
        })
      }
      
      // 插入数据库
      const { success } = await env.dl.prepare(
        'INSERT INTO ideas (text, createdAt) VALUES (?, CURRENT_TIMESTAMP)'
      ).bind(body.text.trim()).run()
      
      if (success) {
        return new Response(JSON.stringify({ success: true }), { headers })
      } else {
        return new Response(JSON.stringify({ error: '保存想法失败' }), {
          status: 500,
          headers,
        })
      }
    }
    
    // 不支持的方法
    return new Response(JSON.stringify({ error: '不支持的请求方法' }), {
      status: 405,
      headers,
    })
  } catch (error) {
    console.error('API错误:', error)
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers,
    })
  }
}

// 前端页面HTML
const frontendHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>想法分享</title>
    <!-- 生产环境建议：替换为本地构建的Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#3B82F6',
                    },
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                    },
                }
            }
        }
    </script>
    <style type="text/tailwindcss">
        @layer utilities {
            .content-auto {
                content-visibility: auto;
            }
            .idea-item {
                @apply bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-3 transition-all hover:shadow-md;
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
        <h1 class="text-3xl font-bold text-center mb-8 text-gray-800">分享你的想法</h1>
        
        <div class="bg-white p-6 rounded-lg shadow-md mb-8">
            <textarea 
                id="ideaInput" 
                class="input-field h-24 resize-none" 
                placeholder="在这里输入你的想法..."></textarea>
            <div class="mt-4 flex justify-end">
                <button id="submitBtn" class="btn-primary flex items-center gap-2">
                    <i class="fa fa-paper-plane"></i> 提交想法
                </button>
            </div>
        </div>
        
        <div class="mb-4 flex justify-between items-center">
            <h2 class="text-xl font-semibold text-gray-700">大家的想法</h2>
            <div id="statusIndicator" class="text-sm text-gray-500">
                <i class="fa fa-refresh fa-spin"></i> 加载中...
            </div>
        </div>
        
        <div id="ideasList" class="space-y-3">
            <!-- 想法列表将在这里动态生成 -->
        </div>
    </div>

    <script>
        // DOM元素
        const ideaInput = document.getElementById('ideaInput');
        const submitBtn = document.getElementById('submitBtn');
        const ideasList = document.getElementById('ideasList');
        const statusIndicator = document.getElementById('statusIndicator');
        
        // 加载所有想法
        async function loadIdeas() {
            try {
                setStatus('加载中...', 'info');
                
                const response = await fetch('/api/ideas');
                
                // 检查响应状态
                if (!response.ok) {
                    throw new Error(\`HTTP错误，状态码: \${response.status}\`);
                }
                
                // 检查内容类型
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    throw new Error(\`预期JSON响应，但收到: \${text.substring(0, 100)}...\`);
                }
                
                const ideas = await response.json();
                renderIdeas(ideas);
                setStatus(\`共 \${ideas.length} 个想法\`, 'success');
                
            } catch (error) {
                console.error('加载想法出错:', error);
                setStatus(\`加载失败: \${error.message}\`, 'error');
            }
        }
        
        // 渲染想法列表
        function renderIdeas(ideas) {
            ideasList.innerHTML = '';
            
            if (ideas.length === 0) {
                ideasList.innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fa fa-lightbulb-o text-4xl mb-2 opacity-30"></i>
                        <p>还没有想法，来添加第一个吧！</p>
                    </div>
                \`;
                return;
            }
            
            ideas.forEach(idea => {
                const ideaElement = document.createElement('div');
                ideaElement.className = 'idea-item';
                
                // 格式化日期
                const date = new Date(idea.createdAt);
                const formattedDate = date.toLocaleString();
                
                ideaElement.innerHTML = \`
                    <p class="text-gray-800 mb-2">\${escapeHtml(idea.text)}</p>
                    <div class="text-xs text-gray-500">
                        <i class="fa fa-clock-o mr-1"></i> \${formattedDate}
                    </div>
                \`;
                
                ideasList.appendChild(ideaElement);
            });
        }
        
        // 提交新想法
        async function submitIdea() {
            const text = ideaInput.value.trim();
            
            if (!text) {
                setStatus('想法内容不能为空', 'warning');
                return;
            }
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 提交中...';
                setStatus('提交中...', 'info');
                
                const response = await fetch('/api/ideas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text }),
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.error || \`提交失败，状态码: \${response.status}\`);
                }
                
                // 清空输入框并重新加载想法列表
                ideaInput.value = '';
                await loadIdeas();
                setStatus('想法提交成功！', 'success');
                
            } catch (error) {
                console.error('提交想法出错:', error);
                setStatus(\`提交失败: \${error.message}\`, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa fa-paper-plane"></i> 提交想法';
            }
        }
        
        // 设置状态提示
        function setStatus(message, type = 'info') {
            let icon = '';
            let colorClass = '';
            
            switch (type) {
                case 'success':
                    icon = '<i class="fa fa-check-circle text-green-500"></i>';
                    colorClass = 'text-green-600';
                    break;
                case 'error':
                    icon = '<i class="fa fa-exclamation-circle text-red-500"></i>';
                    colorClass = 'text-red-600';
                    break;
                case 'warning':
                    icon = '<i class="fa fa-exclamation-triangle text-yellow-500"></i>';
                    colorClass = 'text-yellow-600';
                    break;
                default:
                    icon = '<i class="fa fa-info-circle text-blue-500"></i>';
                    colorClass = 'text-blue-600';
            }
            
            statusIndicator.innerHTML = \`\${icon} \${message}\`;
            statusIndicator.className = \`text-sm \${colorClass}\`;
        }
        
        // 防XSS攻击
        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        // 事件监听
        submitBtn.addEventListener('click', submitIdea);
        
        // 支持Ctrl+Enter提交
        ideaInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                submitIdea();
            }
        });
        
        // 页面加载时获取想法列表
        window.addEventListener('DOMContentLoaded', loadIdeas);
    </script>
</body>
</html>`;
    