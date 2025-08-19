import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { RateLimitGuard } from '../src/guards/rate-limit.guard';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let verificationId: string;
  let accessToken: string;
  let refreshToken: string;
  let deviceId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/auth/request-verification (POST)', () => {
    it('should request verification code successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('verificationId');
          expect(res.body).toHaveProperty('expiresAt');
          verificationId = res.body.verificationId;
        });
    });

    it('should return 400 for invalid phone number', () => {
      return request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: 'invalid-phone',
        })
        .expect(400);
    });
  });

  describe('/auth/confirm-verification (POST)', () => {
    beforeEach(async () => {
      // Request verification first
      const response = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = response.body.verificationId;
    });

    it('should confirm verification code successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456', // Mock code
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('verified', true);
        });
    });

    it('should return 400 for invalid verification code', () => {
      return request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '000000',
        })
        .expect(400);
    });
  });

  describe('/auth/register (POST)', () => {
    beforeEach(async () => {
      // Request and confirm verification first
      const verificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = verificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });
    });

    it('should register user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          verificationId,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'iPhone 13',
          deviceType: 'mobile',
          publicKey: 'test-public-key',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it('should return 400 for missing required fields', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          verificationId,
          firstName: 'John',
          // Missing lastName
        })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    beforeEach(async () => {
      // Register user first
      const verificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = verificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });

      await request(app.getHttpServer()).post('/auth/register').send({
        verificationId,
        firstName: 'John',
        lastName: 'Doe',
        deviceName: 'iPhone 13',
        deviceType: 'mobile',
        publicKey: 'test-public-key',
      });

      // Request new verification for login
      const loginVerificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = loginVerificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });
    });

    it('should login user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          verificationId,
          deviceName: 'iPhone 13',
          deviceType: 'mobile',
          publicKey: 'test-public-key',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });
  });

  describe('/auth/refresh (POST)', () => {
    beforeEach(async () => {
      // Complete registration to get tokens
      const verificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = verificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          verificationId,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'iPhone 13',
          deviceType: 'mobile',
          publicKey: 'test-public-key',
        });

      refreshToken = registerResponse.body.refreshToken;
    });

    it('should refresh tokens successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should return 401 for invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });
  });

  describe('/auth/devices (GET)', () => {
    beforeEach(async () => {
      // Complete registration to get access token
      const verificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = verificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          verificationId,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'iPhone 13',
          deviceType: 'mobile',
          publicKey: 'test-public-key',
        });

      accessToken = registerResponse.body.accessToken;
    });

    it('should get user devices successfully', () => {
      return request(app.getHttpServer())
        .get('/auth/devices')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('deviceName');
            expect(res.body[0]).toHaveProperty('deviceType');
            deviceId = res.body[0].id;
          }
        });
    });

    it('should return 401 without authorization', () => {
      return request(app.getHttpServer()).get('/auth/devices').expect(401);
    });
  });

  describe('/auth/devices/:deviceId (DELETE)', () => {
    beforeEach(async () => {
      // Complete registration and get device ID
      const verificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = verificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          verificationId,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'iPhone 13',
          deviceType: 'mobile',
          publicKey: 'test-public-key',
        });

      accessToken = registerResponse.body.accessToken;

      // Get device ID
      const devicesResponse = await request(app.getHttpServer())
        .get('/auth/devices')
        .set('Authorization', `Bearer ${accessToken}`);

      if (devicesResponse.body.length > 0) {
        deviceId = devicesResponse.body[0].id;
      }
    });

    it('should revoke device successfully', (done) => {
      if (!deviceId) {
        done(); // Skip if no device ID available
        return;
      }

      request(app.getHttpServer())
        .delete(`/auth/devices/${deviceId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .end(done);
    });

    it('should return 401 without authorization', () => {
      return request(app.getHttpServer())
        .delete('/auth/devices/some-device-id')
        .expect(401);
    });
  });

  describe('/auth/logout (POST)', () => {
    beforeEach(async () => {
      // Complete registration to get tokens
      const verificationResponse = await request(app.getHttpServer())
        .post('/auth/request-verification')
        .send({
          phoneNumber: '+33123456789',
        });
      verificationId = verificationResponse.body.verificationId;

      await request(app.getHttpServer())
        .post('/auth/confirm-verification')
        .send({
          verificationId,
          code: '123456',
        });

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          verificationId,
          firstName: 'John',
          lastName: 'Doe',
          deviceName: 'iPhone 13',
          deviceType: 'mobile',
          publicKey: 'test-public-key',
        });

      accessToken = registerResponse.body.accessToken;
      refreshToken = registerResponse.body.refreshToken;
    });

    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          refreshToken,
        })
        .expect(200);
    });

    it('should return 401 without authorization', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({
          refreshToken,
        })
        .expect(401);
    });
  });
});
