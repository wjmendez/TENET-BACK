import fs from 'fs';

// Read the certificate file
const certJson = JSON.parse(fs.readFileSync('certificate_new_corrected.json', 'utf8'));

console.log('=== Certificate Structure Analysis ===');
console.log('Certificate ID:', certJson.id);
console.log('Certificate Type:', certJson.type);
console.log('Issuer:', certJson.issuer);

console.log('\n=== Proof Structure ===');
if (certJson.proof) {
  console.log('Proof Type:', certJson.proof.type);
  console.log('Proof Purpose:', certJson.proof.proofPurpose);
  console.log('Verification Method:', certJson.proof.verificationMethod);
  console.log('Merkle Root:', certJson.proof.merkleRoot);
  console.log('Target Hash:', certJson.proof.targetHash);
  console.log('Proof Value:', certJson.proof.proofValue ? 'Present' : 'Missing');
  
  console.log('\n=== Anchors ===');
  if (certJson.proof.anchors && certJson.proof.anchors.length > 0) {
    certJson.proof.anchors.forEach((anchor, index) => {
      console.log(`Anchor ${index + 1}:`);
      console.log('  Type:', anchor.type);
      console.log('  Value:', anchor.value);
      console.log('  Contract Address:', anchor.contractAddress || 'Not specified');
    });
  } else {
    console.log('No anchors found!');
  }
} else {
  console.log('No proof found!');
}

console.log('\n=== Verification Requirements Check ===');
const hasTransactionId = certJson.proof?.anchors?.some(anchor => anchor.value);
console.log('Has Transaction ID:', hasTransactionId ? 'YES' : 'NO');

if (!hasTransactionId) {
  console.log('\n❌ ERROR: Certificate is missing transaction ID in anchors!');
  console.log('This is why verification fails with "Cannot verify this certificate without a transaction ID"');
} else {
  console.log('\n✅ Certificate structure looks correct for verification');
}
