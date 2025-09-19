const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const AZURE_PRICING_API = 'https://prices.azure.com/api/retail/prices';
const API_VERSION = '2023-01-01-preview';

const REGIONS = [
  {
    name: 'eastus2',
    displayName: 'East US 2'
  },
  {
    name: 'northeurope',
    displayName: 'North Europe'
  }
];

const VM_CONFIG = {
  serviceName: 'Virtual Machines',
  productName: 'Virtual Machines Dsv5 Series',
  armSkuName: 'Standard_D16s_v5'
};

class AzureSpotPriceChecker {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.logFile = path.join(this.dataDir, 'price-logs.json');
  }

  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
      console.log(`📁 Data directory exists: ${this.dataDir}`);
    } catch (error) {
      console.log(`📁 Creating data directory: ${this.dataDir}`);
      try {
        await fs.mkdir(this.dataDir, { recursive: true });
        console.log(`✅ Data directory created successfully`);
      } catch (mkdirError) {
        if (mkdirError.code === 'EROFS') {
          console.log(`📱 Read-only filesystem, skipping directory creation`);
          // Don't throw error for read-only filesystem
          return;
        }
        console.error(`❌ Failed to create data directory:`, mkdirError.message);
        throw mkdirError;
      }
    }
  }

  buildApiUrl(region) {
    const baseUrl = `${AZURE_PRICING_API}?api-version=${API_VERSION}`;
    const filter = `serviceName eq '${VM_CONFIG.serviceName}' and productName eq '${VM_CONFIG.productName}' and armRegionName eq '${region}' and armSkuName eq '${VM_CONFIG.armSkuName}' and contains(skuName,'Spot')`;
    return `${baseUrl}&$filter=${encodeURIComponent(filter)}`;
  }

  async fetchPriceData(region) {
    try {
      const url = this.buildApiUrl(region);
      console.log(`Fetching price data for ${region}...`);

      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Azure-Spot-Price-Checker/1.0'
        }
      });

      if (response.data && response.data.Items && response.data.Items.length > 0) {
        const item = response.data.Items[0];
        return {
          region: region,
          timestamp: new Date().toISOString(),
          retailPrice: item.retailPrice,
          unitPrice: item.unitPrice,
          currencyCode: item.currencyCode,
          location: item.location,
          effectiveStartDate: item.effectiveStartDate,
          meterName: item.meterName,
          skuName: item.skuName
        };
      } else {
        console.warn(`No pricing data found for region: ${region}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching price data for ${region}:`, error.message);
      return null;
    }
  }

  async loadExistingData() {
    // Try to fetch existing data from GitHub first
    const githubData = await this.fetchDataFromGitHub();
    if (githubData.length > 0) {
      console.log(`✅ Loaded ${githubData.length} existing entries from GitHub`);
      return githubData;
    }

    // Fallback to local file (for development/testing)
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      const localData = JSON.parse(data);
      console.log(`📁 Loaded ${localData.length} entries from local file`);
      return localData;
    } catch {
      console.log(`🆕 No existing data found, starting fresh`);
      return [];
    }
  }

  async fetchDataFromGitHub() {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    const githubOwner = process.env.GITHUB_OWNER;

    if (!githubToken || !githubRepo || !githubOwner) {
      console.log('GitHub credentials not configured, skipping GitHub data fetch');
      return [];
    }

    try {
      console.log('Fetching existing data from GitHub...');

      const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/data/price-logs.json`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Azure-Spot-Price-Checker/1.0'
        },
        timeout: 10000
      });

      if (response.data && response.data.content) {
        // GitHub returns base64 encoded content
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return JSON.parse(content);
      }

      return [];
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('No existing data file found in GitHub (first run)');
      } else {
        console.error('Error fetching data from GitHub:', error.message);
      }
      return [];
    }
  }

  async saveData(newData) {
    // Try to save locally if filesystem is writable (development mode)
    try {
      await this.ensureDataDirectory();
      await fs.writeFile(this.logFile, JSON.stringify([newData], null, 2));
      console.log(`📁 Data saved locally for current run`);
    } catch (error) {
      if (error.code === 'EROFS') {
        console.log(`📱 Read-only filesystem detected, skipping local save (using GitHub only)`);
      } else {
        console.warn(`⚠️ Could not save locally: ${error.message}`);
      }
    }
  }

  async run() {
    console.log('=== Azure Spot Price Checker Started ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);

    const results = {
      timestamp: new Date().toISOString(),
      regions: {}
    };

    for (const region of REGIONS) {
      const priceData = await this.fetchPriceData(region.name);
      if (priceData) {
        results.regions[region.name] = priceData;
        console.log(`✅ ${region.displayName}: $${priceData.retailPrice}/hour`);
      } else {
        console.log(`❌ ${region.displayName}: Failed to fetch data`);
      }

      // Small delay between requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Load existing data, add new data, save locally, and push to GitHub
    const existingData = await this.loadExistingData();
    existingData.push(results);

    await this.saveData(results); // Save locally for this run

    // Push complete dataset to GitHub for persistence
    await this.pushToGitHub(existingData);

    console.log('=== Price Check Complete ===\n');
  }

  async pushToGitHub(allData) {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    const githubOwner = process.env.GITHUB_OWNER;

    if (!githubToken || !githubRepo || !githubOwner) {
      console.log('GitHub credentials not configured. Skipping GitHub push.');
      return;
    }

    try {
      console.log('Pushing updated data to GitHub repository...');

      const filePath = 'data/price-logs.json';
      const url = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/${filePath}`;

      // First, try to get the current file to get its SHA (required for updates)
      let sha = null;
      try {
        const existingFileResponse = await axios.get(url, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Azure-Spot-Price-Checker/1.0'
          },
          timeout: 10000
        });
        sha = existingFileResponse.data.sha;
        console.log('Found existing file, will update it');
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log('No existing file found, will create new one');
        } else {
          throw error;
        }
      }

      // Prepare the content
      const content = JSON.stringify(allData, null, 2);
      const encodedContent = Buffer.from(content).toString('base64');

      // Create or update the file
      const requestBody = {
        message: `Update price data: ${new Date().toISOString()}`,
        content: encodedContent,
        branch: 'main'
      };

      if (sha) {
        requestBody.sha = sha; // Required for updates
      }

      const response = await axios.put(url, requestBody, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Azure-Spot-Price-Checker/1.0'
        },
        timeout: 15000
      });

      console.log(`✅ Successfully pushed ${allData.length} entries to GitHub`);
      console.log(`📝 Commit: ${response.data.commit.html_url}`);

    } catch (error) {
      console.error('❌ Error pushing to GitHub:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  }
}

// Main execution
async function main() {
  const checker = new AzureSpotPriceChecker();
  await checker.run();

  // For scheduled tasks, exit after one run
  process.exit(0);
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();