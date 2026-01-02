# Data Analysis Script with Ralph

This example demonstrates using Ralph Orchestrator to create a data analysis script with visualization and reporting.

## Task Description

Create a TypeScript data analysis script that:
- Loads and cleans CSV data
- Performs statistical analysis
- Creates visualizations
- Generates HTML report

## PROMPT.md File

```markdown
# Task: Build Sales Data Analysis Script

Create a TypeScript script to analyze sales data with the following requirements:

## Data Processing

1. Load sales data from CSV file
2. Clean and validate data:
   - Handle missing values
   - Convert data types
   - Remove duplicates
   - Validate date ranges

## Analysis Requirements

1. **Sales Metrics**
   - Total revenue by month
   - Average order value
   - Top 10 products by revenue
   - Sales growth rate

2. **Customer Analysis**
   - Customer segmentation (RFM analysis)
   - Customer lifetime value
   - Repeat purchase rate
   - Geographic distribution

3. **Product Analysis**
   - Best/worst performing products
   - Product category performance
   - Seasonal trends
   - Inventory turnover

## Visualizations

Create the following charts:
1. Monthly revenue trend (line chart)
2. Product category breakdown (pie chart)
3. Customer distribution map (geographic)
4. Sales heatmap by day/hour
5. Top products bar chart

## Output

Generate an HTML report with:
- Executive summary
- Key metrics dashboard
- Interactive charts (using Chart.js or similar)
- Data tables
- Insights and recommendations

## File Structure

```
sales-analysis/
├── src/
│   ├── analyze.ts          # Main analysis script
│   ├── data-loader.ts      # Data loading and cleaning
│   ├── analysis.ts         # Analysis functions
│   ├── visualizations.ts   # Chart generation
│   └── report-generator.ts # HTML report creation
├── templates/
│   └── report.html         # HTML template
├── data/
│   └── sales.csv           # Sample data
├── output/
│   └── report.html         # Generated report
├── package.json
└── tsconfig.json
```

## Sample Data Structure

CSV columns:
- order_id, customer_id, product_id, product_name, category
- quantity, unit_price, total_price, discount
- order_date, ship_date, region, payment_method

<!-- The orchestrator will continue iterations until limits are reached -->
```

## Running Ralph

```bash
bun run src/index.ts --prompt data-analysis-prompt.md --agent claude --max-iterations 35
```

## Expected Output

### src/analyze.ts (Main Script)

