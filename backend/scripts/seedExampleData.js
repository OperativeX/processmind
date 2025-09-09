#!/usr/bin/env node

/**
 * Script to seed example data for testing the super admin dashboard
 * Usage: node scripts/seedExampleData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../src/models/Tenant');
const User = require('../src/models/User');
const Process = require('../src/models/Process');
const TenantStatistics = require('../src/models/TenantStatistics');
const SystemSettings = require('../src/models/SystemSettings');

async function seedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing example data...');
    await Tenant.deleteMany({ name: { $regex: /^Example / } });
    await User.deleteMany({ email: { $regex: /@example/ } });
    await Process.deleteMany({ title: { $regex: /^Example / } });
    await TenantStatistics.deleteMany({});
    
    // Create System Settings
    console.log('⚙️  Creating system settings...');
    await SystemSettings.findOneAndUpdate(
      { key: 'pricing' },
      {
        $set: {
          value: {
            defaultFreeUsers: 1,
            defaultPricePerUser: 10.00,
            currency: 'EUR'
          }
        }
      },
      { upsert: true }
    );

    // Create Example Tenants
    console.log('🏢 Creating example tenants...');
    
    const tenants = [];
    
    // Tenant 1: Active with custom pricing
    const tenant1 = await Tenant.create({
      name: 'Example Tech GmbH',
      domain: 'example-tech',
      isActive: true,
      subscription: {
        plan: 'premium',
        status: 'active',
        billingEmail: 'billing@example-tech.com'
      },
      billing: {
        customPricing: {
          enabled: true,
          pricePerUser: 8.00,
          freeUsers: 3,
          notes: 'Beta Partner - 20% discount'
        }
      },
      limits: {
        currentUsers: 5,
        maxUsers: -1
      },
      statistics: {
        totalProcesses: 156,
        processesLast30Days: 42,
        processesLast90Days: 98,
        processesLast365Days: 156
      }
    });
    tenants.push(tenant1);

    // Tenant 2: Free tier
    const tenant2 = await Tenant.create({
      name: 'Example Startup',
      domain: 'example-startup',
      isActive: true,
      subscription: {
        plan: 'free',
        status: 'active',
        billingEmail: 'info@example-startup.com'
      },
      limits: {
        currentUsers: 1,
        maxUsers: 1
      },
      statistics: {
        totalProcesses: 23,
        processesLast30Days: 8,
        processesLast90Days: 15,
        processesLast365Days: 23
      }
    });
    tenants.push(tenant2);

    // Tenant 3: Enterprise with many users
    const tenant3 = await Tenant.create({
      name: 'Example Enterprise AG',
      domain: 'example-enterprise',
      isActive: true,
      subscription: {
        plan: 'enterprise',
        status: 'active',
        billingEmail: 'accounts@example-enterprise.com'
      },
      billing: {
        customPricing: {
          enabled: true,
          pricePerUser: 6.00,
          freeUsers: 10,
          notes: 'Enterprise Deal - Volume Discount'
        }
      },
      limits: {
        currentUsers: 25,
        maxUsers: -1
      },
      statistics: {
        totalProcesses: 512,
        processesLast30Days: 89,
        processesLast90Days: 234,
        processesLast365Days: 512
      }
    });
    tenants.push(tenant3);

    // Tenant 4: Suspended account
    const tenant4 = await Tenant.create({
      name: 'Example Inactive Co.',
      domain: 'example-inactive',
      isActive: false,
      subscription: {
        plan: 'basic',
        status: 'suspended',
        billingEmail: 'contact@example-inactive.com'
      },
      limits: {
        currentUsers: 3,
        maxUsers: 5
      },
      statistics: {
        totalProcesses: 45,
        processesLast30Days: 0,
        processesLast90Days: 0,
        processesLast365Days: 45
      }
    });
    tenants.push(tenant4);

    console.log(`✅ Created ${tenants.length} example tenants`);

    // Create Users for each tenant
    console.log('👥 Creating example users...');
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    let totalUsers = 0;

    // Users for Tenant 1
    for (let i = 1; i <= 5; i++) {
      await User.create({
        tenantId: tenant1._id,
        email: `user${i}@example-tech.com`,
        password: hashedPassword,
        firstName: `Tech`,
        lastName: `User${i}`,
        role: i === 1 ? 'owner' : i === 2 ? 'admin' : 'user',
        isEmailVerified: true
      });
      totalUsers++;
    }

    // Users for Tenant 2
    await User.create({
      tenantId: tenant2._id,
      email: 'founder@example-startup.com',
      password: hashedPassword,
      firstName: 'Startup',
      lastName: 'Founder',
      role: 'owner',
      isEmailVerified: true
    });
    totalUsers++;

    // Users for Tenant 3
    for (let i = 1; i <= 25; i++) {
      await User.create({
        tenantId: tenant3._id,
        email: `employee${i}@example-enterprise.com`,
        password: hashedPassword,
        firstName: `Employee`,
        lastName: `Number${i}`,
        role: i === 1 ? 'owner' : i <= 3 ? 'admin' : 'user',
        isEmailVerified: true
      });
      totalUsers++;
    }

    console.log(`✅ Created ${totalUsers} example users`);

    // Create Example Processes
    console.log('📹 Creating example processes...');
    
    let totalProcesses = 0;
    const processStatuses = ['completed', 'processing_media', 'failed'];
    const processTitles = [
      'Quarterly Review Meeting',
      'Product Demo Session',
      'Team Standup',
      'Client Presentation',
      'Training Workshop',
      'Strategy Discussion',
      'Sales Call Recording',
      'Technical Interview',
      'Board Meeting',
      'Customer Feedback Session'
    ];

    // Create processes for active tenants
    for (const tenant of [tenant1, tenant2, tenant3]) {
      const users = await User.find({ tenantId: tenant._id });
      
      // Create recent processes (last 30 days)
      const recentCount = Math.floor(Math.random() * 10) + 5;
      for (let i = 0; i < recentCount; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        
        await Process.create({
          tenantId: tenant._id,
          userId: users[Math.floor(Math.random() * users.length)]._id,
          title: `Example ${processTitles[Math.floor(Math.random() * processTitles.length)]}`,
          originalFilename: `video_${Date.now()}_${i}.mp4`,
          files: {
            processed: {
              path: `/uploads/processed/example_${i}.mp4`,
              size: Math.floor(Math.random() * 100000000) + 10000000,
              format: 'mp4',
              codec: 'h264',
              resolution: { width: 1920, height: 1080 }
            }
          },
          transcript: {
            text: 'This is an example transcript for demonstration purposes.',
            segments: [
              { start: 0, end: 10, text: 'Example segment 1' },
              { start: 10, end: 20, text: 'Example segment 2' }
            ]
          },
          tags: [
            { name: 'example', weight: 0.8 },
            { name: 'demo', weight: 0.7 },
            { name: 'test', weight: 0.6 },
            { name: 'meeting', weight: 0.9 }
          ],
          status: processStatuses[Math.floor(Math.random() * processStatuses.length)],
          createdAt,
          updatedAt: createdAt
        });
        totalProcesses++;
      }
    }

    console.log(`✅ Created ${totalProcesses} example processes`);

    // Create Tenant Statistics
    console.log('📈 Creating tenant statistics...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const tenant of tenants) {
      // Create daily stats for last 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        await TenantStatistics.create({
          tenantId: tenant._id,
          date,
          type: 'daily',
          metrics: {
            newProcesses: Math.floor(Math.random() * 5),
            totalProcesses: tenant.statistics.totalProcesses,
            activeUsers: Math.floor(Math.random() * tenant.limits.currentUsers) + 1,
            newUsers: i === 15 ? 1 : 0, // One new user 15 days ago
            totalUsers: tenant.limits.currentUsers,
            apiCalls: Math.floor(Math.random() * 100) + 10,
            transcriptionMinutes: Math.floor(Math.random() * 60) + 5,
            aiTokensUsed: Math.floor(Math.random() * 5000) + 1000,
            estimatedCost: Math.random() * 5 + 0.5
          }
        });
      }
    }

    console.log('✅ Created tenant statistics');

    // Summary
    console.log('\n🎉 Example data seeding completed!');
    console.log('\n📊 Summary:');
    console.log(`- ${tenants.length} Tenants created`);
    console.log(`- ${totalUsers} Users created`);
    console.log(`- ${totalProcesses} Processes created`);
    console.log(`- 30 days of statistics for each tenant`);
    
    console.log('\n🔐 Super Admin Login:');
    console.log('- URL: http://localhost:5001/super-admin/login');
    console.log('- Email: admin@processmind.com');
    console.log('- Password: supersecretpassword123');
    
    console.log('\n👤 Example User Login:');
    console.log('- Email: user1@example-tech.com');
    console.log('- Password: password123');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the seeding
seedData();