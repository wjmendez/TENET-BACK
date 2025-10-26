import fs from 'fs';

// Read the new certificate
const certJson = JSON.parse(fs.readFileSync('certificate_new_corrected.json', 'utf8'));

console.log('🔍 Certificate Verification Analysis');
console.log('=====================================\n');

console.log('📋 Certificate Details:');
console.log(`ID: ${certJson.id}`);
console.log(`Type: ${certJson.type.join(', ')}`);
console.log(`Issuer: ${certJson.issuer.name}`);
console.log(`Subject: ${certJson.credentialSubject.name}`);
console.log(`Course: ${certJson.credentialSubject.courseName}`);
console.log(`Issuance Date: ${certJson.issuanceDate}`);

console.log('\n🔐 Proof Analysis:');
if (certJson.proof) {
  console.log(`Type: ${certJson.proof.type}`);
  console.log(`Purpose: ${certJson.proof.proofPurpose}`);
  console.log(`Created: ${certJson.proof.created}`);
  console.log(`Merkle Root: ${certJson.proof.merkleRoot}`);
  console.log(`Target Hash: ${certJson.proof.targetHash}`);
  console.log(`Proof Value: ${certJson.proof.proofValue ? 'Present' : 'Missing'}`);
  
  console.log('\n⚓ Anchors:');
  if (certJson.proof.anchors && certJson.proof.anchors.length > 0) {
    certJson.proof.anchors.forEach((anchor, index) => {
      console.log(`  Anchor ${index + 1}:`);
      console.log(`    Type: ${anchor.type}`);
      console.log(`    Value: ${anchor.value}`);
      console.log(`    Contract: ${anchor.contractAddress || 'Not specified'}`);
    });
  } else {
    console.log('  ❌ No anchors found!');
  }
} else {
  console.log('❌ No proof found!');
}

console.log('\n✅ Verification Requirements Check:');
const hasValidProof = certJson.proof && certJson.proof.type === 'MerkleProof2019';
const hasTransactionId = certJson.proof?.anchors?.some(anchor => anchor.value && anchor.type === 'ETHEREUM_SEPOLIA');
const hasMerkleRoot = certJson.proof?.merkleRoot;
const hasTargetHash = certJson.proof?.targetHash;
const hasProofValue = certJson.proof?.proofValue;

console.log(`Valid Proof Type: ${hasValidProof ? '✅' : '❌'}`);
console.log(`Transaction ID: ${hasTransactionId ? '✅' : '❌'}`);
console.log(`Merkle Root: ${hasMerkleRoot ? '✅' : '❌'}`);
console.log(`Target Hash: ${hasTargetHash ? '✅' : '❌'}`);
console.log(`Proof Value: ${hasProofValue ? '✅' : '❌'}`);

const allRequirementsMet = hasValidProof && hasTransactionId && hasMerkleRoot && hasTargetHash && hasProofValue;

console.log('\n🎯 Final Assessment:');
if (allRequirementsMet) {
  console.log('✅ Certificate structure is CORRECT for Blockcerts verification!');
  console.log('The certificate should now verify successfully with the Blockcerts verifier.');
  console.log('\n📁 File: certificate_new_corrected.json');
  console.log('🌐 You can test this certificate at: https://www.blockcerts.org/verifier/');
} else {
  console.log('❌ Certificate structure has issues that may prevent verification.');
  console.log('Please check the missing requirements above.');
}

console.log('\n📊 Comparison with Previous Issue:');
console.log('Previous error: "Cannot verify this certificate without a transaction ID to compare against"');
console.log('Current status:', hasTransactionId ? '✅ RESOLVED - Transaction ID is present' : '❌ STILL ISSUED - Transaction ID missing');

