import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';
import { SecuritySchemeObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { SwaggerUiOptions } from '@nestjs/swagger/dist/interfaces/swagger-ui-options.interface';

interface SwaggerConfig {
    githubClientId: string;
    swaggerOAuthCallbackUrl: string;
    githubAuthorizationUrl: string;
    githubTokenUrl: string;
}

function getSwaggerConfig(port: number, configService: ConfigService): SwaggerConfig {
    const defaultSwaggerOAuthCallbackUrl = `http://localhost:${port}/swagger/oauth/callback`;
    const defaultGithubAuthorizationUrl = 'https://github.com/login/oauth/authorize';
    const defaultGithubTokenUrl = 'https://github.com/login/oauth/access_token';

    return {
        githubClientId: configService.get<string>('GITHUB_OAUTH_CLIENT_ID', ''),
        swaggerOAuthCallbackUrl: configService.get<string>(
            'SWAGGER_OAUTH_CALLBACK_URL',
            defaultSwaggerOAuthCallbackUrl
        ),
        githubAuthorizationUrl: configService.get<string>(
            'GITHUB_OAUTH_AUTH_URL',
            defaultGithubAuthorizationUrl
        ),
        githubTokenUrl: configService.get<string>(
            'GITHUB_OAUTH_TOKEN_URL',
            defaultGithubTokenUrl
        ),
    };
}

function createGithubOAuth2SecurityScheme(
    githubAuthorizationUrl: string,
    githubTokenUrl: string,
): SecuritySchemeObject {
    return {
        type: 'oauth2',
        description: 'OAuth2 using a Github App installed in the whispr-messenger organization.',
        flows: {
            authorizationCode: {
                authorizationUrl: githubAuthorizationUrl,
                tokenUrl: githubTokenUrl,
                scopes: {
                    'read:user': 'Read user profile',
                },
            },
        },
    };
}

function buildSwaggerDocument(
    port: number,
    githubOauth2SecurityScheme: SecuritySchemeObject,
    securitySchemeName: string,
    isProduction: boolean,
) {
    const builder = new DocumentBuilder()
        .setTitle('Authentication Service')
        .setDescription('API documentation for the Authentication Service')
        .setVersion('1.0')
        .addServer(`http://localhost:${port}`, 'Development')
        .addServer('https://api.example.com', 'Production');

    if (isProduction) {
        builder
            .addOAuth2(githubOauth2SecurityScheme, securitySchemeName)
            .addSecurityRequirements(securitySchemeName);
    }

    return builder.build();
}

function createSwaggerUiOptions(
    githubClientId: string,
    swaggerOAuthCallbackUrl: string,
): SwaggerUiOptions {
    return {
        initOAuth: {
            clientId: githubClientId,
            appName: 'Whispr Auth Service',
            scopes: ['read:user'],
            usePkceWithAuthorizationCodeGrant: true,
        },
        oauth2RedirectUrl: swaggerOAuthCallbackUrl,
        persistAuthorization: true,
    };
}

function createSwaggerCustomOptions(swaggerUiOptions: SwaggerUiOptions): SwaggerCustomOptions {
    return {
        swaggerOptions: swaggerUiOptions,
    };
}

export function createSwaggerDocumentation(
    app: NestExpressApplication,
    port: number,
    configService: ConfigService,
) {
    const logger = new Logger('Swagger');
    const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', true);

    if (!swaggerEnabled) {
        logger.log('Swagger documentation is disabled');
        return;
    }

    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    const securitySchemeName = 'oauth2-github';
    const swaggerConfig = getSwaggerConfig(port, configService);

    const githubOauth2SecurityScheme = createGithubOAuth2SecurityScheme(
        swaggerConfig.githubAuthorizationUrl,
        swaggerConfig.githubTokenUrl,
    );

    const config = buildSwaggerDocument(port, githubOauth2SecurityScheme, securitySchemeName, isProduction);
    const documentFactory = () => SwaggerModule.createDocument(app, config);

    let swaggerCustomOptions: SwaggerCustomOptions;

    if (isProduction) {
        const swaggerUiOptions = createSwaggerUiOptions(
            swaggerConfig.githubClientId,
            swaggerConfig.swaggerOAuthCallbackUrl,
        );
        swaggerCustomOptions = createSwaggerCustomOptions(swaggerUiOptions);
    } else {
        swaggerCustomOptions = {};
    }

    SwaggerModule.setup('swagger', app, documentFactory, swaggerCustomOptions);

    logger.log(`Swagger documentation available at: http://0.0.0.0:${port}/swagger`);

    if (!isProduction) {
        logger.log('OAuth authentication is disabled in development mode');
    }
}
