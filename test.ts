import axios from 'axios';
export class ReoptApiExplorer {
  private apiKey: string= 'ZWDHHf8FBv9l0RM9eDbnETzYxQN9wbxet007ekBj';
  private baseUrl = 'https://developer.nrel.gov/api/reopt';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async testApiPattern() {
    try {
      // Test simple input to see response pattern
      const simpleInput = {
        site: { latitude: 40.7128, longitude: -74.0060 },
        load: { annual_kwh: 12000 },
        pv: { max_kw: 5 }
      };

      console.log('Testing REopt API pattern...');
      const response = await axios.post(`${this.baseUrl}/v1/job`, simpleInput, {
        headers: { 'X-API-Key': this.apiKey }
      });

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      // Check if response contains:
      // - Immediate results (synchronous)
      // - Job ID for polling (asynchronous)
      // - Status indicator

      if (response.data.run_uuid && response.data.status === 'submitted') {
        console.log('✓ Asynchronous pattern detected - need to poll for results');
        return 'async';
      } else if (response.data.outputs) {
        console.log('✓ Synchronous pattern detected - results returned immediately');
        return 'sync';
      } else {
        console.log('? Unknown pattern:', response.data);
        return 'unknown';
      }

    } catch (error) {
      console.error('API test failed:', error.response?.data || error.message);
      throw error;
    }
  }
}

const explorer = new ReoptApiExplorer('ZWDHHf8FBv9l0RM9eDbnETzYxQN9wbxet007ekBj');
explorer.testApiPattern()  .then(pattern => {
    console.log('Detected API pattern:', pattern);
  }).catch(err => {
    console.error('Error testing API pattern:', err);
  });