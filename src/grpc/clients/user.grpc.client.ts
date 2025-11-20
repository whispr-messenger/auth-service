import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class UserGrpcClient implements OnModuleInit {
  private readonly logger = new Logger(UserGrpcClient.name);
  private client: any;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient() {
    try {
      const protoPath = path.join(__dirname, '../../../../proto/user.proto');
      const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });

      const userProto = grpc.loadPackageDefinition(packageDefinition)
        .user as any;

      const userServiceUrl = this.configService.get<string>(
        'USER_SERVICE_GRPC_URL',
        'user-service:50052'
      );

      this.client = new userProto.UserService(
        userServiceUrl,
        grpc.credentials.createInsecure(),
        {
          'grpc.keepalive_time_ms': 30000,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.keepalive_permit_without_calls': true,
          'grpc.http2.max_pings_without_data': 0,
          'grpc.http2.min_time_between_pings_ms': 10000,
          'grpc.http2.min_ping_interval_without_data_ms': 300000,
        }
      );

      this.logger.log(`User gRPC client connected to ${userServiceUrl}`);
    } catch (error) {
      this.logger.error('Failed to initialize User gRPC client:', error);
    }
  }

  async getUser(userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      this.client.getUser({ user_id: userId }, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error getting user:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async createUser(userData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      this.client.createUser(userData, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error creating user:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async updateUser(userId: string, updateData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        ...updateData,
      };

      this.client.updateUser(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error updating user:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async deleteUser(userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      this.client.deleteUser(
        { user_id: userId },
        (error: any, response: any) => {
          if (error) {
            this.logger.error('Error deleting user:', error);
            return reject(error);
          }
          resolve(response);
        }
      );
    });
  }

  async searchUsers(
    query: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        query,
        limit,
        offset,
      };

      this.client.searchUsers(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error searching users:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async getUserContacts(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        limit,
        offset,
      };

      this.client.getUserContacts(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error getting user contacts:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async addContact(
    userId: string,
    contactUserId: string,
    displayName?: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        contact_user_id: contactUserId,
        display_name: displayName,
      };

      this.client.addContact(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error adding contact:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async removeContact(userId: string, contactUserId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        contact_user_id: contactUserId,
      };

      this.client.removeContact(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error removing contact:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async blockUser(
    userId: string,
    blockedUserId: string,
    reason?: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        blocked_user_id: blockedUserId,
        reason,
      };

      this.client.blockUser(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error blocking user:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async unblockUser(userId: string, blockedUserId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        blocked_user_id: blockedUserId,
      };

      this.client.unblockUser(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error unblocking user:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async getBlockedUsers(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        limit,
        offset,
      };

      this.client.getBlockedUsers(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('Error getting blocked users:', error);
          return reject(error);
        }
        resolve(response);
      });
    });
  }

  async updatePrivacySettings(userId: string, settings: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      const request = {
        user_id: userId,
        ...settings,
      };

      this.client.updatePrivacySettings(
        request,
        (error: any, response: any) => {
          if (error) {
            this.logger.error('Error updating privacy settings:', error);
            return reject(error);
          }
          resolve(response);
        }
      );
    });
  }

  async getPrivacySettings(userId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not initialized'));
      }

      this.client.getPrivacySettings(
        { user_id: userId },
        (error: any, response: any) => {
          if (error) {
            this.logger.error('Error getting privacy settings:', error);
            return reject(error);
          }
          resolve(response);
        }
      );
    });
  }
}
