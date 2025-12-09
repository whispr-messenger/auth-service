import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/modules/app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAuth } from '../src/modules/two-factor-authentication/user-auth.entity';
import { Device } from '../src/modules/devices/device.entity';
import { PreKey } from '../src/modules/authentication/entities/prekey.entity';
import { SignedPreKey } from '../src/modules/authentication/entities/signed-prekey.entity';
import { IdentityKey } from '../src/modules/authentication/entities/identity-key.entity';
import { BackupCode } from '../src/modules/authentication/entities/backup-code.entity';
import { LoginHistory } from '../src/modules/authentication/entities/login-history.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../src/modules/authentication/guards/jwt-auth.guard';
import { RateLimitGuard } from '../src/modules/authentication/guards/rate-limit.guard';
import { TokensService } from '../src/modules/tokens/services/tokens.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

describe('Registration Flow (e2e)', () => {
	let app: INestApplication;

	const mockUserAuthRepository = {
		find: jest.fn(),
		findOne: jest.fn().mockResolvedValue(null),
		save: jest.fn(),
		create: jest.fn().mockImplementation((user) => user),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockDeviceRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn().mockImplementation((device) => ({
			id: 'test-device-id',
			...device,
		})),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockGenericRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		delete: jest.fn(),
		update: jest.fn(),
	};

	const mockCacheManager = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		reset: jest.fn(),
	};

	const mockTokensService = {
		generateTokenPair: jest.fn().mockResolvedValue({
			accessToken: 'test-access-token',
			refreshToken: 'test-refresh-token',
		}),
	};

	beforeEach(async () => {
		// Configuration du cache pour la vérification du téléphone
		const hashedCode = '$2b$04$hNEZ6JtFsapGYT98FOxCHu1gK/saVIYrB5Y1kcTTu1in9xurqRD.G'; // bcrypt hash of '123456'
		const verificationData = {
			phoneNumber: '+33612345678',
			hashedCode: hashedCode,
			attempts: 0,
			purpose: 'registration',
			verified: false,
			expiresAt: Date.now() + 600000, // 10 minutes
		};

		mockCacheManager.get.mockImplementation((key: string) => {
			if (key.startsWith('phone_verification:') || key.startsWith('verification:')) {
				return Promise.resolve(JSON.stringify(verificationData));
			}
			if (key.startsWith('phone_verification_confirmed:')) {
				return Promise.resolve(JSON.stringify({ ...verificationData, verified: true }));
			}
			return Promise.resolve(null);
		});

		mockCacheManager.set.mockResolvedValue(undefined);
		mockCacheManager.del.mockResolvedValue(undefined);

		// Configuration du repository utilisateur
		mockUserAuthRepository.save.mockImplementation((user) =>
			Promise.resolve({
				id: 'test-user-id',
				phoneNumber: user.phoneNumber,
				twoFactorEnabled: false,
				lastAuthenticatedAt: new Date(),
				...user,
			})
		);

		mockDeviceRepository.save.mockImplementation((device) =>
			Promise.resolve({
				id: 'test-device-id',
				...device,
			})
		);

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(getRepositoryToken(UserAuth))
			.useValue(mockUserAuthRepository)
			.overrideProvider(getRepositoryToken(Device))
			.useValue(mockDeviceRepository)
			.overrideProvider(getRepositoryToken(PreKey))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(SignedPreKey))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(IdentityKey))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(BackupCode))
			.useValue(mockGenericRepository)
			.overrideProvider(getRepositoryToken(LoginHistory))
			.useValue(mockGenericRepository)
			.overrideProvider(CACHE_MANAGER)
			.useValue(mockCacheManager)
			.overrideProvider(TokensService)
			.useValue(mockTokensService)
			.overrideGuard(JwtAuthGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(RateLimitGuard)
			.useValue({ canActivate: () => true })
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			})
		);
		await app.init();
	});

	afterEach(async () => {
		if (app) {
			await app.close();
		}
		jest.clearAllMocks();
	});

	describe('Complete Registration Flow', () => {
		const phoneNumber = '+33612345678';
		const verificationCode = '123456';
		const hashedCode = '$2b$04$hNEZ6JtFsapGYT98FOxCHu1gK/saVIYrB5Y1kcTTu1in9xurqRD.G';
		let verificationId: string;

		it('should complete the full registration flow successfully', async () => {
			// Étape 1: Demande de code de vérification
			const requestResponse = await request(app.getHttpServer())
				.post('/verify/register/request')
				.send({ phoneNumber })
				.expect(200);

			expect(requestResponse.body).toHaveProperty('verificationId');
			verificationId = requestResponse.body.verificationId;

			// Vérifier que le verificationId est un UUID valide
			expect(verificationId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
			);

			// Mock pour l'étape de confirmation
			mockCacheManager.get.mockResolvedValueOnce(
				JSON.stringify({
					phoneNumber,
					hashedCode,
					attempts: 0,
					purpose: 'registration',
					verified: false,
					expiresAt: Date.now() + 600000,
				})
			);

			// Étape 2: Confirmation du code de vérification
			const confirmResponse = await request(app.getHttpServer())
				.post('/verify/register/confirm')
				.send({
					verificationId,
					code: verificationCode,
				})
				.expect(200);

			expect(confirmResponse.body).toHaveProperty('verified', true);

			// Mock pour l'étape d'inscription
			mockCacheManager.get.mockResolvedValueOnce(
				JSON.stringify({
					phoneNumber,
					hashedCode,
					attempts: 0,
					purpose: 'registration',
					verified: true,
					expiresAt: Date.now() + 600000,
				})
			);

			// Étape 3: Inscription finale avec les informations utilisateur
			const registerResponse = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId,
					firstName: 'Gonzalo',
					lastName: 'Lopez',
					deviceName: 'Test Device',
					deviceType: 'mobile',
					publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----',
				})
				.set('User-Agent', 'Test Agent')
				.expect(201);

			// Vérifier la réponse d'inscription
			expect(registerResponse.body).toHaveProperty('accessToken');
			expect(registerResponse.body).toHaveProperty('refreshToken');
			expect(registerResponse.body.accessToken).toBeTruthy();
			expect(registerResponse.body.refreshToken).toBeTruthy();

			// Vérifier que l'utilisateur a été créé
			expect(mockUserAuthRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					phoneNumber,
					twoFactorEnabled: false,
				})
			);
			expect(mockUserAuthRepository.save).toHaveBeenCalled();

			// Vérifier que le device a été enregistré
			expect(mockDeviceRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'test-user-id',
					deviceName: 'Test Device',
					deviceType: 'mobile',
				})
			);
		});

		it('should fail registration request with invalid phone number', async () => {
			const response = await request(app.getHttpServer())
				.post('/verify/register/request')
				.send({ phoneNumber: 'invalid-phone' })
				.expect(400);

			expect(response.body).toHaveProperty('message');
			expect(
				Array.isArray(response.body.message) ? response.body.message[0] : response.body.message
			).toContain('phone');
		});

		it('should fail registration confirmation with invalid verification ID', async () => {
			const response = await request(app.getHttpServer())
				.post('/verify/register/confirm')
				.send({
					verificationId: 'invalid-uuid',
					code: '123456',
				})
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should fail registration confirmation with invalid code format', async () => {
			const response = await request(app.getHttpServer())
				.post('/verify/register/confirm')
				.send({
					verificationId: '550e8400-e29b-41d4-a716-446655440000',
					code: '12345', // Seulement 5 chiffres au lieu de 6
				})
				.expect(400);

			expect(response.body).toHaveProperty('message');
			const errorMessage = Array.isArray(response.body.message)
				? response.body.message[0]
				: response.body.message;
			expect(errorMessage).toMatch(/6/);
		});

		it('should fail final registration with missing required fields', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'Gonzalo',
					// lastName manquant
				})
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should fail final registration with invalid verification ID', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: 'not-a-uuid',
					firstName: 'Gonzalo',
					lastName: 'Lopez',
				})
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should handle registration without optional device information', async () => {
			const hashedCode = '$2b$04$hNEZ6JtFsapGYT98FOxCHu1gK/saVIYrB5Y1kcTTu1in9xurqRD.G';
			// Configuration pour le scénario sans device
			mockCacheManager.get.mockResolvedValueOnce(
				JSON.stringify({
					phoneNumber: '+33612345678',
					hashedCode: hashedCode,
					attempts: 0,
					purpose: 'registration',
					verified: true,
					expiresAt: Date.now() + 600000,
				})
			);

			const verificationId = '550e8400-e29b-41d4-a716-446655440000';

			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId,
					firstName: 'Gonzalo',
					lastName: 'Lopez',
					// Pas de deviceName, deviceType, ni publicKey
				})
				.set('User-Agent', 'Test Agent')
				.expect(201);

			expect(response.body).toHaveProperty('accessToken');
			expect(response.body).toHaveProperty('refreshToken');

			// Vérifier que l'utilisateur a été créé même sans device
			expect(mockUserAuthRepository.save).toHaveBeenCalled();
		});

		it('should prevent duplicate registration with same phone number', async () => {
			const hashedCode = '$2b$04$hNEZ6JtFsapGYT98FOxCHu1gK/saVIYrB5Y1kcTTu1in9xurqRD.G';
			// Simuler qu'un utilisateur existe déjà
			mockUserAuthRepository.findOne.mockResolvedValueOnce({
				id: 'existing-user-id',
				phoneNumber: '+33612345678',
				twoFactorEnabled: false,
			});

			mockCacheManager.get.mockResolvedValueOnce(
				JSON.stringify({
					phoneNumber: '+33612345678',
					hashedCode: hashedCode,
					attempts: 0,
					purpose: 'registration',
					verified: true,
					expiresAt: Date.now() + 600000,
				})
			);

			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: '550e8400-e29b-41d4-a716-446655440000',
					firstName: 'Gonzalo',
					lastName: 'Lopez',
				})
				.expect(409);

			expect(response.body).toHaveProperty('message');
			expect(response.body.message).toContain('existe déjà');
		});
	});

	describe('Registration Request Validation', () => {
		it('should reject empty phone number', async () => {
			const response = await request(app.getHttpServer())
				.post('/verify/register/request')
				.send({ phoneNumber: '' })
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should reject missing phone number', async () => {
			const response = await request(app.getHttpServer())
				.post('/verify/register/request')
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should accept valid international phone numbers', async () => {
			const validPhoneNumbers = ['+33612345678', '+14155552671', '+447911123456'];

			for (const phoneNumber of validPhoneNumbers) {
				// Réinitialiser le mock findOne pour ce test
				mockUserAuthRepository.findOne.mockResolvedValueOnce(null);

				const response = await request(app.getHttpServer())
					.post('/verify/register/request')
					.send({ phoneNumber })
					.expect(200);

				expect(response.body).toHaveProperty('verificationId');
			}
		});
	});

	describe('Registration Data Validation', () => {
		const validVerificationId = '550e8400-e29b-41d4-a716-446655440000';

		beforeEach(() => {
			const hashedCode = '$2b$04$hNEZ6JtFsapGYT98FOxCHu1gK/saVIYrB5Y1kcTTu1in9xurqRD.G';
			mockCacheManager.get.mockResolvedValue(
				JSON.stringify({
					phoneNumber: '+33612345678',
					hashedCode: hashedCode,
					attempts: 0,
					purpose: 'registration',
					verified: true,
					expiresAt: Date.now() + 600000,
				})
			);
		});
		it('should validate firstName is a string', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: validVerificationId,
					firstName: 123, // Nombre au lieu de string
					lastName: 'Lopez',
				})
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should validate lastName is a string', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: validVerificationId,
					firstName: 'Gonzalo',
					lastName: ['Lopez'], // Array au lieu de string
				})
				.expect(400);

			expect(response.body).toHaveProperty('message');
		});

		it('should accept optional deviceType field', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: validVerificationId,
					firstName: 'Gonzalo',
					lastName: 'Lopez',
					deviceType: 'desktop',
				})
				.expect(201);

			expect(response.body).toHaveProperty('accessToken');
		});

		it('should accept optional deviceName field', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: validVerificationId,
					firstName: 'Gonzalo',
					lastName: 'Lopez',
					deviceName: 'My Laptop',
				})
				.expect(201);

			expect(response.body).toHaveProperty('accessToken');
		});

		it('should accept optional publicKey field', async () => {
			const response = await request(app.getHttpServer())
				.post('/register')
				.send({
					verificationId: validVerificationId,
					firstName: 'Gonzalo',
					lastName: 'Lopez',
					publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
				})
				.expect(201);

			expect(response.body).toHaveProperty('accessToken');
		});
	});
});
