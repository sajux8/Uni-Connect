-- 0007: starter spaces and tags (reference data; admins manage them later in /admin)
-- Spaces agreed with the project owner on 2026-10-05: one per department, three general
-- spaces, the Computing Society and Final Year Projects. All open to join.

with defaults as (
  select 'Be respectful and stay on topic.
Search before you ask; someone may have answered already.
No phone numbers or personal contact details in posts.
Report anything that breaks these rules instead of replying to it.'::text as rules
)
insert into public.spaces (slug, name, description, type, department_id, year_of_study, icon, rules)
select v.slug, v.name, v.description, v.type::public.space_type,
       (select id from public.departments where code = v.dept), v.year, v.icon, defaults.rules
from defaults, (values
  ('computing', 'Computing', 'Programming, networks, data and everything else in the Computing department.', 'department', 'COM', null::smallint, 'Monitor'),
  ('business-management', 'Business & Management', 'Modules, case studies and opportunities for Business & Management students.', 'department', 'BUS', null, 'Briefcase'),
  ('engineering', 'Engineering', 'Labs, design projects and help for Engineering students.', 'department', 'ENG', null, 'Cog'),
  ('english-languages', 'English & Languages', 'Writing, language practice and literature discussions.', 'department', 'ENL', null, 'Languages'),
  ('law', 'Law', 'Cases, moots and study tips for Law students.', 'department', 'LAW', null, 'Scale'),
  ('campus-life', 'Campus Life', 'Everything about life at ICBT: facilities, food, transport and things to do.', 'general', null, null, 'Coffee'),
  ('freshers-help-desk', 'Freshers Help Desk', 'New to ICBT? Ask anything about getting started. Seniors are here to help.', 'general', null, null, 'LifeBuoy'),
  ('internships-careers', 'Internships & Careers', 'Internship openings, CV tips, interviews and career advice.', 'general', null, null, 'BriefcaseBusiness'),
  ('computing-society', 'Computing Society', 'Hackathons, workshops and meet-ups run by the Computing Society.', 'club', 'COM', null, 'Code'),
  ('final-year-projects', 'Final Year Projects', 'Proposals, supervisors, methodology and demos for final-year projects.', 'general', null, 4::smallint, 'GraduationCap')
) as v(slug, name, description, type, dept, year, icon)
on conflict (slug) do nothing;

insert into public.tags (name, slug) values
  ('Assignments', 'assignments'), ('Exams', 'exams'), ('Past papers', 'past-papers'),
  ('Lecture notes', 'lecture-notes'), ('Timetable', 'timetable'), ('Module selection', 'module-selection'),
  ('LMS', 'lms'), ('Programming', 'programming'), ('Web development', 'web-development'),
  ('Databases', 'databases'), ('Networking', 'networking'), ('AI', 'ai'),
  ('Final year project', 'final-year-project'), ('Research', 'research'), ('Internships', 'internships'),
  ('CV', 'cv'), ('Interviews', 'interviews'), ('Scholarships', 'scholarships'),
  ('Fees', 'fees'), ('Library', 'library'), ('Transport', 'transport'),
  ('Clubs', 'clubs'), ('Events', 'events'), ('Freshers', 'freshers'), ('Wellbeing', 'wellbeing')
on conflict (slug) do nothing;