```typescript
#!/usr/bin/env bun
/**
 * Sales Data Analysis Script
 * Analyzes sales data and generates comprehensive HTML report
 */

import { DataLoader } from "./data-loader";
import { SalesAnalyzer, CustomerAnalyzer, ProductAnalyzer } from "./analysis";
import { ChartGenerator } from "./visualizations";
import { ReportGenerator } from "./report-generator";
import { loadConfig, Config } from "./config";

async function main(): Promise<string> {
  console.log("Starting sales data analysis...");

  // Load configuration
  const config = loadConfig();

  // Step 1: Load and clean data
  console.log("Loading data...");
  const loader = new DataLoader(config.data.inputFile);
  const data = await loader.loadAndClean();
  console.log(`Loaded ${data.length} records`);

  // Step 2: Perform analysis
  console.log("Performing analysis...");

  // Sales analysis
  const salesAnalyzer = new SalesAnalyzer(data);
  const salesMetrics = {
    totalRevenue: salesAnalyzer.calculateTotalRevenue(),
    monthlyRevenue: salesAnalyzer.getMonthlyRevenue(),
    avgOrderValue: salesAnalyzer.calculateAvgOrderValue(),
    growthRate: salesAnalyzer.calculateGrowthRate(),
    topProducts: salesAnalyzer.getTopProducts(10),
  };

  // Customer analysis
  const customerAnalyzer = new CustomerAnalyzer(data);
  const customerMetrics = {
    totalCustomers: customerAnalyzer.countUniqueCustomers(),
    repeatRate: customerAnalyzer.calculateRepeatRate(),
    rfmSegments: customerAnalyzer.performRFMAnalysis(),
    lifetimeValue: customerAnalyzer.calculateCLV(),
    geographicDist: customerAnalyzer.getGeographicDistribution(),
  };

  // Product analysis
  const productAnalyzer = new ProductAnalyzer(data);
  const productMetrics = {
    categoryPerformance: productAnalyzer.analyzeCategories(),
    seasonalTrends: productAnalyzer.findSeasonalTrends(),
    inventoryTurnover: productAnalyzer.calculateTurnover(),
    productRanking: productAnalyzer.rankProducts(),
  };

  // Step 3: Generate visualizations
  console.log("Creating visualizations...");
  const chartGen = new ChartGenerator(data);

  const charts = {
    revenueTrend: chartGen.createRevenueTrend(salesMetrics.monthlyRevenue),
    categoryPie: chartGen.createCategoryPie(productMetrics.categoryPerformance),
    customerMap: chartGen.createCustomerMap(customerMetrics.geographicDist),
    salesHeatmap: chartGen.createSalesHeatmap(),
    topProductsBar: chartGen.createTopProductsBar(salesMetrics.topProducts),
  };

  // Step 4: Generate report
  console.log("Generating HTML report...");
  const reportGen = new ReportGenerator();

  const reportData = {
    generatedAt: new Date().toISOString(),
    recordCount: data.length,
    dateRange: `${data[0].orderDate} to ${data[data.length - 1].orderDate}`,
    salesMetrics,
    customerMetrics,
    productMetrics,
    charts,
    insights: generateInsights(salesMetrics, customerMetrics, productMetrics),
  };

  const outputPath = config.output.reportPath;
  await reportGen.generate(reportData, outputPath);

  console.log(`Report generated: ${outputPath}`);
  console.log("Analysis complete!");

  return outputPath;
}

interface Metrics {
  salesMetrics: {
    growthRate: number;
  };
  customerMetrics: {
    repeatRate: number;
  };
  productMetrics: {
    categoryPerformance: Array<{ category: string; revenue: number }>;
  };
}

function generateInsights(
  sales: Metrics["salesMetrics"],
  customers: Metrics["customerMetrics"],
  products: Metrics["productMetrics"]
): string[] {
  const insights: string[] = [];

  // Revenue insights
  if (sales.growthRate > 0) {
    insights.push(`Revenue is growing at ${sales.growthRate.toFixed(1)}% monthly`);
  } else {
    insights.push(`Revenue declined by ${Math.abs(sales.growthRate).toFixed(1)}% monthly`);
  }

  // Customer insights
  const repeatRate = customers.repeatRate;
  if (repeatRate > 0.3) {
    insights.push(`Strong customer loyalty with ${(repeatRate * 100).toFixed(1)}% repeat rate`);
  } else {
    insights.push(`Opportunity to improve retention (current: ${(repeatRate * 100).toFixed(1)}%)`);
  }

  // Product insights
  const topCategory = products.categoryPerformance[0];
  insights.push(`${topCategory.category} is the top performing category`);

  return insights;
}

// Run
main()
  .then((reportPath) => {
    console.log(`\nAnalysis complete! Report saved to: ${reportPath}`);
  })
  .catch((error) => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });
```

### src/data-loader.ts

