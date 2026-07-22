/**
 * Export Swagger Documentation
 * Run: node export-swagger.js
 * Generates: swagger.json and swagger.yaml
 */

const fs = require('fs');
const path = require('path');
const { specs } = require('./src/config/swagger');
const YAML = require('js-yaml');

// Export as JSON
const jsonPath = path.join(__dirname, 'swagger.json');
fs.writeFileSync(jsonPath, JSON.stringify(specs, null, 2));
console.log('✅ Swagger JSON exported to:', jsonPath);

// Export as YAML
try {
  const yamlStr = YAML.dump(specs);
  const yamlPath = path.join(__dirname, 'swagger.yaml');
  fs.writeFileSync(yamlPath, yamlStr);
  console.log('✅ Swagger YAML exported to:', yamlPath);
} catch (error) {
  console.log('⚠️  YAML export requires js-yaml package');
  console.log('   Install: npm install js-yaml');
}

console.log('\n📄 You can now share these files with your frontend team!');
console.log('   - swagger.json (OpenAPI JSON format)');
console.log('   - swagger.yaml (OpenAPI YAML format)');
console.log('\n💡 They can import these into:');
console.log('   - Postman');
console.log('   - Insomnia');
console.log('   - Swagger Editor (https://editor.swagger.io)');
