const RESEARCH_PUBLIC_ROUTE_PREFIX = '/v1';
const RESEARCH_PUBLIC_JSON_MEDIA_TYPE = 'application/json';
const RESEARCH_PUBLIC_MAX_BODY_BYTES = 64 * 1024;

const FORBIDDEN_RESEARCH_PUBLIC_HEADERS = Object.freeze([
  'authorization',
  'cookie',
  'proxy-authorization',
  'x-user-id',
  'x-account-id',
  'x-session-id',
  'x-authenticated-user'
]);

module.exports = Object.freeze({
  RESEARCH_PUBLIC_ROUTE_PREFIX,
  RESEARCH_PUBLIC_JSON_MEDIA_TYPE,
  RESEARCH_PUBLIC_MAX_BODY_BYTES,
  FORBIDDEN_RESEARCH_PUBLIC_HEADERS
});
