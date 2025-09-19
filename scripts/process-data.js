const fs = require('fs').promises;
const path = require('path');

async function processData() {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'price-logs.json');
    const outputPath = path.join(__dirname, '..', 'docs', 'price-data.json');

    // Read the raw price logs
    const rawData = await fs.readFile(dataPath, 'utf8');
    const priceData = JSON.parse(rawData);

    console.log(`Processing ${priceData.length} price entries...`);

    // Process data for visualization
    const processedData = {
      lastUpdated: new Date().toISOString(),
      regions: {},
      summary: {
        totalEntries: priceData.length,
        dateRange: {
          start: priceData.length > 0 ? priceData[0].timestamp : null,
          end: priceData.length > 0 ? priceData[priceData.length - 1].timestamp : null
        }
      }
    };

    // Group data by region
    priceData.forEach(entry => {
      Object.keys(entry.regions || {}).forEach(regionName => {
        if (!processedData.regions[regionName]) {
          processedData.regions[regionName] = {
            name: regionName,
            displayName: entry.regions[regionName].location,
            data: []
          };
        }

        processedData.regions[regionName].data.push({
          timestamp: entry.timestamp,
          retailPrice: entry.regions[regionName].retailPrice,
          unitPrice: entry.regions[regionName].unitPrice,
          currencyCode: entry.regions[regionName].currencyCode
        });
      });
    });

    // Calculate statistics for each region
    Object.keys(processedData.regions).forEach(regionName => {
      const regionData = processedData.regions[regionName].data;
      const prices = regionData.map(d => d.retailPrice);

      processedData.regions[regionName].stats = {
        count: prices.length,
        current: prices.length > 0 ? prices[prices.length - 1] : null,
        min: prices.length > 0 ? Math.min(...prices) : null,
        max: prices.length > 0 ? Math.max(...prices) : null,
        avg: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null
      };
    });

    // Ensure docs directory exists
    await fs.mkdir(path.join(__dirname, '..', 'docs'), { recursive: true });

    // Write processed data
    await fs.writeFile(outputPath, JSON.stringify(processedData, null, 2));

    console.log(`✅ Processed data written to ${outputPath}`);
    console.log(`Regions processed: ${Object.keys(processedData.regions).join(', ')}`);

  } catch (error) {
    console.error('Error processing data:', error.message);
    process.exit(1);
  }
}

processData();
