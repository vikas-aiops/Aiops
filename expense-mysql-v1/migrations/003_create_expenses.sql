-- 003: expenses
CREATE TABLE IF NOT EXISTS expenses (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  category_id   BIGINT UNSIGNED NOT NULL,
  amount        DECIMAL(10,2)   NOT NULL,
  description   VARCHAR(255)    NOT NULL,
  expense_date  DATE            NOT NULL,
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_user (user_id),
  KEY idx_expenses_user_date (user_id, expense_date),
  KEY idx_expenses_category (category_id),
  CONSTRAINT chk_expenses_amount CHECK (amount > 0),
  CONSTRAINT fk_expenses_user     FOREIGN KEY (user_id)     REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
