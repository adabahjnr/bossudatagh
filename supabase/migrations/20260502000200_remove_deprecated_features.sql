delete from public.navigation_links
where
  lower(label) like '%result checker%'
  or lower(label) like '%sub agents%'
  or lower(label) like '%sub agent%'
  or lower(label) like '%flyer generator%'
  or lower(url) like '%result-checker%'
  or lower(url) like '%sub-agents%'
  or lower(url) like '%sub-agent%'
  or lower(url) like '%flyer-generator%';

delete from public.pages
where
  lower(slug) like '%result-checker%'
  or lower(slug) like '%sub-agents%'
  or lower(slug) like '%sub-agent%'
  or lower(slug) like '%flyer-generator%'
  or lower(title) like '%result checker%'
  or lower(title) like '%sub agents%'
  or lower(title) like '%sub agent%'
  or lower(title) like '%flyer generator%'
  or lower(body) like '%result checker%'
  or lower(body) like '%sub agents%'
  or lower(body) like '%sub agent%'
  or lower(body) like '%flyer generator%';
