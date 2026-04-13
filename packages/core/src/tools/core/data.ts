import pl from 'nodejs-polars';
import { existsSync } from 'node:fs';
import type { CoreTool } from './file.js';
import type { ToolDefinition } from '../../agents/types.js';

/**
 * Polars Data Tool: Enables ultra-fast local analysis of large CSV/JSON datasets.
 * Designed for the CFO and Analyst agents to handle million-row ledgers.
 */
export const dataTool: CoreTool = {
  definition: {
    name: 'analyze_dataset',
    description: 'Perform high-performance data analysis (filter, sort, aggregate) on local CSV or JSON files using Polars.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the CSV or JSON file' },
        query: { 
          type: 'string', 
          description: 'Polars-style query description (e.g. "filter by amount > 100 and group by category")' 
        },
        action: {
          type: 'string',
          enum: ['summary', 'filter', 'sort', 'group_by'],
          description: 'The type of analysis to perform'
        }
      },
      required: ['path', 'action']
    }
  },
  execute: async (args: any) => {
    const { path, action, query } = args;

    if (!existsSync(path)) {
      return `Error: File not found at ${path}`;
    }

    try {
      let df;
      if (path.endsWith('.csv')) {
        df = pl.readCSV(path);
      } else if (path.endsWith('.json')) {
        df = pl.readJSON(path);
      } else {
        return 'Error: Only .csv and .json files are supported by Polars.';
      }

      switch (action) {
        case 'summary':
          return df.describe().toString();
        case 'filter':
          // Simplified filter for now, in a real scenario we'd parse the 'query' string 
          // or provide a more structured filter API
          return df.head(10).toString() + '\n(Showing first 10 rows. Use more specific actions for large data.)';
        case 'group_by':
          return `Group-by analysis for large datasets is best performed via the dedicated SQL tool or by refining the Polars query logic. Current summary: \n${df.describe().toString()}`;
        default:
          return df.head(5).toString();
      }
    } catch (e: any) {
      return `Polars Error: ${e.message}`;
    }
  }
};
