const mongoose = require('mongoose');
const Tenant = require('../src/models/Tenant');
require('dotenv').config();

async function upgradeLarsTenantToPro() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const tenantId = '68b859ed11be1e43c02b8265';
    
    // Find tenant
    console.log(`\nFinding tenant ${tenantId}...`);
    const tenant = await Tenant.findById(tenantId);
    
    if (!tenant) {
      console.log('❌ Tenant not found!');
      return;
    }
    
    console.log(`Found tenant: ${tenant.name}`);
    console.log(`Current subscription plan: ${tenant.subscription.plan}`);
    console.log(`Allow teams: ${tenant.limits.allowTeams}`);
    
    // Check if already Pro
    if (tenant.subscription.plan === 'pro') {
      console.log('✅ Tenant is already on Pro plan!');
      
      // But make sure teams are enabled
      if (!tenant.limits.allowTeams) {
        console.log('Enabling teams for Pro tenant...');
        tenant.limits.allowTeams = true;
        await tenant.save();
        console.log('✅ Teams enabled!');
      }
      return;
    }
    
    // Upgrade tenant to Pro
    console.log('\nUpgrading tenant to Pro...');
    tenant.subscription.plan = 'pro';
    tenant.subscription.status = 'active';
    tenant.limits.allowTeams = true;
    
    // Set up initial license for Pro plan
    if (!tenant.limits.purchasedLicenses || tenant.limits.purchasedLicenses < 1) {
      tenant.limits.purchasedLicenses = 1;
    }
    
    // Ensure active team members is at least 1 (the owner)
    if (!tenant.limits.activeTeamMembers || tenant.limits.activeTeamMembers < 1) {
      tenant.limits.activeTeamMembers = 1;
    }
    
    // Set pricing from environment
    tenant.billing.pricePerLicense = parseFloat(process.env.PRO_PLAN_PRICE_PER_USER || 10);
    
    await tenant.save();
    console.log('✅ Tenant upgraded to Pro successfully!');
    
    // Verify the upgrade
    const verifiedTenant = await Tenant.findById(tenantId);
    console.log(`\n✨ Verification:`);
    console.log(`  Tenant: ${verifiedTenant.name}`);
    console.log(`  Plan: ${verifiedTenant.subscription.plan}`);
    console.log(`  Allow Teams: ${verifiedTenant.limits.allowTeams}`);
    console.log(`  Purchased Licenses: ${verifiedTenant.limits.purchasedLicenses}`);
    console.log(`  Active Team Members: ${verifiedTenant.limits.activeTeamMembers}`);
    
    console.log('\n🎉 Tenant upgrade complete!');
    console.log(`Tenant "${verifiedTenant.name}" now has Pro plan with Teams enabled.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

upgradeLarsTenantToPro();