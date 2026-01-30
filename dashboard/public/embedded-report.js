// Auto-generated embedded report data - DO NOT EDIT
// Generated at: 2026-01-29T07:47:13.694Z
// This file is used to bypass CORS restrictions when opening dashboard via file:// protocol
window.__TESTBOT_EMBEDDED_REPORT__ = {
  "metadata": {
    "timestamp": "2026-01-29T07:47:13.691Z",
    "projectName": "Micro loans",
    "projectPath": "/Users/krishsharma/Desktop/Micro loans",
    "version": "1.0.0",
    "generator": "testbot-mcp"
  },
  "stats": {
    "total": 63,
    "passed": 53,
    "failed": 10,
    "skipped": 0,
    "duration": 3924,
    "passRate": 84
  },
  "tests": [
    {
      "id": "generated/api_get_api_customers_msisdn.spec.js->-API:-GET-/api/customers/:msisdn-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_customers_msisdn.spec.js > API: GET /api/customers/:msisdn",
      "file": "generated/api_get_api_customers_msisdn.spec.js",
      "status": "passed",
      "duration": 14,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_customers_msisdn.spec.js->-API:-GET-/api/customers/:msisdn-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_customers_msisdn.spec.js > API: GET /api/customers/:msisdn",
      "file": "generated/api_get_api_customers_msisdn.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_customers_msisdn.spec.js->-API:-GET-/api/customers/:msisdn-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_customers_msisdn.spec.js > API: GET /api/customers/:msisdn",
      "file": "generated/api_get_api_customers_msisdn.spec.js",
      "status": "failed",
      "duration": 15,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_customers_msisdn.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_customers_msisdn.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_customers.spec.js->-API:-GET-/api/customers-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_customers.spec.js > API: GET /api/customers",
      "file": "generated/api_get_api_customers.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_customers.spec.js->-API:-GET-/api/customers-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_customers.spec.js > API: GET /api/customers",
      "file": "generated/api_get_api_customers.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_customers.spec.js->-API:-GET-/api/customers-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_customers.spec.js > API: GET /api/customers",
      "file": "generated/api_get_api_customers.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_decisions_decisionId.spec.js->-API:-GET-/api/decisions/:decisionId-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_decisions_decisionId.spec.js > API: GET /api/decisions/:decisionId",
      "file": "generated/api_get_api_decisions_decisionId.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_decisions_decisionId.spec.js->-API:-GET-/api/decisions/:decisionId-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_decisions_decisionId.spec.js > API: GET /api/decisions/:decisionId",
      "file": "generated/api_get_api_decisions_decisionId.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_decisions_decisionId.spec.js->-API:-GET-/api/decisions/:decisionId-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_decisions_decisionId.spec.js > API: GET /api/decisions/:decisionId",
      "file": "generated/api_get_api_decisions_decisionId.spec.js",
      "status": "failed",
      "duration": 15,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_decisions_decisionId.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_decisions_decisionId.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_health.spec.js->-API:-GET-/api/health-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_health.spec.js > API: GET /api/health",
      "file": "generated/api_get_api_health.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_health.spec.js->-API:-GET-/api/health-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_health.spec.js > API: GET /api/health",
      "file": "generated/api_get_api_health.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_health.spec.js->-API:-GET-/api/health-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_health.spec.js > API: GET /api/health",
      "file": "generated/api_get_api_health.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_kpis.spec.js->-API:-GET-/api/kpis-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_kpis.spec.js > API: GET /api/kpis",
      "file": "generated/api_get_api_kpis.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_kpis.spec.js->-API:-GET-/api/kpis-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_kpis.spec.js > API: GET /api/kpis",
      "file": "generated/api_get_api_kpis.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_kpis.spec.js->-API:-GET-/api/kpis-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_kpis.spec.js > API: GET /api/kpis",
      "file": "generated/api_get_api_kpis.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_ledger.spec.js->-API:-GET-/api/ledger-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_ledger.spec.js > API: GET /api/ledger",
      "file": "generated/api_get_api_ledger.spec.js",
      "status": "passed",
      "duration": 2,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_ledger.spec.js->-API:-GET-/api/ledger-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_ledger.spec.js > API: GET /api/ledger",
      "file": "generated/api_get_api_ledger.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_ledger.spec.js->-API:-GET-/api/ledger-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_ledger.spec.js > API: GET /api/ledger",
      "file": "generated/api_get_api_ledger.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_loans.spec.js->-API:-GET-/api/loans-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_loans.spec.js > API: GET /api/loans",
      "file": "generated/api_get_api_loans.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_loans.spec.js->-API:-GET-/api/loans-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_loans.spec.js > API: GET /api/loans",
      "file": "generated/api_get_api_loans.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_loans.spec.js->-API:-GET-/api/loans-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_loans.spec.js > API: GET /api/loans",
      "file": "generated/api_get_api_loans.spec.js",
      "status": "passed",
      "duration": 2,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers_offerId_explain.spec.js->-API:-GET-/api/offers/:offerId/explain-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_offers_offerId_explain.spec.js > API: GET /api/offers/:offerId/explain",
      "file": "generated/api_get_api_offers_offerId_explain.spec.js",
      "status": "passed",
      "duration": 2,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers_offerId_explain.spec.js->-API:-GET-/api/offers/:offerId/explain-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_offers_offerId_explain.spec.js > API: GET /api/offers/:offerId/explain",
      "file": "generated/api_get_api_offers_offerId_explain.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers_offerId_explain.spec.js->-API:-GET-/api/offers/:offerId/explain-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_offers_offerId_explain.spec.js > API: GET /api/offers/:offerId/explain",
      "file": "generated/api_get_api_offers_offerId_explain.spec.js",
      "status": "failed",
      "duration": 15,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_offers_offerId_explain.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_offers_offerId_explain.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers_token.spec.js->-API:-GET-/api/offers/:token-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_offers_token.spec.js > API: GET /api/offers/:token",
      "file": "generated/api_get_api_offers_token.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers_token.spec.js->-API:-GET-/api/offers/:token-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_offers_token.spec.js > API: GET /api/offers/:token",
      "file": "generated/api_get_api_offers_token.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers_token.spec.js->-API:-GET-/api/offers/:token-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_offers_token.spec.js > API: GET /api/offers/:token",
      "file": "generated/api_get_api_offers_token.spec.js",
      "status": "failed",
      "duration": 16,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_offers_token.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_offers_token.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers.spec.js->-API:-GET-/api/offers-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_offers.spec.js > API: GET /api/offers",
      "file": "generated/api_get_api_offers.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers.spec.js->-API:-GET-/api/offers-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_offers.spec.js > API: GET /api/offers",
      "file": "generated/api_get_api_offers.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_offers.spec.js->-API:-GET-/api/offers-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_offers.spec.js > API: GET /api/offers",
      "file": "generated/api_get_api_offers.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_personas.spec.js->-API:-GET-/api/personas-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_personas.spec.js > API: GET /api/personas",
      "file": "generated/api_get_api_personas.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_personas.spec.js->-API:-GET-/api/personas-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_personas.spec.js > API: GET /api/personas",
      "file": "generated/api_get_api_personas.spec.js",
      "status": "passed",
      "duration": 5,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_personas.spec.js->-API:-GET-/api/personas-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_personas.spec.js > API: GET /api/personas",
      "file": "generated/api_get_api_personas.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_sms.spec.js->-API:-GET-/api/sms-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_sms.spec.js > API: GET /api/sms",
      "file": "generated/api_get_api_sms.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_sms.spec.js->-API:-GET-/api/sms-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_sms.spec.js > API: GET /api/sms",
      "file": "generated/api_get_api_sms.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_sms.spec.js->-API:-GET-/api/sms-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_sms.spec.js > API: GET /api/sms",
      "file": "generated/api_get_api_sms.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_users_msisdn.spec.js->-API:-GET-/api/users/:msisdn-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_get_api_users_msisdn.spec.js > API: GET /api/users/:msisdn",
      "file": "generated/api_get_api_users_msisdn.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_users_msisdn.spec.js->-API:-GET-/api/users/:msisdn-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_get_api_users_msisdn.spec.js > API: GET /api/users/:msisdn",
      "file": "generated/api_get_api_users_msisdn.spec.js",
      "status": "passed",
      "duration": 2,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_get_api_users_msisdn.spec.js->-API:-GET-/api/users/:msisdn-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_get_api_users_msisdn.spec.js > API: GET /api/users/:msisdn",
      "file": "generated/api_get_api_users_msisdn.spec.js",
      "status": "failed",
      "duration": 16,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_users_msisdn.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_get_api_users_msisdn.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_calls_end.spec.js->-API:-POST-/api/calls/end-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_post_api_calls_end.spec.js > API: POST /api/calls/end",
      "file": "generated/api_post_api_calls_end.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_calls_end.spec.js->-API:-POST-/api/calls/end-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_post_api_calls_end.spec.js > API: POST /api/calls/end",
      "file": "generated/api_post_api_calls_end.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_calls_end.spec.js->-API:-POST-/api/calls/end-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_post_api_calls_end.spec.js > API: POST /api/calls/end",
      "file": "generated/api_post_api_calls_end.spec.js",
      "status": "failed",
      "duration": 16,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_calls_end.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_calls_end.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_calls_start.spec.js->-API:-POST-/api/calls/start-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_post_api_calls_start.spec.js > API: POST /api/calls/start",
      "file": "generated/api_post_api_calls_start.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_calls_start.spec.js->-API:-POST-/api/calls/start-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_post_api_calls_start.spec.js > API: POST /api/calls/start",
      "file": "generated/api_post_api_calls_start.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_calls_start.spec.js->-API:-POST-/api/calls/start-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_post_api_calls_start.spec.js > API: POST /api/calls/start",
      "file": "generated/api_post_api_calls_start.spec.js",
      "status": "failed",
      "duration": 15,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_calls_start.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_calls_start.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_consent.spec.js->-API:-POST-/api/consent-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_post_api_consent.spec.js > API: POST /api/consent",
      "file": "generated/api_post_api_consent.spec.js",
      "status": "passed",
      "duration": 14,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_consent.spec.js->-API:-POST-/api/consent-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_post_api_consent.spec.js > API: POST /api/consent",
      "file": "generated/api_post_api_consent.spec.js",
      "status": "passed",
      "duration": 3,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_consent.spec.js->-API:-POST-/api/consent-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_post_api_consent.spec.js > API: POST /api/consent",
      "file": "generated/api_post_api_consent.spec.js",
      "status": "failed",
      "duration": 16,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_consent.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_consent.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_personas_name_init.spec.js->-API:-POST-/api/personas/:name/init-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_post_api_personas_name_init.spec.js > API: POST /api/personas/:name/init",
      "file": "generated/api_post_api_personas_name_init.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_personas_name_init.spec.js->-API:-POST-/api/personas/:name/init-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_post_api_personas_name_init.spec.js > API: POST /api/personas/:name/init",
      "file": "generated/api_post_api_personas_name_init.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_personas_name_init.spec.js->-API:-POST-/api/personas/:name/init-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_post_api_personas_name_init.spec.js > API: POST /api/personas/:name/init",
      "file": "generated/api_post_api_personas_name_init.spec.js",
      "status": "failed",
      "duration": 15,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m404\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_personas_name_init.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_personas_name_init.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_topup.spec.js->-API:-POST-/api/topup-should-respond-with-success-status",
      "title": "should respond with success status",
      "suite": "generated/api_post_api_topup.spec.js > API: POST /api/topup",
      "file": "generated/api_post_api_topup.spec.js",
      "status": "passed",
      "duration": 15,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_topup.spec.js->-API:-POST-/api/topup-should-return-valid-response-format",
      "title": "should return valid response format",
      "suite": "generated/api_post_api_topup.spec.js > API: POST /api/topup",
      "file": "generated/api_post_api_topup.spec.js",
      "status": "passed",
      "duration": 4,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/api_post_api_topup.spec.js->-API:-POST-/api/topup-should-require-authentication",
      "title": "should require authentication",
      "suite": "generated/api_post_api_topup.spec.js > API: POST /api/topup",
      "file": "generated/api_post_api_topup.spec.js",
      "status": "failed",
      "duration": 16,
      "error": {
        "message": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m",
        "stack": "Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoContain\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // indexOf\u001b[22m\n\nExpected value: \u001b[32m400\u001b[39m\nReceived array: \u001b[31m[200, 201, 204]\u001b[39m\n    at /Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_topup.spec.js:41:31",
        "location": {
          "file": "/Users/krishsharma/Desktop/Micro loans/tests/generated/api_post_api_topup.spec.js",
          "column": 31,
          "line": 41
        },
        "snippet": "  39 |     } else {\n  40 |       // Auth might be optional or endpoint is public\n> 41 |       expect([200, 201, 204]).toContain(response.status());\n     |                               ^\n  42 |     }\n  43 |   });\n  44 |"
      },
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/page_home.spec.js->-Home-page-should-load-page-successfully",
      "title": "should load page successfully",
      "suite": "generated/page_home.spec.js > Home page",
      "file": "generated/page_home.spec.js",
      "status": "passed",
      "duration": 274,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_calls_management.spec.js->-Workflow:-Calls-Management-should-complete-calls-management-successfully",
      "title": "should complete calls management successfully",
      "suite": "generated/workflow_calls_management.spec.js > Workflow: Calls Management",
      "file": "generated/workflow_calls_management.spec.js",
      "status": "passed",
      "duration": 421,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_calls_management.spec.js->-Workflow:-Calls-Management-should-handle-errors-gracefully",
      "title": "should handle errors gracefully",
      "suite": "generated/workflow_calls_management.spec.js > Workflow: Calls Management",
      "file": "generated/workflow_calls_management.spec.js",
      "status": "passed",
      "duration": 263,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_dashboard_navigation.spec.js->-Workflow:-Dashboard-Navigation-should-complete-dashboard-navigation-successfully",
      "title": "should complete dashboard navigation successfully",
      "suite": "generated/workflow_dashboard_navigation.spec.js > Workflow: Dashboard Navigation",
      "file": "generated/workflow_dashboard_navigation.spec.js",
      "status": "passed",
      "duration": 715,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_dashboard_navigation.spec.js->-Workflow:-Dashboard-Navigation-should-handle-errors-gracefully",
      "title": "should handle errors gracefully",
      "suite": "generated/workflow_dashboard_navigation.spec.js > Workflow: Dashboard Navigation",
      "file": "generated/workflow_dashboard_navigation.spec.js",
      "status": "passed",
      "duration": 260,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_personas_management.spec.js->-Workflow:-Personas-Management-should-complete-personas-management-successfully",
      "title": "should complete personas management successfully",
      "suite": "generated/workflow_personas_management.spec.js > Workflow: Personas Management",
      "file": "generated/workflow_personas_management.spec.js",
      "status": "passed",
      "duration": 615,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_personas_management.spec.js->-Workflow:-Personas-Management-should-handle-errors-gracefully",
      "title": "should handle errors gracefully",
      "suite": "generated/workflow_personas_management.spec.js > Workflow: Personas Management",
      "file": "generated/workflow_personas_management.spec.js",
      "status": "passed",
      "duration": 267,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_topup_management.spec.js->-Workflow:-Topup-Management-should-complete-topup-management-successfully",
      "title": "should complete topup management successfully",
      "suite": "generated/workflow_topup_management.spec.js > Workflow: Topup Management",
      "file": "generated/workflow_topup_management.spec.js",
      "status": "passed",
      "duration": 420,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    },
    {
      "id": "generated/workflow_topup_management.spec.js->-Workflow:-Topup-Management-should-handle-errors-gracefully",
      "title": "should handle errors gracefully",
      "suite": "generated/workflow_topup_management.spec.js > Workflow: Topup Management",
      "file": "generated/workflow_topup_management.spec.js",
      "status": "passed",
      "duration": 272,
      "error": null,
      "retries": 0,
      "attachments": {
        "screenshots": [],
        "videos": [],
        "traces": [],
        "other": []
      }
    }
  ],
  "aiSummary": null,
  "jiraSummary": null
};
window.__TESTBOT_REPORT_TIMESTAMP__ = 1769672833693;
console.log('📊 Embedded report data loaded:', {
  project: window.__TESTBOT_EMBEDDED_REPORT__?.metadata?.projectName || 'Unknown',
  tests: window.__TESTBOT_EMBEDDED_REPORT__?.stats?.total || 0,
  timestamp: new Date(1769672833693).toISOString()
});
