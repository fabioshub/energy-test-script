import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// TypeScript interfaces for REopt API
interface Site {
  longitude: number;
  latitude: number;
}

interface PV {
  array_type: number;
}

interface ElectricLoad {
  doe_reference_name: string;
  annual_kwh: number;
  year: number;
}

interface ElectricTariff {
  urdb_label: string;
  urdb_response?: any;
}

interface Financial {
  elec_cost_escalation_rate_fraction: number;
  owner_discount_rate_fraction: number;
  analysis_years: number;
  offtaker_tax_rate_fraction: number;
  owner_tax_rate_fraction: number;
  om_cost_escalation_rate_fraction: number;
}

interface REoptInput {
  Site: Site;
  PV: PV;
  ElectricLoad: ElectricLoad;
  ElectricTariff: ElectricTariff;
  Financial: Financial;
}

interface REoptResponse {
  run_uuid: string;
  api_version: string;
  user_uuid: string;
  webtool_uuid: string;
  job_type: string;
  status: string;
  created: string;
  reopt_version: string;
  inputs: REoptInput;
  outputs: any;
  messages: {
    info: string;
    errors: any;
    warnings: any;
    has_stacktrace: boolean;
  };
}

export class REoptApiClient {
  private apiKey: string;
  private baseUrl: string;
  private inputsPath: string;
  private outputsPath: string;
  private loadsPath: string;
  private ratesPath: string;

  constructor(apiKey: string = 'ZWDHHf8FBv9l0RM9eDbnETzYxQN9wbxet007ekBj') {
    this.apiKey = apiKey;
    this.baseUrl = 'https://developer.nrel.gov/api/reopt/stable';
    this.inputsPath = path.join('.', 'inputs');
    this.outputsPath = path.join('.', 'outputs');
    this.loadsPath = path.join('.', 'load_profiles');
    this.ratesPath = path.join('.', 'electric_rates');
    
    // Create directories if they don't exist
    this.createDirectories();
  }

