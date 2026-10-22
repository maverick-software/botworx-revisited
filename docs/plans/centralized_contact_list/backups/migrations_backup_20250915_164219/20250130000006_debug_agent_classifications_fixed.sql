-- Debug Agent Classifications (Fixed)
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
      RPAD(rec.name, 15), 
      RPAD(rec.agent_classification::text, 7), 
      RPAD(rec.status::text, 9),
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
    RAISE NOTICE '  - % (status: %, active: %)', rec.name, rec.status::text, rec.is_active;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Tools (should include Web Search):';
  FOR rec IN 
    SELECT name, status, is_active 
    FROM integrations 
    WHERE agent_classification = 'tool'
    ORDER BY name
  LOOP
    RAISE NOTICE '  - % (status: %, active: %)', rec.name, rec.status::text, rec.is_active;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Status breakdown:';
  FOR rec IN 
    SELECT agent_classification, status::text, COUNT(*) as count
    FROM integrations 
    GROUP BY agent_classification, status
    ORDER BY agent_classification, status
  LOOP
    RAISE NOTICE '  % + % = % integrations', rec.agent_classification, rec.status, rec.count;
  END LOOP;
END $$;
