import { JSDOM } from 'jsdom';
import { Certificate } from '@blockcerts/cert-verifier-js';
import XMLHttpRequest from 'xhr2';
import fs from 'fs';

// Set up JSDOM with proper XMLHttpRequest
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Set up global environment properly
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.XMLHttpRequest = XMLHttpRequest;
global.fetch = dom.window.fetch ?? global.fetch;

// Also set up the global object that the verifier expects
if (typeof globalThis !== 'undefined') {
  globalThis.XMLHttpRequest = XMLHttpRequest;
  globalThis.fetch = global.fetch;
}

const certJson = JSON.parse(fs.readFileSync('/home/javi/Downloads/response_1761443392953.json', 'utf8'));

async function verifyCert() {
  try {
    console.log('Certificate JSON structure:');
    console.log('Proof anchors:', JSON.stringify(certJson.proof?.anchors, null, 2));
    
    const cert = new Certificate(certJson);
    await cert.init();
    const result = await cert.verify();
    console.log('Verification result:', result);
  } catch (error) {
    console.error('Error during verification:', error);
    console.error('Error details:', error.message);
  }
}

verifyCert();
