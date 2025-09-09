require('dotenv').config();
const mongoose = require('mongoose');
const { User, Process, Tenant } = require('./src/models');

async function debugTenantMismatch() {
  try {
    await mongoose.connect('mongodb://localhost:27017/process-mind');
    
    // 1. Check user details
    const user = await User.findOne({ email: 'j.tacke1@web.de' }).populate('tenantId');
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('👤 USER DETAILS:');
    console.log('   Email:', user.email);
    console.log('   User ID:', user._id);
    console.log('   Tenant ID:', user.tenantId._id);
    console.log('   Tenant Name:', user.tenantId.name);
    console.log('   Active:', user.isActive);
    console.log('');
    
    // 2. Check processes for this tenant
    const processesForTenant = await Process.find({ tenantId: user.tenantId._id });
    console.log(`📊 PROCESSES FOR TENANT "${user.tenantId.name}":`, processesForTenant.length);
    
    // 3. Check the specific process
    const specificProcess = await Process.findById('68b06901aefd4987c43f12bd');
    if (specificProcess) {
      console.log('\n🎯 SPECIFIC PROCESS (68b06901aefd4987c43f12bd):');
      console.log('   Title:', specificProcess.title);
      console.log('   Status:', specificProcess.status);
      console.log('   Process Tenant ID:', specificProcess.tenantId);
      console.log('   Process User ID:', specificProcess.userId);
      console.log('   TENANT MATCH:', specificProcess.tenantId.toString() === user.tenantId._id.toString() ? '✅ YES' : '❌ NO');
      
      if (specificProcess.tenantId.toString() !== user.tenantId._id.toString()) {
        console.log('\n⚠️  TENANT MISMATCH DETECTED!');
        console.log('   Expected:', user.tenantId._id);
        console.log('   Actual:', specificProcess.tenantId);
        
        // Find which tenant owns this process
        const actualTenant = await Tenant.findById(specificProcess.tenantId);
        console.log('   Process belongs to:', actualTenant ? actualTenant.name : 'Unknown Tenant');
      }
    }
    
    // 4. Check all processes in database
    const allProcesses = await Process.find({}).populate('tenantId', 'name');
    console.log('\n📋 ALL PROCESSES IN DATABASE:');
    allProcesses.forEach((proc, i) => {
      console.log(`   ${i+1}. ${proc.title || proc.originalFilename}`);
      console.log(`      Tenant: ${proc.tenantId?.name || proc.tenantId}`);
      console.log(`      Status: ${proc.status}`);
      console.log(`      Created: ${proc.createdAt}`);
    });
    
    // 5. Check for orphaned processes (wrong user ID)
    const processesWithWrongUser = await Process.find({ 
      tenantId: user.tenantId._id,
      userId: { $ne: user._id }
    });
    if (processesWithWrongUser.length > 0) {
      console.log('\n⚠️  PROCESSES WITH WRONG USER ID:', processesWithWrongUser.length);
      processesWithWrongUser.forEach(proc => {
        console.log(`   - ${proc.title || proc.originalFilename} (User: ${proc.userId})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

debugTenantMismatch();