```typescript
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

export interface SalesRecord {
  orderId: string;
  customerId: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  orderDate: Date;
  shipDate: Date;
  region: string;
  paymentMethod: string;
}

export class DataLoader {
  constructor(private filepath: string) {}

  async loadAndClean(): Promise<SalesRecord[]> {
    // Load data
    const content = readFileSync(this.filepath, "utf-8");
    const rawRecords = parse(content, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Loaded ${rawRecords.length} raw records`);

    // Clean data
    let records = this.removeDuplicates(rawRecords);
    records = this.handleMissingValues(records);
    records = this.convertDataTypes(records);
    records = this.validateData(records);

    console.log(`Cleaned data: ${records.length} records`);
    return records;
  }

  private removeDuplicates(records: SalesRecord[]): SalesRecord[] {
    const seen = new Set<string>();
    const unique: SalesRecord[] = [];

    for (const record of records) {
      if (!seen.has(record.orderId)) {
        seen.add(record.orderId);
        unique.push(record);
      }
    }

    const removed = records.length - unique.length;
    if (removed > 0) {
      console.log(`Removed ${removed} duplicate records`);
    }

    return unique;
  }

  private handleMissingValues(records: SalesRecord[]): SalesRecord[] {
    return records.map((record) => ({
      ...record,
      quantity: record.quantity || 0,
      unitPrice: record.unitPrice || 0,
      totalPrice: record.totalPrice || 0,
      discount: record.discount || 0,
      productName: record.productName || "Unknown",
      category: record.category || "Unknown",
      region: record.region || "Unknown",
      paymentMethod: record.paymentMethod || "Unknown",
    }));
  }

  private convertDataTypes(records: SalesRecord[]): SalesRecord[] {
    return records.map((record) => ({
      ...record,
      orderId: String(record.orderId),
      customerId: String(record.customerId),
      productId: String(record.productId),
      quantity: Number(record.quantity),
      unitPrice: Number(record.unitPrice),
      totalPrice: Number(record.totalPrice),
      discount: Number(record.discount),
      orderDate: new Date(record.orderDate as unknown as string),
      shipDate: new Date(record.shipDate as unknown as string),
    }));
  }

  private validateData(records: SalesRecord[]): SalesRecord[] {
    return records.filter((record) => {
      // Remove rows with invalid dates
      if (isNaN(record.orderDate.getTime())) return false;

      // Remove rows with negative prices
      if (record.totalPrice < 0) return false;

      // Remove rows with invalid quantities
      if (record.quantity <= 0) return false;

      return true;
    });
  }

  generateSampleData(numRecords = 1000): SalesRecord[] {
    const categories = ["Electronics", "Clothing", "Books", "Home", "Sports"];
    const products: Record<string, string[]> = {
      Electronics: ["Laptop", "Phone", "Tablet", "Headphones"],
      Clothing: ["Shirt", "Pants", "Jacket", "Shoes"],
      Books: ["Fiction", "Non-fiction", "TextBook", "Magazine"],
      Home: ["Furniture", "Decor", "Kitchen", "Bedding"],
      Sports: ["Equipment", "Apparel", "Footwear", "Accessories"],
    };
    const regions = ["North", "South", "East", "West"];
    const paymentMethods = ["Credit Card", "PayPal", "Cash"];

    const records: SalesRecord[] = [];
    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-12-31");
    const dateRange = endDate.getTime() - startDate.getTime();

    for (let i = 0; i < numRecords; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const productName = products[category][Math.floor(Math.random() * products[category].length)];
      const quantity = Math.floor(Math.random() * 9) + 1;
      const unitPrice = Math.random() * 490 + 10;
      const discount = Math.random() * 0.3;
      const orderDate = new Date(startDate.getTime() + Math.random() * dateRange);
      const shipDate = new Date(orderDate.getTime() + Math.random() * 6 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);

      records.push({
        orderId: `ORD${i.toString().padStart(5, "0")}`,
        customerId: `CUST${Math.floor(Math.random() * 200).toString().padStart(4, "0")}`,
        productId: `PROD${Math.floor(Math.random() * 50).toString().padStart(3, "0")}`,
        productName,
        category,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice * (1 - discount),
        discount,
        orderDate,
        shipDate,
        region: regions[Math.floor(Math.random() * regions.length)],
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      });
    }

    return records;
  }
}
```

### src/visualizations.ts

```typescript
import type { SalesRecord } from "./data-loader";

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface CategoryPerformance {
  category: string;
  revenue: number;
}

interface GeographicDistribution {
  region: string;
  customerCount: number;
}

interface TopProduct {
  productName: string;
  revenue: number;
}

export class ChartGenerator {
  constructor(private data: SalesRecord[]) {}

  createRevenueTrend(monthlyRevenue: MonthlyRevenue[]): string {
    const labels = monthlyRevenue.map((m) => m.month);
    const values = monthlyRevenue.map((m) => m.revenue);

    return `
      <canvas id="revenueTrendChart"></canvas>
      <script>
        new Chart(document.getElementById('revenueTrendChart'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: 'Revenue',
              data: ${JSON.stringify(values)},
              borderColor: '#1f77b4',
              backgroundColor: 'rgba(31, 119, 180, 0.1)',
              borderWidth: 3,
              fill: true,
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Monthly Revenue Trend'
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + value.toLocaleString();
                  }
                }
              }
            }
          }
        });
      </script>
    `;
  }

  createCategoryPie(categoryData: CategoryPerformance[]): string {
    const labels = categoryData.map((c) => c.category);
    const values = categoryData.map((c) => c.revenue);

    return `
      <canvas id="categoryPieChart"></canvas>
      <script>
        new Chart(document.getElementById('categoryPieChart'), {
          type: 'pie',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              data: ${JSON.stringify(values)},
              backgroundColor: [
                '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff'
              ]
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Revenue by Category'
              }
            }
          }
        });
      </script>
    `;
  }

  createSalesHeatmap(): string {
    // Extract day and hour data
    const heatmapData: Record<string, Record<number, number>> = {};
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    for (const day of days) {
      heatmapData[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        heatmapData[day][hour] = 0;
      }
    }

    for (const record of this.data) {
      const date = record.orderDate;
      const dayIndex = date.getDay();
      const day = days[dayIndex === 0 ? 6 : dayIndex - 1];
      const hour = date.getHours();
      heatmapData[day][hour] += record.totalPrice;
    }

    // Convert to matrix format for chart
    const matrix: { x: number; y: number; v: number }[] = [];
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      for (let hour = 0; hour < 24; hour++) {
        matrix.push({
          x: hour,
          y: dayIdx,
          v: heatmapData[days[dayIdx]][hour],
        });
      }
    }

