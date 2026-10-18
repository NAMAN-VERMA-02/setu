-- Demo college. tier is a placeholder (1-3); set it to the real tier before the pilot.
insert into public.colleges (name, tier, email_domain)
values ('KIET Group of Institutions', 2, 'kiet.edu')
on conflict (email_domain) do nothing;
