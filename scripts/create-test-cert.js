import fetch from 'node-fetch';
import fs from 'fs';

const API_BASE = 'http://localhost:3000';

async function createTestCertificate() {
  try {
    console.log('🚀 Creating test certificate via API...');

    // 1. Create a template
    const templateData = {
      name: 'Test Certificate Template',
      description: 'Template for testing certificate generation',
      jsonLd: {
        recipientName: '{name}',
        recipientEmail: '{email}',
        course: '{course}',
        date: '{date}'
      },
      variables: ['name', 'email', 'course', 'date']
    };

    console.log('📝 Creating template...');
    const templateResponse = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData)
    });

    if (!templateResponse.ok) {
      throw new Error(`Template creation failed: ${templateResponse.statusText}`);
    }

    const template = await templateResponse.json();
    console.log('✅ Template created:', template.id);

    // 2. Issue certificate
    const certificateData = {
      templateId: template.id,
      recipients: [
        {
          name: 'Veronica Antezana',
          email: 'veronica@example.com',
          course: 'Blockcerts Test Course',
          date: new Date().toISOString()
        }
      ]
    };

    console.log('📜 Issuing certificate...');
    const certificateResponse = await fetch(`${API_BASE}/certificates/issue-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(certificateData)
    });

    if (!certificateResponse.ok) {
      throw new Error(`Certificate issuance failed: ${certificateResponse.statusText}`);
    }

    const certificates = await certificateResponse.json();
    const certificate = certificates[0];
    console.log('✅ Certificate created:', certificate.id);

    // 3. Anchor the certificate
    console.log('⚓ Anchoring certificate...');
    const anchorData = {
      certificateIds: [certificate.id],
      blockchain: 'sepolia'
    };

    const anchorResponse = await fetch(`${API_BASE}/anchors/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(anchorData)
    });

    if (!anchorResponse.ok) {
      throw new Error(`Anchoring failed: ${anchorResponse.statusText}`);
    }

    const anchor = await anchorResponse.json();
    console.log('✅ Certificate anchored:', anchor.id);

    // 4. Get the final blockcerts JSON
    console.log('📄 Getting final certificate...');
    const finalResponse = await fetch(`${API_BASE}/certificates/${certificate.id}/blockcerts`);
    
    if (!finalResponse.ok) {
      throw new Error(`Failed to get final certificate: ${finalResponse.statusText}`);
    }

    const finalCertificate = await finalResponse.json();
    
    // 5. Save to file
    const outputFile = 'certificate_new_corrected.json';
    fs.writeFileSync(outputFile, JSON.stringify(finalCertificate, null, 2));
    console.log(`✅ Certificate saved to ${outputFile}`);

    // 6. Display certificate structure
    console.log('\n📋 Certificate Structure:');
    console.log('ID:', finalCertificate.id);
    console.log('Type:', finalCertificate.type);
    console.log('Issuer:', finalCertificate.issuer.name);
    console.log('Subject:', finalCertificate.credentialSubject.name);
    console.log('Course:', finalCertificate.credentialSubject.courseName);
    
    if (finalCertificate.proof && finalCertificate.proof.anchors) {
      console.log('\n🔗 Anchors:');
      finalCertificate.proof.anchors.forEach((anchor, index) => {
        console.log(`  Anchor ${index + 1}:`);
        console.log(`    Type: ${anchor.type}`);
        console.log(`    Value: ${anchor.value}`);
        console.log(`    Contract: ${anchor.contractAddress || 'Not specified'}`);
      });
    }

    console.log('\n🎉 Test certificate created successfully!');
    console.log('You can now test this certificate with the Blockcerts verifier.');
    console.log('File:', outputFile);

    return { certificate, outputFile, finalCertificate };

  } catch (error) {
    console.error('❌ Error creating certificate:', error.message);
    throw error;
  }
}

createTestCertificate();
