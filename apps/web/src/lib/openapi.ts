export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Alter Ego — Transactions API",
    version: "1.0.0",
    description:
      "REST API for managing transactions in Alter Ego. Authenticate with an API key generated in Settings → API Keys.",
  },
  servers: [
    { url: "/", description: "Current environment" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description: "API key from Settings → API Keys. Pass as `Authorization: Bearer <key>`.",
      },
    },
    schemas: {
      Transaction: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          accountId: { type: "string" },
          type: { type: "string", enum: ["income", "expense", "transfer"] },
          amount: { type: "number", minimum: 0 },
          currency: {
            type: "string",
            enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "MXN", "BRL", "ARS"],
          },
          categoryId: { type: "string", nullable: true },
          description: { type: "string" },
          rawDescription: { type: "string", nullable: true },
          date: { type: "string", format: "date-time" },
          notes: { type: "string", nullable: true },
          tagIds: { type: "array", items: { type: "string" } },
          transferToAccountId: { type: "string", nullable: true },
          linkedTransactionId: { type: "string", nullable: true },
          isRecurring: { type: "boolean" },
          splits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                categoryId: { type: "string" },
                amount: { type: "number" },
                note: { type: "string", nullable: true },
              },
            },
          },
          importHash: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CreateTransaction: {
        type: "object",
        required: ["accountId", "type", "amount", "currency", "description", "date"],
        properties: {
          accountId: { type: "string", description: "ID of the account" },
          type: { type: "string", enum: ["income", "expense", "transfer"] },
          amount: { type: "number", minimum: 0, description: "Positive amount" },
          currency: {
            type: "string",
            enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "MXN", "BRL", "ARS"],
          },
          categoryId: { type: "string", nullable: true },
          description: { type: "string", maxLength: 500 },
          date: { type: "string", format: "date-time", description: "ISO 8601 date string" },
          notes: { type: "string", maxLength: 1000 },
          tagIds: { type: "array", items: { type: "string" } },
          transferToAccountId: { type: "string", description: "Required for transfers" },
          splits: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "categoryId", "amount"],
              properties: {
                id: { type: "string" },
                categoryId: { type: "string" },
                amount: { type: "number", minimum: 0 },
                note: { type: "string", nullable: true },
              },
            },
          },
          importHash: { type: "string", nullable: true, description: "Deduplication hash for imports" },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
            },
            required: ["code", "message"],
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/transactions": {
      get: {
        summary: "List transactions",
        description: "Returns paginated transactions with optional filters.",
        tags: ["Transactions"],
        parameters: [
          { name: "accountId", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["income", "expense", "transfer"] } },
          { name: "categoryId", in: "query", schema: { type: "string" } },
          { name: "dateFrom", in: "query", schema: { type: "string", format: "date-time" }, description: "ISO 8601" },
          { name: "dateTo", in: "query", schema: { type: "string", format: "date-time" }, description: "ISO 8601" },
          { name: "minAmount", in: "query", schema: { type: "number" } },
          { name: "maxAmount", in: "query", schema: { type: "number" } },
          { name: "search", in: "query", schema: { type: "string" }, description: "Searches description, rawDescription, notes" },
          { name: "uncategorized", in: "query", schema: { type: "boolean" } },
          { name: "hasNote", in: "query", schema: { type: "boolean" } },
          { name: "tagIds", in: "query", schema: { type: "string" }, description: "Comma-separated tag IDs" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Paginated list of transactions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Transaction" } },
                    total: { type: "integer", description: "Total count before pagination" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid query parameters", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Invalid or missing API key", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      post: {
        summary: "Create a transaction",
        tags: ["Transactions"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateTransaction" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created transaction",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Transaction" } } },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "409": { description: "Account is closed", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "422": { description: "Account does not exist", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/v1/transactions/{id}": {
      get: {
        summary: "Get a transaction by ID",
        tags: ["Transactions"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Transaction details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Transaction" } } },
          },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/v1/transactions/bulk": {
      post: {
        summary: "Bulk create transactions",
        description: "Create up to 100 transactions in a single request. A closed account in any row refuses the whole request and nothing is written; other row failures are reported per-item.",
        tags: ["Transactions"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["transactions"],
                properties: {
                  transactions: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CreateTransaction" },
                    minItems: 1,
                    maxItems: 100,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Bulk creation result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    created: { type: "array", items: { $ref: "#/components/schemas/Transaction" } },
                    errors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "integer" },
                          message: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "409": { description: "Account is closed", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          "422": { description: "Account does not exist", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
}
