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
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
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
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveData(newData) {
    await this.ensureDataDirectory();

    const existingData = await this.loadExistingData();
    existingData.push(newData);

    // Keep only last 1440 entries (24 hours if running every minute)
    const maxEntries = 1440;
    if (existingData.length > maxEntries) {
      existingData.splice(0, existingData.length - maxEntries);
    }

    await fs.writeFile(this.logFile, JSON.stringify(existingData, null, 2));
    console.log(`Data saved. Total entries: ${existingData.length}`);
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

    await this.saveData(results);

    // Push to GitHub if configured
    await this.pushToGitHub(results);

    console.log('=== Price Check Complete ===\n');
  }

  async pushToGitHub(data) {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    const githubOwner = process.env.GITHUB_OWNER;

    if (!githubToken || !githubRepo || !githubOwner) {
      console.log('GitHub credentials not configured. Skipping GitHub push.');
      return;
    }

    try {
      // This would push the data to a GitHub repository
      // Implementation depends on your specific GitHub setup
      console.log('Pushing data to GitHub repository...');

      // For now, just log the data that would be pushed
      console.log('Data to push:', JSON.stringify(data, null, 2));

    } catch (error) {
      console.error('Error pushing to GitHub:', error.message);
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