-- 创建想法表
CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    createdAt TEXT NOT NULL
);

-- 插入测试数据
INSERT INTO ideas (text, createdAt) VALUES 
    ('这是一个测试想法', CURRENT_TIMESTAMP),
    ('使用Cloudflare Workers和D1构建真简单', CURRENT_TIMESTAMP);
    