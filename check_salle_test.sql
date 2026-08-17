-- ===========================================================================
-- Diagnostic suppression salle 'test..' — LECTURE SEULE
-- BD : gesafped26
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Confirmer que la salle 'test..' n'existe plus
-- ---------------------------------------------------------------------------
SELECT '--- 1. Salles avec "test" dans le nom (devrait être vide) ---' AS section;

SELECT id, nom, capacite
FROM salle
WHERE nom LIKE '%test%' OR nom LIKE '%..%'
ORDER BY id;

-- ---------------------------------------------------------------------------
-- 2) Retrouver l'événement de suppression dans le journal d'audit
-- ---------------------------------------------------------------------------
SELECT '--- 2. Événement DELETE de la salle dans core_audit_log ---' AS section;

SELECT
    id,
    user_id,
    action,
    model_name,
    object_id,
    LEFT(JSON_UNQUOTE(changes), 200) AS changes_extract,
    timestamp
FROM core_audit_log
WHERE action = 'delete'
  AND (
      model_name LIKE '%alle%'
      OR JSON_UNQUOTE(JSON_EXTRACT(changes, '$.nom')) LIKE '%test%'
      OR JSON_UNQUOTE(JSON_EXTRACT(changes, '$.before.nom')) LIKE '%test%'
  )
ORDER BY timestamp DESC
LIMIT 10;

-- Plus large : toutes les actions récentes sur le modèle Salle
SELECT '--- 2bis. Toutes les actions récentes sur le modèle Salle ---' AS section;

SELECT
    id,
    user_id,
    action,
    object_id,
    LEFT(JSON_UNQUOTE(changes), 200) AS changes_extract,
    timestamp
FROM core_audit_log
WHERE model_name LIKE '%alle%'
ORDER BY timestamp DESC
LIMIT 20;

-- ---------------------------------------------------------------------------
-- 3) Compter les orphelins éventuels dans chaque table dépendante
--    (fk_salle_id NON NULL pointant vers une salle qui n'existe plus)
-- ---------------------------------------------------------------------------
SELECT '--- 3. Comptage des orphelins par table (devrait être 0 si SET NULL a fonctionné) ---' AS section;

SELECT 'emplois_emplois' AS source_table, COUNT(*) AS orphelins
FROM emplois_emplois e
LEFT JOIN salle s ON s.id = e.fk_salle_id
WHERE e.fk_salle_id IS NOT NULL AND s.id IS NULL

UNION ALL

SELECT 'emplois_emploisarchive', COUNT(*)
FROM emplois_emploisarchive e
LEFT JOIN salle s ON s.id = e.fk_salle_id
WHERE e.fk_salle_id IS NOT NULL AND s.id IS NULL

UNION ALL

SELECT 'suivi_suivie', COUNT(*)
FROM suivi_suivie e
LEFT JOIN salle s ON s.id = e.fk_salle_id
WHERE e.fk_salle_id IS NOT NULL AND s.id IS NULL

UNION ALL

SELECT 'suivi_suivie_pointage', COUNT(*)
FROM suivi_suivie_pointage e
LEFT JOIN salle s ON s.id = e.fk_salle_id
WHERE e.fk_salle_id IS NOT NULL AND s.id IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Compter les lignes avec fk_salle_id NULL par table
--    (effet possible du SET NULL après suppression)
-- ---------------------------------------------------------------------------
SELECT '--- 4. Lignes sans salle assignée (fk_salle_id IS NULL) ---' AS section;

SELECT 'emplois_emplois' AS source_table,
       COUNT(*) AS total,
       SUM(CASE WHEN fk_salle_id IS NULL THEN 1 ELSE 0 END) AS sans_salle
FROM emplois_emplois

UNION ALL

SELECT 'emplois_emploisarchive',
       COUNT(*),
       SUM(CASE WHEN fk_salle_id IS NULL THEN 1 ELSE 0 END)
FROM emplois_emploisarchive

UNION ALL

SELECT 'suivi_suivie',
       COUNT(*),
       SUM(CASE WHEN fk_salle_id IS NULL THEN 1 ELSE 0 END)
FROM suivi_suivie

UNION ALL

SELECT 'suivi_suivie_pointage',
       COUNT(*),
       SUM(CASE WHEN fk_salle_id IS NULL THEN 1 ELSE 0 END)
FROM suivi_suivie_pointage;

-- ---------------------------------------------------------------------------
-- 5) Vérifier les contraintes FK existantes sur les colonnes fk_salle_id
-- ---------------------------------------------------------------------------
SELECT '--- 5. Contraintes FK sur fk_salle_id (CASCADE / SET NULL / RESTRICT ?) ---' AS section;

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'gesafped26'
  AND REFERENCED_TABLE_NAME = 'salle'
ORDER BY TABLE_NAME;

SELECT
    TABLE_NAME,
    CONSTRAINT_NAME,
    UPDATE_RULE,
    DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'gesafped26'
  AND REFERENCED_TABLE_NAME = 'salle'
ORDER BY TABLE_NAME;
