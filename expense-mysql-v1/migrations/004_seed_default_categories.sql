-- 004: the 10 system default categories (user_id NULL, is_default 1).
--   icon  = lucide-react icon name, rendered by the frontend
--   color = category palette; every hue is >= 3:1 contrast on paper (#F7F5EF)
-- The WHERE NOT EXISTS guard keeps this safe if someone re-runs it by hand.
INSERT INTO categories (user_id, name, icon, color, is_default)
SELECT NULL, d.name, d.icon, d.color, 1
FROM (
  SELECT 'Food'          AS name, 'UtensilsCrossed' AS icon, '#C8663B' AS color UNION ALL
  SELECT 'Transport',             'Car',                     '#3D7EA6'          UNION ALL
  SELECT 'Housing',               'Home',                    '#7A5BA6'          UNION ALL
  SELECT 'Health',                'HeartPulse',              '#C2476A'          UNION ALL
  SELECT 'Entertainment',         'Popcorn',                 '#A8771F'          UNION ALL
  SELECT 'Shopping',              'ShoppingBag',             '#2E8C7E'          UNION ALL
  SELECT 'Travel',                'Plane',                   '#4F6FC4'          UNION ALL
  SELECT 'Bills',                 'Receipt',                 '#A65B8D'          UNION ALL
  SELECT 'Education',             'GraduationCap',           '#5C8A3A'          UNION ALL
  SELECT 'Other',                 'MoreHorizontal',          '#7A7F8C'
) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.user_id IS NULL AND c.name = d.name
);
