WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) * 10 AS new_position
    FROM for_you_items
)
UPDATE for_you_items
SET position = (
    SELECT new_position
    FROM ranked
    WHERE ranked.id = for_you_items.id
);
