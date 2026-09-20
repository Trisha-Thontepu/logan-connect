-- The original seed included five invented businesses (with invented owners, street
-- addresses and phone numbers) to round out the demo. Now that this is a real
-- directory, publishing made-up phone numbers next to real street addresses is a
-- risk to whoever actually owns those numbers, so they are removed. ON DELETE
-- CASCADE clears their services, appointments and message logs.
DELETE FROM businesses WHERE slug IN (
  'panaderia-la-perla',
  'taqueria-el-portal',
  'barberia-don-chuy',
  'lavanderia-rapida',
  'estetica-bella-vida'
);
