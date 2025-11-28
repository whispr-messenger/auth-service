import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as path from 'path'

@Injectable()
export class MediaGrpcClient implements OnModuleInit {
    private readonly logger = new Logger(MediaGrpcClient.name)
    private client: any

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        await this.initializeClient()
    }

    private async initializeClient() {
        try {
            const protoPath = path.join(
                __dirname,
                '../../../../proto/media.proto'
            )
            const packageDefinition = protoLoader.loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
            })

            const mediaProto = grpc.loadPackageDefinition(packageDefinition)
                .media as any
            const mediaServiceUrl = this.configService.get<string>(
                'MEDIA_SERVICE_GRPC_URL',
                'media-service:50053'
            )

            this.client = new mediaProto.MediaService(
                mediaServiceUrl,
                grpc.credentials.createInsecure(),
                {
                    'grpc.keepalive_time_ms': 30000,
                    'grpc.keepalive_timeout_ms': 5000,
                    'grpc.keepalive_permit_without_calls': true,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.http2.min_time_between_pings_ms': 10000,
                    'grpc.http2.min_ping_interval_without_data_ms': 300000,
                }
            )

            this.logger.log(`Media gRPC client connected to ${mediaServiceUrl}`)
        } catch (error) {
            this.logger.error('Failed to initialize Media gRPC client:', error)
        }
    }

    async getFileInfo(fileId: string, userId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            this.client.getFileInfo(
                { file_id: fileId, user_id: userId },
                (error: any, response: any) => {
                    if (error) {
                        this.logger.error('Error getting file info:', error)
                        return reject(error)
                    }
                    resolve(response)
                }
            )
        })
    }

    async getUserFiles(
        userId: string,
        category?: string,
        limit: number = 20,
        offset: number = 0,
        sortBy: string = 'uploaded_at',
        sortOrder: string = 'desc'
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            const request = {
                user_id: userId,
                category,
                limit,
                offset,
                sort_by: sortBy,
                sort_order: sortOrder,
            }

            this.client.getUserFiles(request, (error: any, response: any) => {
                if (error) {
                    this.logger.error('Error getting user files:', error)
                    return reject(error)
                }
                resolve(response)
            })
        })
    }

    async deleteFile(fileId: string, userId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            this.client.deleteFile(
                { file_id: fileId, user_id: userId },
                (error: any, response: any) => {
                    if (error) {
                        this.logger.error('Error deleting file:', error)
                        return reject(error)
                    }
                    resolve(response)
                }
            )
        })
    }

    async generatePreview(
        fileId: string,
        userId: string,
        previewType: string = 'thumbnail',
        width?: number,
        height?: number
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            const request = {
                file_id: fileId,
                user_id: userId,
                preview_type: previewType,
                width,
                height,
            }

            this.client.generatePreview(
                request,
                (error: any, response: any) => {
                    if (error) {
                        this.logger.error('Error generating preview:', error)
                        return reject(error)
                    }
                    resolve(response)
                }
            )
        })
    }

    async getPreview(
        fileId: string,
        userId: string,
        previewType: string = 'thumbnail'
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            const request = {
                file_id: fileId,
                user_id: userId,
                preview_type: previewType,
            }

            this.client.getPreview(request, (error: any, response: any) => {
                if (error) {
                    this.logger.error('Error getting preview:', error)
                    return reject(error)
                }
                resolve(response)
            })
        })
    }

    async updateFileMetadata(
        fileId: string,
        userId: string,
        metadata: any
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            const request = {
                file_id: fileId,
                user_id: userId,
                ...metadata,
            }

            this.client.updateFileMetadata(
                request,
                (error: any, response: any) => {
                    if (error) {
                        this.logger.error(
                            'Error updating file metadata:',
                            error
                        )
                        return reject(error)
                    }
                    resolve(response)
                }
            )
        })
    }

    async getFileCategories(userId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            this.client.getFileCategories(
                { user_id: userId },
                (error: any, response: any) => {
                    if (error) {
                        this.logger.error(
                            'Error getting file categories:',
                            error
                        )
                        return reject(error)
                    }
                    resolve(response)
                }
            )
        })
    }

    async searchFiles(
        userId: string,
        query: string,
        category?: string,
        mimeType?: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            const request = {
                user_id: userId,
                query,
                category,
                mime_type: mimeType,
                limit,
                offset,
            }

            this.client.searchFiles(request, (error: any, response: any) => {
                if (error) {
                    this.logger.error('Error searching files:', error)
                    return reject(error)
                }
                resolve(response)
            })
        })
    }

    async getStorageUsage(userId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                return reject(new Error('gRPC client not initialized'))
            }

            this.client.getStorageUsage(
                { user_id: userId },
                (error: any, response: any) => {
                    if (error) {
                        this.logger.error('Error getting storage usage:', error)
                        return reject(error)
                    }
                    resolve(response)
                }
            )
        })
    }
}
