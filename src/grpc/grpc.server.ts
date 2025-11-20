import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGrpcService } from './auth.grpc.service';
import * as path from 'path';

@Injectable()
export class GrpcServer implements OnModuleInit {
  private readonly logger = new Logger(GrpcServer.name);
  private server: grpc.Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly authGrpcService: AuthGrpcService
  ) {
    this.server = new grpc.Server();
  }

  async onModuleInit() {
    await this.startGrpcServer();
  }

  private async startGrpcServer() {
    try {
      const protoPath = path.join(__dirname, '../../../proto/auth.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const authProto = grpc.loadPackageDefinition(packageDefinition)
        .auth as any;

      this.server.addService(authProto.AuthService.service, {
        validateToken: this.authGrpcService.validateToken.bind(
          this.authGrpcService
        ),
        refreshToken: this.authGrpcService.refreshToken.bind(
          this.authGrpcService
        ),
        login: this.authGrpcService.login.bind(this.authGrpcService),
        getUserInfo: this.authGrpcService.getUserInfo.bind(
          this.authGrpcService
        ),
        getUserProfile: this.authGrpcService.getUserProfile.bind(
          this.authGrpcService
        ),
        checkPermission: this.authGrpcService.checkPermission.bind(
          this.authGrpcService
        ),
        registerDevice: this.authGrpcService.registerDevice.bind(
          this.authGrpcService
        ),
        revokeDevice: this.authGrpcService.revokeDevice.bind(
          this.authGrpcService
        ),
        getUserDevices: this.authGrpcService.getUserDevices.bind(
          this.authGrpcService
        ),
        verifyTwoFactor: this.authGrpcService.verifyTwoFactor.bind(
          this.authGrpcService
        ),
        generateQRCode: this.authGrpcService.generateQRCode.bind(
          this.authGrpcService
        ),
        validateQRCode: this.authGrpcService.validateQRCode.bind(
          this.authGrpcService
        ),
      });

      const grpcPort = this.configService.get<number>('GRPC_PORT', 50051);
      const grpcHost = '0.0.0.0';

      this.server.bindAsync(
        `${grpcHost}:${grpcPort}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            this.logger.error('Failed to start gRPC server:', error);
            return;
          }
          this.logger.log(`gRPC server started on ${grpcHost}:${port}`);
          this.server.start();
        }
      );
    } catch (error) {
      this.logger.error('Error starting gRPC server:', error);
    }
  }

  async onApplicationShutdown() {
    if (this.server) {
      this.server.forceShutdown();
      this.logger.log('gRPC server stopped');
    }
  }
}
