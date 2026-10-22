-- Debug Agent Classifications
-- Check what integrations are currently classified as what

-- Show all current classifications
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Current Integration Classifications:';
  RAISE NOTICE '=================================';
  
  FOR rec IN 
    SELECT name, agent_classification, status, is_active 
    FROM integrations 
    ORDER BY agent_classification, name
  LOOP
    RAISE NOTICE '% | % | % | active:%', 
      LPAD(rec.name, 15), 
      LPAD(rec.agent_classification::text, 7), 
      LPAD(rec.status::text, 9),
      rec.is_active;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Channels (should include Gmail, Email Relay):';
  FOR rec IN 
    SELECT name, status, is_active 
    FROM integrations 
    WHERE agent_classification = 'channel'
    ORDER BY name
  LOOP
    RAISE NOTICE '  - % (status: %, active: %)', rec.name, rec.status, rec.is_active;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Tools (should include Web Search):';
  FOR rec IN 
    SELECT name, status, is_active 
    FROM integrations 
    WHERE agent_classification = 'tool'
    ORDER BY name
  LOOP
    RAISE NOTICE '  - % (status: %, active: %)', rec.name, rec.status, rec.is_active;
  END LOOP;
END $$;
