-- 0039: "missed 3 classes in a row" alerts go to every super admin as well as the department's
-- coordinators, so they're in-app by default (each person can turn email on in their settings).
update public.notification_types set email_default = false where type = 'attendance_alert';
