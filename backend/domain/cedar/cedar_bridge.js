#!/usr/bin/env node
/**
 * PolicyLab Cedar Engine Bridge
 * Interfaces with official @cedar-policy/cedar-wasm engine
 */

const cedar = require('@cedar-policy/cedar-wasm/nodejs');

function parseEntityUid(uidStr) {
  if (!uidStr) return null;
  if (typeof uidStr === 'object' && uidStr.type && uidStr.id) {
    return uidStr;
  }
  // Parse format like 'User::"alice"' or 'Action::"view"' or 'Invoice::"inv-1"'
  const match = uidStr.match(/^([A-Za-z0-9_:]+?)::"?([^"]+)"?$/);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  return { type: 'Entity', id: uidStr };
}

function validatePolicy(policyText, schemaText = null) {
  try {
    const parseResult = cedar.checkParsePolicySet({ staticPolicies: policyText });
    if (parseResult.type === 'failure') {
      const errors = (parseResult.errors || []).map(err => ({
        message: err.message,
        help: err.help || null,
        code: err.code || null,
        severity: err.severity || 'error',
        sourceLocations: (err.sourceLocations || []).map(loc => ({
          start: loc.start,
          end: loc.end,
          label: loc.label || null
        }))
      }));
      return {
        isValid: false,
        errors,
        warnings: [],
        engine: `cedar-wasm@${cedar.getCedarVersion()}`
      };
    }

    // If schema provided, run schema-aware validation
    let validationWarnings = [];
    if (schemaText) {
      const valResult = cedar.validate({
        schema: schemaText,
        policies: { staticPolicies: policyText }
      });
      if (valResult.type === 'failure') {
        const errors = (valResult.errors || []).map(err => ({
          message: err.message,
          help: err.help || null,
          code: err.code || null,
          severity: 'error',
          sourceLocations: []
        }));
        return {
          isValid: false,
          errors,
          warnings: [],
          engine: `cedar-wasm@${cedar.getCedarVersion()}`
        };
      } else if (valResult.type === 'success') {
        if (valResult.validationErrors && valResult.validationErrors.length > 0) {
          const errors = valResult.validationErrors.map(ve => ({
            message: ve.error ? ve.error.message : String(ve),
            help: ve.error ? ve.error.help : null,
            code: ve.policyId || null,
            severity: 'error',
            sourceLocations: []
          }));
          return {
            isValid: false,
            errors,
            warnings: [],
            engine: `cedar-wasm@${cedar.getCedarVersion()}`
          };
        }
        if (valResult.validationWarnings) {
          validationWarnings = valResult.validationWarnings.map(vw => ({
            message: vw.error ? vw.error.message : String(vw),
            help: vw.error ? vw.error.help : null,
            code: vw.policyId || null,
            severity: 'warning',
            sourceLocations: []
          }));
        }
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings: validationWarnings,
      engine: `cedar-wasm@${cedar.getCedarVersion()}`
    };
  } catch (ex) {
    return {
      isValid: false,
      errors: [{ message: ex.message || String(ex), severity: 'error', sourceLocations: [] }],
      warnings: [],
      engine: `cedar-wasm@${cedar.getCedarVersion()}`
    };
  }
}

function evaluate(request) {
  const startTime = process.hrtime.bigint();
  try {
    const principalUid = parseEntityUid(request.principal);
    const actionUid = parseEntityUid(request.action);
    const resourceUid = parseEntityUid(request.resource);

    const callPayload = {
      principal: principalUid,
      action: actionUid,
      resource: resourceUid,
      context: request.context || {},
      policies: { staticPolicies: request.policyText },
      entities: request.entities || []
    };

    if (request.schema) {
      callPayload.schema = request.schema;
    }

    const result = cedar.isAuthorized(callPayload);
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    if (result.type === 'success') {
      const decision = result.response.decision === 'allow' ? 'ALLOW' : 'DENY';
      const determiningPolicies = result.response.diagnostics ? result.response.diagnostics.reason || [] : [];
      const diagErrors = result.response.diagnostics && result.response.diagnostics.errors
        ? result.response.diagnostics.errors.map(e => e.error.message)
        : [];

      return {
        success: true,
        decision,
        determiningPolicies,
        matchedPolicies: determiningPolicies.map(pid => ({
          policyId: pid,
          effect: decision === 'ALLOW' ? 'permit' : 'forbid',
          clause: ''
        })),
        diagnostics: {
          errors: diagErrors,
          warnings: (result.warnings || []).map(w => w.message)
        },
        executionDurationMs: Math.round(durationMs * 100) / 100,
        engine: `cedar-wasm@${cedar.getCedarVersion()}`
      };
    } else {
      return {
        success: false,
        decision: 'DENY',
        determiningPolicies: [],
        matchedPolicies: [],
        diagnostics: {
          errors: (result.errors || []).map(e => e.message),
          warnings: (result.warnings || []).map(w => w.message)
        },
        executionDurationMs: Math.round(durationMs * 100) / 100,
        engine: `cedar-wasm@${cedar.getCedarVersion()}`
      };
    }
  } catch (ex) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;
    return {
      success: false,
      decision: 'DENY',
      determiningPolicies: [],
      matchedPolicies: [],
      diagnostics: {
        errors: [ex.message || String(ex)],
        warnings: []
      },
      executionDurationMs: Math.round(durationMs * 100) / 100,
      engine: `cedar-wasm@${cedar.getCedarVersion()}`
    };
  }
}

// CLI handler for stdin/stdout JSON
if (require.main === module) {
  let inputData = '';
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', chunk => {
    inputData += chunk;
  });

  process.stdin.on('end', () => {
    try {
      const req = JSON.parse(inputData);
      let res;
      if (req.operation === 'validate') {
        res = validatePolicy(req.policyText, req.schema);
      } else if (req.operation === 'evaluate') {
        res = evaluate(req);
      } else if (req.operation === 'version') {
        res = {
          cedarVersion: cedar.getCedarVersion(),
          cedarLangVersion: cedar.getCedarLangVersion()
        };
      } else {
        res = { error: `Unknown operation: ${req.operation}` };
      }
      process.stdout.write(JSON.stringify(res));
    } catch (e) {
      process.stdout.write(JSON.stringify({ error: e.message }));
    }
  });
}

module.exports = {
  validatePolicy,
  evaluate,
  parseEntityUid
};
