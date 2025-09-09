const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../src/config/database');
const { User, Tenant } = require('../src/models');

const migrateToFreeProModel = async () => {
  try {
    console.log('🚀 Starting migration to Free/Pro model...');
    
    await connectDB();
    console.log('✅ Database connected');

    // Get all existing users and tenants
    const users = await User.find({});
    const tenants = await Tenant.find({});
    
    console.log(`📊 Found ${users.length} users and ${tenants.length} tenants`);

    // Migrate Users
    console.log('\n👥 Migrating Users...');
    let userUpdates = 0;
    
    for (const user of users) {
      const updates = {};
      
      // Add accountType if missing
      if (!user.accountType) {
        updates.accountType = 'free'; // Default to free
      }
      
      // Add usage tracking if missing
      if (!user.usage) {
        updates.usage = {
          processesThisMonth: 0,
          storageUsedMB: 0,
          lastResetDate: new Date()
        };
      }
      
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(user._id, updates);
        userUpdates++;
        console.log(`  ✅ Updated user: ${user.email} -> ${updates.accountType || user.accountType}`);
      }
    }

    // Migrate Tenants
    console.log('\n🏢 Migrating Tenants...');
    let tenantUpdates = 0;
    
    for (const tenant of tenants) {
      const updates = {};
      
      // Update subscription plans
      if (tenant.subscription?.plan) {
        const oldPlan = tenant.subscription.plan;
        if (['basic', 'premium', 'enterprise'].includes(oldPlan)) {
          updates['subscription.plan'] = 'pro';
          console.log(`  📈 Converting ${oldPlan} -> pro for tenant: ${tenant.name}`);
        }
      }
      
      // Update billing structure
      if (tenant.billing?.customPricing?.freeUsers) {
        updates['billing.freeProUsers'] = tenant.billing.customPricing.freeUsers;
        updates['billing.customPricing.freeProUsers'] = tenant.billing.customPricing.freeUsers;
        console.log(`  💰 Migrated freeUsers -> freeProUsers: ${tenant.billing.customPricing.freeUsers}`);
      }
      
      // Update limits structure
      if (tenant.limits?.currentUsers) {
        updates['limits.currentProUsers'] = tenant.limits.currentUsers;
        console.log(`  👥 Migrated currentUsers -> currentProUsers: ${tenant.limits.currentUsers}`);
      }
      
      // Enable teams for existing tenants with users > 1
      const userCount = await User.countDocuments({ tenantId: tenant._id });
      if (userCount > 1) {
        updates['limits.allowTeams'] = true;
        updates['subscription.plan'] = 'pro';
        console.log(`  🤝 Enabled teams for multi-user tenant: ${tenant.name}`);
      }
      
      if (Object.keys(updates).length > 0) {
        await Tenant.findByIdAndUpdate(tenant._id, updates);
        tenantUpdates++;
        console.log(`  ✅ Updated tenant: ${tenant.name}`);
      }
    }

    // Update Pro Users' accountType
    console.log('\n🌟 Upgrading users in Pro tenants...');
    const proTenants = await Tenant.find({ 'subscription.plan': 'pro' });
    let proUserUpdates = 0;
    
    for (const tenant of proTenants) {
      const tenantUsers = await User.find({ tenantId: tenant._id });
      
      for (const user of tenantUsers) {
        if (user.accountType === 'free') {
          await User.findByIdAndUpdate(user._id, { accountType: 'pro' });
          proUserUpdates++;
          console.log(`  ⭐ Upgraded user to Pro: ${user.email}`);
        }
      }
    }

    // Summary
    console.log('\n📈 Migration Summary:');
    console.log(`  👥 Users updated: ${userUpdates}`);
    console.log(`  🏢 Tenants updated: ${tenantUpdates}`);
    console.log(`  ⭐ Users upgraded to Pro: ${proUserUpdates}`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('  1. Update your billing logic to use new model');
    console.log('  2. Update frontend UI to show Free vs Pro features');
    console.log('  3. Test upload limits for Free accounts');
    console.log('  4. Test team restrictions');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
    process.exit(0);
  }
};

// Run migration
if (require.main === module) {
  migrateToFreeProModel();
}

module.exports = migrateToFreeProModel;