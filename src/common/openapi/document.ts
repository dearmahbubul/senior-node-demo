import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';

// Reusable bearer-auth scheme -> powers the "Authorize" button in Swagger UI
registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Paste the token returned by POST /api/auth/login',
});

export function generateOpenApiDocument() {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            title: 'Senior Node Demo API',
            version: '1.0.0',
            description:
                'Task management API with JWT auth, file attachments (local/S3 storage), rate limiting and typed errors.',
        },
        servers: [{ url: '/api' }],
    });
}
