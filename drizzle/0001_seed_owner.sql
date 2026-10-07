INSERT INTO `people` (`id`, `name`, `is_owner`, `created_at`) 
VALUES ('owner_1', 'Augusto', 1, CURRENT_TIMESTAMP) 
ON CONFLICT(`id`) DO NOTHING;