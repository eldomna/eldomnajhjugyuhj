-- Removal of the regression/rule-testing module (Items 8 & 10)
-- Drops tables that were exclusively used by the Rule Testing Sandbox and Regression Suite.
drop table if exists public.rule_test_runs;
drop table if exists public.rule_test_cases;