    return `
      <canvas id="salesHeatmap"></canvas>
      <script>
        new Chart(document.getElementById('salesHeatmap'), {
          type: 'matrix',
          data: {
            datasets: [{
              label: 'Sales',
              data: ${JSON.stringify(matrix)},
              backgroundColor(context) {
                const value = context.dataset.data[context.dataIndex].v;
                const max = Math.max(...context.dataset.data.map(d => d.v));
                const alpha = value / max;
                return 'rgba(31, 119, 180, ' + alpha + ')';
              },
              borderColor: 'white',
              borderWidth: 1,
              width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
              height: ({ chart }) => (chart.chartArea || {}).height / 7 - 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Sales Heatmap by Day and Hour'
              }
            },
            scales: {
              x: {
                type: 'linear',
                offset: true,
                min: 0,
                max: 23,
                title: { display: true, text: 'Hour of Day' }
              },
              y: {
                type: 'category',
                labels: ${JSON.stringify(days)},
                offset: true,
                title: { display: true, text: 'Day of Week' }
              }
            }
          }
        });
      </script>
    `;
  }

  createTopProductsBar(topProducts: TopProduct[]): string {
    const labels = topProducts.map((p) => p.productName);
    const values = topProducts.map((p) => p.revenue);

    return `
      <canvas id="topProductsChart"></canvas>
      <script>
        new Chart(document.getElementById('topProductsChart'), {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: 'Revenue',
              data: ${JSON.stringify(values)},
              backgroundColor: 'rgba(54, 162, 235, 0.8)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Top 10 Products by Revenue'
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                ticks: {
                  callback: function(value) {
                    return '$' + value.toLocaleString();
                  }
                }
              }
            }
          }
        });
      </script>
    `;
  }

  createCustomerMap(geographicData: GeographicDistribution[]): string {
    const labels = geographicData.map((g) => g.region);
    const values = geographicData.map((g) => g.customerCount);

    return `
      <canvas id="customerMapChart"></canvas>
      <script>
        new Chart(document.getElementById('customerMapChart'), {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: 'Customers',
              data: ${JSON.stringify(values)},
              backgroundColor: [
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Customer Distribution by Region'
              }
            }
          }
        });
      </script>
    `;
  }
}
```

## Report Template

### templates/report.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sales Analysis Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .chart-container {
            margin: 30px 0;
        }
        .insights {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 10px;
            margin: 30px 0;
        }
        .insight-item {
            margin: 10px 0;
            padding-left: 20px;
            position: relative;
        }
        .insight-item:before {
            content: "->";
            position: absolute;
            left: 0;
            color: #4CAF50;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sales Analysis Report</h1>

        <div class="report-meta">
            <p><strong>Generated:</strong> {{generatedAt}}</p>
            <p><strong>Data Range:</strong> {{dateRange}}</p>
            <p><strong>Total Records:</strong> {{recordCount}}</p>
        </div>

        <h2>Key Metrics</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value">${{totalRevenue}}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Order Value</div>
                <div class="metric-value">${{avgOrderValue}}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Total Customers</div>
                <div class="metric-value">{{totalCustomers}}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Repeat Rate</div>
                <div class="metric-value">{{repeatRate}}%</div>
            </div>
        </div>

        <h2>Insights</h2>
        <div class="insights">
            {{#each insights}}
            <div class="insight-item">{{this}}</div>
            {{/each}}
        </div>

        <h2>Revenue Trend</h2>
        <div class="chart-container">
            {{{revenueTrendChart}}}
        </div>

        <h2>Category Performance</h2>
        <div class="chart-container">
            {{{categoryPieChart}}}
        </div>

        <h2>Top Products</h2>
        <div class="chart-container">
            {{{topProductsChart}}}
        </div>

        <h2>Sales Patterns</h2>
        <div class="chart-container">
            {{{salesHeatmap}}}
        </div>
    </div>
</body>
</html>
```

## Tips for Data Analysis Tasks

1. **Specify Data Structure**: Clearly define input data format
2. **List Required Analyses**: Be specific about calculations needed
3. **Request Visualizations**: Specify chart types and libraries
4. **Output Format**: Define report structure and format
5. **Error Handling**: Request validation and error handling

## Cost Estimation

- **Iterations**: ~25-35 for complete implementation
- **Time**: ~12-18 minutes
- **Agent**: Claude recommended for complex analysis
- **API Calls**: ~$0.25-0.35
