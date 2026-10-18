---
name: doc-generator
description: Generate or update API reference documentation from an approved API contract or implementation. Use for endpoint docs, SDK examples, and integration guides; use api-contract-change for designing or versioning the contract itself.
---

# API Documentation Generator Skill

## Scope

Document an already-agreed API shape accurately. Do not invent endpoints, schemas, status codes, authentication behavior, or examples. The source of truth is the repository's API contract when one exists; otherwise verify against the implementation and identify any uncertainty.

This skill creates documentation only. It does not design or change API contracts, decide compatibility/version impact, or regenerate clients; use `api-contract-change` for that lifecycle.

## Generates

- API endpoint documentation
- SDK usage examples
- Integration guides
- Error code references
- Authentication guides

## Documentation Structure

### For Each Endpoint

````markdown
## GET /api/v1/users/:id

### Description
Brief explanation of what this endpoint does

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | User ID |

### Response

**200 Success**
```json
{
  "id": "usr_123",
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2025-01-15T10:30:00Z"
}
```

**404 Not Found**
```json
{
  "error": "USER_NOT_FOUND",
  "message": "User does not exist"
}
```

### Examples

**cURL**
```bash
curl -X GET "https://api.example.com/api/v1/users/usr_123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**JavaScript**
```javascript
const user = await fetch('/api/v1/users/usr_123', {
  headers: { 'Authorization': 'Bearer token' }
}).then(r => r.json());
```

**Python**
```python
response = requests.get(
    'https://api.example.com/api/v1/users/usr_123',
    headers={'Authorization': 'Bearer token'}
)
user = response.json()
```
````

Replace all illustrative routes and payloads in the examples above with verified contract or implementation details before publishing. Never document a placeholder example as a real API.

---

**Last Updated**: August 4, 2026
**Claude Code Version**: 2.1.220
**Sources**:
- https://code.claude.com/docs/en/skills
**Compatible Models**: Claude Fable 5, Claude Opus 5, Claude Sonnet 5, Claude Sonnet 4.6, Claude Opus 4.8, Claude Haiku 4.5
