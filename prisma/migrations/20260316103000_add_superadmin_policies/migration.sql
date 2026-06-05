-- Superadmin policies for control-plane tables

CREATE POLICY "superadmin_access" ON "public"."Tenant"
  FOR ALL
  USING (current_setting('app.superadmin', true) = 'true')
  WITH CHECK (current_setting('app.superadmin', true) = 'true');

CREATE POLICY "superadmin_access" ON "public"."TenantBranding"
  FOR ALL
  USING (current_setting('app.superadmin', true) = 'true')
  WITH CHECK (current_setting('app.superadmin', true) = 'true');

CREATE POLICY "superadmin_access" ON "public"."Membership"
  FOR ALL
  USING (current_setting('app.superadmin', true) = 'true')
  WITH CHECK (current_setting('app.superadmin', true) = 'true');

CREATE POLICY "superadmin_access" ON "public"."ApiKey"
  FOR ALL
  USING (current_setting('app.superadmin', true) = 'true')
  WITH CHECK (current_setting('app.superadmin', true) = 'true');

CREATE POLICY "superadmin_access" ON "public"."TenantPlan"
  FOR ALL
  USING (current_setting('app.superadmin', true) = 'true')
  WITH CHECK (current_setting('app.superadmin', true) = 'true');

CREATE POLICY "superadmin_access" ON "public"."QuotaUsage"
  FOR ALL
  USING (current_setting('app.superadmin', true) = 'true')
  WITH CHECK (current_setting('app.superadmin', true) = 'true');