  private createDirectories() {
    [this.inputsPath, this.outputsPath, this.loadsPath, this.ratesPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * POST and poll the API to get results
   */
  async getApiResults(
    postData: REoptInput,
    outputFileName: string = 'results_file',
    runId?: string
  ): Promise<REoptResponse> {
    try {
      console.log('Submitting job to REopt API...');
      
      // Submit job
      const jobResponse = await axios.post(
        `${this.baseUrl}/job/?api_key=${this.apiKey}`,
        postData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`Response OK from ${this.baseUrl}/job/?api_key=${this.apiKey}`);
      
      const runUuid = jobResponse.data.run_uuid;
      console.log(`Run UUID: ${runUuid}`);
      
      // Poll for results
      const resultsUrl = `${this.baseUrl}/job/${runUuid}/results/?api_key=${this.apiKey}`;
      console.log(`Polling ${resultsUrl} for results with interval of 5s...`);
      
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max
      
      while (attempts < maxAttempts) {
        const resultResponse = await axios.get(resultsUrl);
        const result = resultResponse.data;
        
        if (result.status === 'optimal' || result.status === 'error') {
          console.log(`Job completed with status: ${result.status}`);
          
          // Save results to file
          const outputPath = path.join(this.outputsPath, `${outputFileName}.json`);
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
          console.log(`Saved results to ${outputPath}`);
          
          return result;
        }
        
        console.log(`Status: ${result.status}... waiting...`);
        await this.sleep(5000); // Wait 5 seconds
        attempts++;
      }
      
      throw new Error('API polling timed out');
      
    } catch (error) {
      console.error('API error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a sample scenario input
   */
  createSampleScenario(): REoptInput {
    return {
      Site: {
        longitude: -118.1164613,
        latitude: 34.5794343
      },
      PV: {
        array_type: 0
      },
      ElectricLoad: {
        doe_reference_name: "RetailStore",
        annual_kwh: 100000.0,
        year: 2017
      },
      ElectricTariff: {
        urdb_label: "5ed6c1a15457a3367add15ae"
      },
      Financial: {
        elec_cost_escalation_rate_fraction: 0.026,
        owner_discount_rate_fraction: 0.081,
        analysis_years: 20,
        offtaker_tax_rate_fraction: 0.4,
        owner_tax_rate_fraction: 0.4,
        om_cost_escalation_rate_fraction: 0.025
      }
    };
  }

  /**
   * Load custom electric rate from file
   */
  loadElectricRate(rateName: string): any {
    const ratePath = path.join(this.ratesPath, `${rateName}.json`);
    if (fs.existsSync(ratePath)) {
      const rateData = fs.readFileSync(ratePath, 'utf8');
      return JSON.parse(rateData);
    }
    return null;
  }

  /**
   * Save POST data to JSON file
   */
  savePostData(postData: REoptInput, fileName: string): void {
    const filePath = path.join(this.inputsPath, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(postData, null, 2));
    console.log(`Saved POST data to ${filePath}`);
  }

  /**
   * Load POST data from JSON file
   */
  loadPostData(fileName: string): REoptInput {
    const filePath = path.join(this.inputsPath, `${fileName}.json`);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Load API response from JSON file
   */
  loadApiResponse(fileName: string): REoptResponse {
    const filePath = path.join(this.outputsPath, `${fileName}.json`);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Save API response to JSON file
   */
  saveApiResponse(response: REoptResponse, fileName: string): void {
    const filePath = path.join(this.outputsPath, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2));
    console.log(`Saved API response to ${filePath}`);
  }

  /**
   * Print summary of results
   */
  printResultsSummary(apiResponse: REoptResponse): void {
    console.log('\n=== REopt Results Summary ===');
    console.log(`Status: ${apiResponse.status}`);
    console.log(`Run UUID: ${apiResponse.run_uuid}`);
    
    if (apiResponse.outputs?.Financial) {
      console.log(`NPV ($): ${apiResponse.outputs.Financial.npv}`);
      console.log(`Capital Cost, Net ($): ${apiResponse.outputs.Financial.lifecycle_capital_costs}`);
    }

    // Check for technology sizes
    const techList = ["PV", "Wind", "ElectricStorage", "CHP", "Generator", 
                     "HotThermalStorage", "ColdThermalStorage", "AbsorptionChiller", 
                     "GHP", "Boiler", "SteamTurbine"];
    
    for (const tech of techList) {
      if (apiResponse.outputs?.[tech]) {
        if (tech === "GHP" && apiResponse.outputs[tech].ghpghx_chosen_outputs) {
          console.log(`GHX Number of Boreholes: ${apiResponse.outputs[tech].ghpghx_chosen_outputs.number_of_boreholes}`);
          console.log(`GHP Heat Pump Capacity (ton): ${apiResponse.outputs[tech].ghpghx_chosen_outputs.peak_combined_heatpump_thermal_ton}`);
        }
        
        // Print any size-related outputs
        const techOutputs = apiResponse.outputs[tech];
        Object.keys(techOutputs).forEach(key => {
          if (key.includes('size')) {
            console.log(`${tech} ${key}: ${techOutputs[key]}`);
          }
        });
      }
    }

    // Print messages
    if (apiResponse.messages) {
      if (apiResponse.messages.info) {
        console.log(`\nInfo: ${apiResponse.messages.info}`);
      }
      if (Object.keys(apiResponse.messages.errors).length > 0) {
        console.log(`Errors:`, apiResponse.messages.errors);
      }
      if (Object.keys(apiResponse.messages.warnings).length > 0) {
        console.log(`Warnings:`, apiResponse.messages.warnings);
      }
    }

    // Print available output keys
    if (apiResponse.outputs) {
      console.log('\nAvailable output categories:');
      Object.keys(apiResponse.outputs).forEach(key => {
        console.log(`  ${key}`);
      });
    }
  }

  /**
   * Manual GET results with run_uuid (if polling was interrupted)
   */
  async getResultsManually(runUuid: string): Promise<REoptResponse> {
    const resultsUrl = `${this.baseUrl}/job/${runUuid}/results/?api_key=${this.apiKey}`;
    const response = await axios.get(resultsUrl);
    return response.data;
  }
}

// Example usage
async function runSingleScenarioExample() {
  console.log('=== REopt API Single Scenario Example (TypeScript) ===\n');
  
  // Initialize API client
  const client = new REoptApiClient('ZWDHHf8FBv9l0RM9eDbnETzYxQN9wbxet007ekBj'); // Replace with your API key
  
  try {
    // Create sample scenario
    const post1 = client.createSampleScenario();
    console.log('Created sample scenario input');
    
    // Optional: Load custom electric rate
    // const customRate = client.loadElectricRate('PGE_E20');
    // if (customRate) {
    //   post1.ElectricTariff.urdb_response = customRate;
    // }
    
    // Save POST data
    client.savePostData(post1, 'post_2');
    
    // Load POST data (demonstration)
    const loadedPost = client.loadPostData('post_2');
    console.log('Loaded POST data from file');
    
    // Submit job and poll for results
    console.log('\nSubmitting job to REopt API...');
    const apiResponse = await client.getApiResults(loadedPost, 'results_file');
    
    // Print results summary
    client.printResultsSummary(apiResponse);
    
    // Save API response
  client.saveApiResponse(apiResponse, 'response_2');
    
  } catch (error) {
    console.error('Error running REopt scenario:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runSingleScenarioExample();
}
