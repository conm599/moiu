-- 创建想法表
CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 插入测试数据
INSERT INTO ideas (text) VALUES 
    ('这是一个测试想法，部署成功后可以看到！'),
    ('Cloudflare Workers + D1 真的很方便'),
    ('分享你的想法，让所有人看到吧！');
    