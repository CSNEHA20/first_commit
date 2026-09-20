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
  throw new Error(`Invalid Cedar entity UID format: '${uidStr}'. Expected format: 'Type::"id"'`);
}

function normalizeSchema(schemaInput) {
  if (!schemaInput) return null;
  let schemaObj = schemaInput;
  if (typeof schemaInput === 'string') {
    const trimmed = schemaInput.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        schemaObj = JSON.parse(trimmed);
      } catch (e) {
        return schemaInput;
      }
    } else {
      return schemaInput;
    }
  }
  return schemaObj;
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
      const schemaParam = normalizeSchema(schemaText);
      let valResult = cedar.validate({
        schema: schemaParam,
        policies: { staticPolicies: policyText }
      });
      if (valResult.type === 'success' && valResult.validationErrors && valResult.validationErrors.length > 0 && typeof schemaParam === 'object' && schemaParam !== null) {
        const keys = Object.keys(schemaParam);
        if (keys.length === 1 && keys[0] !== '') {
          const unnamespaced = { '': schemaParam[keys[0]] };
          const retryResult = cedar.validate({
            schema: unnamespaced,
            policies: { staticPolicies: policyText }
          });
          if (retryResult.type === 'success' && (!retryResult.validationErrors || retryResult.validationErrors.length === 0)) {
            valResult = retryResult;
          }
        }
      }
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
      callPayload.schema = normalizeSchema(request.schema);
    }

    let result = cedar.isAuthorized(callPayload);
    if (result.type === 'failure' && callPayload.schema) {
      if (typeof callPayload.schema === 'object' && callPayload.schema !== null) {
        const keys = Object.keys(callPayload.schema);
        if (keys.length === 1 && keys[0] !== '') {
          const retryPayload = { ...callPayload, schema: { '': callPayload.schema[keys[0]] } };
          const retryResult = cedar.isAuthorized(retryPayload);
          if (retryResult.type === 'success') {
            result = retryResult;
          }
        }
      }
      if (result.type === 'failure') {
        const fallbackPayload = { ...callPayload };
        delete fallbackPayload.schema;
        const fallbackResult = cedar.isAuthorized(fallbackPayload);
        if (fallbackResult.type === 'success') {
          result = fallbackResult;
        }
      }
    }
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
        error: (result.errors || []).map(e => e.message).join('; ') || 'Cedar evaluation failed',
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
      error: ex.message || String(ex),
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

function batchEvaluate(request) {
  const startTime = process.hrtime.bigint();
  const scenarios = request.scenarios || [];
  const globalEntities = request.entities || [];
  const results = [];

  for (const sc of scenarios) {
    const scStartTime = process.hrtime.bigint();
    try {
      const principalUid = parseEntityUid(sc.principal);
      const actionUid = parseEntityUid(sc.action);
      const resourceUid = parseEntityUid(sc.resource);
      const entities = sc.entities && sc.entities.length > 0 ? sc.entities : globalEntities;

      const callPayload = {
        principal: principalUid,
        action: actionUid,
        resource: resourceUid,
        context: sc.context || {},
        policies: { staticPolicies: request.policyText },
        entities: entities
      };

      if (request.schema) {
        callPayload.schema = normalizeSchema(request.schema);
      }

      let result = cedar.isAuthorized(callPayload);
      if (result.type === 'failure' && callPayload.schema) {
        if (typeof callPayload.schema === 'object' && callPayload.schema !== null) {
          const keys = Object.keys(callPayload.schema);
          if (keys.length === 1 && keys[0] !== '') {
            const retryPayload = { ...callPayload, schema: { '': callPayload.schema[keys[0]] } };
            const retryResult = cedar.isAuthorized(retryPayload);
            if (retryResult.type === 'success') {
              result = retryResult;
            }
          }
        }
        if (result.type === 'failure') {
          const fallbackPayload = { ...callPayload };
          delete fallbackPayload.schema;
          const fallbackResult = cedar.isAuthorized(fallbackPayload);
          if (fallbackResult.type === 'success') {
            result = fallbackResult;
          }
        }
      }
      const scEndTime = process.hrtime.bigint();
      const durationMs = Number(scEndTime - scStartTime) / 1e6;

      if (result.type === 'success') {
        const decision = result.response.decision === 'allow' ? 'ALLOW' : 'DENY';
        const determiningPolicies = result.response.diagnostics ? result.response.diagnostics.reason || [] : [];
        const diagErrors = result.response.diagnostics && result.response.diagnostics.errors
          ? result.response.diagnostics.errors.map(e => e.error.message)
          : [];

        results.push({
          scenarioId: sc.id,
          scenarioTitle: sc.title || null,
          success: true,
          decision: decision,
          determiningPolicies: determiningPolicies,
          matchedPolicies: determiningPolicies.map(pid => ({
            policyId: pid,
            effect: decision === 'ALLOW' ? 'permit' : 'forbid',
            clause: ''
          })),
          diagnostics: {
            errors: diagErrors,
            warnings: (result.warnings || []).map(w => w.message)
          },
          executionDurationMs: Math.round(durationMs * 100) / 100
        });
      } else {
        results.push({
          scenarioId: sc.id,
          scenarioTitle: sc.title || null,
          success: false,
          error: (result.errors || []).map(e => e.message).join('; ') || 'Evaluation error',
          diagnostics: {
            errors: (result.errors || []).map(e => e.message),
            warnings: (result.warnings || []).map(w => w.message)
          },
          executionDurationMs: Math.round(durationMs * 100) / 100
        });
      }
    } catch (ex) {
      const scEndTime = process.hrtime.bigint();
      const durationMs = Number(scEndTime - scStartTime) / 1e6;
      results.push({
        scenarioId: sc.id,
        scenarioTitle: sc.title || null,
        success: false,
        error: ex.message || String(ex),
        diagnostics: {
          errors: [ex.message || String(ex)],
          warnings: []
        },
        executionDurationMs: Math.round(durationMs * 100) / 100
      });
    }
  }

  const endTime = process.hrtime.bigint();
  const totalDurationMs = Number(endTime - startTime) / 1e6;

  return {
    success: true,
    results: results,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    engine: `cedar-wasm@${cedar.getCedarVersion()}`
  };
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
      } else if (req.operation === 'batch_evaluate') {
        res = batchEvaluate(req);
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
  batchEvaluate,
  parseEntityUid
};
