# Azure Spot Node Price Checker

A real-time monitoring system for Azure spot instance pricing, specifically tracking Standard_D16s_v5 instances across multiple regions.

## Features

- 🕐 **Real-time Monitoring**: Fetches pricing data every minute from Azure Pricing API
- 📊 **Interactive Dashboard**: Beautiful web interface with charts and statistics
- 🌍 **Multi-Region Support**: Monitors East US 2 and North Europe regions
- 📈 **Historical Data**: Tracks price changes over time
- 🆓 **Free Hosting**: Uses GitHub Pages for visualization
- ⚡ **Serverless**: Runs as scheduled task in Choreo

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Choreo        │    │   GitHub        │    │  GitHub Pages   │
│  (Scheduled     │───▶│  (Data Storage) │───▶│ (Visualization) │
│   Task)         │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────┐
│  Azure Pricing  │
│      API        │
└─────────────────┘
```

## Setup Instructions

### 1. Choreo Deployment

1. **Create Choreo Account**: Sign up at [Choreo](https://choreo.dev)

2. **Create New Component**:
   - Type: "Schedule"
   - Name: "azure-spot-price-checker"
   - GitHub Repository: This repository
   - Schedule: "*/1 * * * *" (every minute)

3. **Configure Environment Variables** in Choreo:
   ```
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_REPO=azure-spotnode-price-checker
   GITHUB_OWNER=your_github_username
   ```

### 2. GitHub Setup

1. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: "gh-pages"
   - Folder: "/ (root)"

2. **Create Personal Access Token**:
   - GitHub Settings → Developer settings → Personal access tokens
   - Scopes: `repo`, `workflow`
   - Copy token for Choreo environment variable

3. **Enable GitHub Actions**:
   - Go to repository Actions tab
   - Allow actions to run

### 3. Local Development

```bash
# Install dependencies
npm install

# Run locally
npm start

# Development with auto-reload
npm run dev
```

## Data Collection

The service collects the following data points:
- **retailPrice**: Current spot price per hour
- **unitPrice**: Unit pricing information
- **timestamp**: When the data was collected
- **region**: Azure region (eastus2, northeurope)
- **location**: Human-readable location name
- **currencyCode**: Currency (USD)

## API Endpoints

The system queries these Azure Pricing API endpoints:

**East US 2:**
```
https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&$filter=serviceName eq 'Virtual Machines' and productName eq 'Virtual Machines Dsv5 Series' and armRegionName eq 'eastus2' and armSkuName eq 'Standard_D16s_v5' and contains(skuName,'Spot')
```

**North Europe:**
```
https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&$filter=serviceName eq 'Virtual Machines' and productName eq 'Virtual Machines Dsv5 Series' and armRegionName eq 'northeurope' and armSkuName eq 'Standard_D16s_v5' and contains(skuName,'Spot')
```

## Visualization Features

The dashboard provides:
- **Real-time price cards** with current, min, max, and average prices
- **Interactive line charts** showing price trends over time
- **Region filtering** to show/hide specific regions
- **Auto-refresh** every 5 minutes
- **Responsive design** for mobile and desktop

## File Structure

```
azure-spotnode-price-checker/
├── src/
│   └── index.js              # Main price fetching logic
├── scripts/
│   └── process-data.js       # Data processing for visualization
├── docs/
│   ├── index.html           # Dashboard web interface
│   └── price-data.json      # Processed data for charts
├── data/
│   └── price-logs.json      # Raw price data storage
├── .github/workflows/
│   └── update-data.yml      # GitHub Actions for data processing
├── .choreo/
│   └── component.yaml       # Choreo configuration reference
├── Dockerfile               # Container configuration
├── package.json             # Node.js dependencies
└── README.md               # This file
```

## Monitoring and Maintenance

- **Data Retention**: Keeps last 24 hours of data (1440 entries)
- **Error Handling**: Graceful handling of API failures
- **Rate Limiting**: 1-second delay between region requests
- **Auto-cleanup**: Old data automatically removed

## Cost Analysis

This solution is **completely free**:
- ✅ **Choreo**: Free tier includes scheduled tasks
- ✅ **GitHub**: Free repository and Pages hosting
- ✅ **GitHub Actions**: Free tier for public repositories
- ✅ **Azure Pricing API**: Free to query

## Troubleshooting

**Common Issues:**

1. **No data showing**: Check Choreo logs and GitHub Actions
2. **Dashboard not updating**: Verify GitHub Pages is enabled
3. **API rate limits**: Increase delay between requests in `src/index.js`
4. **GitHub token issues**: Ensure token has correct permissions

**Logs:**
- Choreo: Check execution logs in Choreo console
- GitHub Actions: Check workflow runs in Actions tab
- Browser: Open developer console for client-side errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details
