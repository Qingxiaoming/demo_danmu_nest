-- 添加新字段pauseTime到now_queue表
ALTER TABLE now_queue ADD COLUMN IF NOT EXISTS pauseTime DATETIME NULL;

-- 添加新字段workingDuration到now_queue表，默认值为0
ALTER TABLE now_queue ADD COLUMN IF NOT EXISTS workingDuration INT DEFAULT 0;

-- 更新已有记录的workingDuration字段，设置默认值为0
UPDATE now_queue SET workingDuration = 0 WHERE workingDuration IS NULL; 