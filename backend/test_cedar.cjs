const cedar = require('@cedar-policy/cedar-wasm/nodejs');

console.log('Cedar Engine Version:', cedar.getCedarVersion());
console.log('Cedar Lang Version:', cedar.getCedarLangVersion());

const validPolicy = `
permit (
    principal == User::"alice",
    action == Action::"view",
    resource == Invoice::"inv-1"
);
`;

const parseResult = cedar.checkParsePolicySet({ staticPolicies: validPolicy });
console.log('Valid policy parse result:', JSON.stringify(parseResult, null, 2));

const invalidPolicy = `
permit (
    principal == User::"alice"
    action == Action::"view"
);
`;
const invalidParseResult = cedar.checkParsePolicySet({ staticPolicies: invalidPolicy });
console.log('Invalid policy parse result:', JSON.stringify(invalidParseResult, null, 2));

// Test isAuthorized with permit
const allowRequest = {
  principal: { type: "User", id: "alice" },
  action: { type: "Action", id: "view" },
  resource: { type: "Invoice", id: "inv-1" },
  context: {},
  policies: { staticPolicies: validPolicy },
  entities: []
};
const allowResult = cedar.isAuthorized(allowRequest);
console.log('Allow evaluation result:', JSON.stringify(allowResult, null, 2));

// Test isAuthorized with deny (Bob trying to view)
const denyRequest = {
  principal: { type: "User", id: "bob" },
  action: { type: "Action", id: "view" },
  resource: { type: "Invoice", id: "inv-1" },
  context: {},
  policies: { staticPolicies: validPolicy },
  entities: []
};
const denyResult = cedar.isAuthorized(denyRequest);
console.log('Deny evaluation result:', JSON.stringify(denyResult, null, 2));
