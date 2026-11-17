-- 005: monthly budget limit per (user, category). month is always the 1st of the month.
CREATE TABLE IF NOT EXISTS budgets (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  category_id  BIGINT UNSIGNED NOT NULL,
  month        DATE            NOT NULL,
  amount       DECIMAL(10,2)   NOT NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budgets_user_category_month (user_id, category_id, month),
  KEY idx_budgets_user (user_id),
  KEY idx_budgets_category (category_id),
  CONSTRAINT chk_budgets_amount CHECK (amount > 0),
  CONSTRAINT chk_budgets_month_first_day CHECK (DAYOFMONTH(month) = 1),
  CONSTRAINT fk_budgets_user     FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
